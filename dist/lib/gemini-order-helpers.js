"use strict";
/**
 * Google Gemini 訂單解析：官方 @google/generative-ai SDK，
 * 使用 responseMimeType + responseSchema 強制結構化 JSON。
 * 支援純文字、單圖、Few-Shot 多模態（歷史圖 + 正確明細）。
 */
Object.defineProperty(exports, "__esModule", { value: true });
const generative_ai_1 = require("@google/generative-ai");
const fs = require("fs/promises");
const fsSync = require("fs");
const pathMod = require("path");
const parse_order_message_js_1 = require("./parse-order-message.js");
exports.getGeminiApiKey = getGeminiApiKey;
exports.mapRowsToOrderItems = mapRowsToOrderItems;
exports.mapStructuredOrderLinesToItems = mapStructuredOrderLinesToItems;
exports.loadFewShotExamplesForCustomer = loadFewShotExamplesForCustomer;
exports.readImagePathOrBase64 = readImagePathOrBase64;
exports.parseOrderWithGeminiText = parseOrderWithGeminiText;
exports.parseOrderWithGeminiImage = parseOrderWithGeminiImage;
exports.parseOrderWithGeminiVisionFewShot = parseOrderWithGeminiVisionFewShot;
exports.buildOrderLinesResponseSchema = buildOrderLinesResponseSchema;
exports.geminiModelCandidates = geminiModelCandidates;
exports.coerceQuantityFromGemini = coerceQuantityFromGemini;
exports.coerceUnitFromGemini = coerceUnitFromGemini;
/** 使用 Google 目前提供的穩定 Flash 模型名稱（舊版 1.5 等可能已下架） */
const GEMINI_MODEL_DEFAULT = "gemini-2.5-flash";
/**
 * 文字／圖像共用：台灣生鮮物流接單專家邏輯、資料清洗、複合單位、全域掃描（供 ERP 匯入）。
 * 輸出仍須符合 responseSchema：每筆含 raw_name、quantity、unit、remark，以及 schema 要求之 confidence_score、product_id。
 * （實際傳入 getGenerativeModel 的 systemInstruction 即 SYSTEM_INSTRUCTION_TEXT / SYSTEM_INSTRUCTION_VISION。）
 */
const SYSTEM_INSTRUCTION_ERP_ORDER_CLERK_CORE = `【角色】你是專業的台灣生鮮物流與餐飲食材接單專家。讀取客戶叫貨文字或手寫訂購單影像時，須完成「資料清洗」：標準化品名與單位、拆開複合數量與加工／狀態說明，讓後續能匯入 ERP。
【輸出】僅輸出符合指定 JSON schema 的結構化資料。每一筆品項必須包含欄位：raw_name、quantity、unit、remark（無備註則填空字串 ""）；並依 schema 填寫 confidence_score（以及 product_id，不確定則 null）。禁止在 JSON 外輸出多餘文字。

【零、忽略未叫貨的空白欄位（極度重要，優先於下列諸條）】
- 當你看到**印刷的表單**（預印品名、多數數量欄為空白）時，**只允許**輸出客戶有實際「手寫填入數量或記號」的品項。
- 若某個印刷品名旁邊，客戶**沒有**寫上任何數量或記號（該欄為空白），請你當作沒看到，**絕對不要**將該品項輸出到 JSON 中。
- **禁止**自作主張幫空白欄位補上 quantity 1。預設 quantity 為 1 的規則（見【一】）**僅限於**客戶在該列已有書寫痕跡（例如打勾、✓、寫單位、寫「要」等）但**沒寫具體數字**的情況；印刷預留而完全無手寫、無記號之列，一律不輸出，以縮短 JSON、避免截斷。

【一、中文數字與隱含數量】
- 數量寫「半」或「半斤」等：將「半」轉為數字 0.5（例如半斤 → quantity 0.5、unit 斤）。
- 客戶只寫單位而沒寫阿拉伯數字（例如只寫「一箱」「一件」而無數字）：預設 quantity 為 1，unit 依原文（箱、件等）。**不適用**於【零】所述「印刷品名旁數量欄完全空白」之列。

【二、指令與狀態分離（最重要）】
- raw_name 僅保留「純食材／標準品名」（例如：白菜、芹菜、金針菇）；勿把加工詞、產地、狀態塞進品名。
- 若客戶把加工指示或狀態（例如：去葉子、水、山東、真空、去皮、漂亮）寫在品名旁、括號內、甚至寫在數量欄位，請將這些字眼**全部**移至 remark。
- 若因上述拆分導致該列在語意上「沒有」可辨識的數量，請自動補 quantity 為 1、unit 為「份」（或依上下文最合理的單位）。**若為印刷表單該列數量欄完全空白、無任何手寫，則依【零】整列不輸出，不得用本條補 1。**

【三、無邊界與全域掃描】
- 訂單不僅限於左側有格線的主表格。**圖片**須仔細掃描右側「其他品項」欄、表格外側與邊緣空白處的自由手寫品項，不得漏列。
- **純文字**輸入則須逐段掃描全文，包含附註、補充區與非表格式段落，同樣不得漏列。

【四、複合單位與數量】
- 遇到「1箱+5包」「一件+20包」等複合寫法：將**最大／主要**那一組寫入 quantity 與 unit；剩餘零星數量（如 +5包）**完整**寫入 remark，不得遺漏。
- 情境 A：「蒜末 1公斤+5包」→ {"raw_name":"蒜末","quantity":1,"unit":"公斤","remark":"另加5包"}
- 情境 B：「金針菇 一件+20包」→ {"raw_name":"金針菇","quantity":1,"unit":"件","remark":"另加20包"}

【五、不規範用語與品質／加工（與第二條呼應之範例）】
- 情境 C：「去殼玉米 1k」→ {"raw_name":"玉米","quantity":1,"unit":"k","remark":"去殼"}
- 情境 D：「金針菇(真空) 2箱」→ {"raw_name":"金針菇","quantity":2,"unit":"箱","remark":"真空"}
- 情境 E：「漂亮高麗菜 50斤」→ {"raw_name":"高麗菜","quantity":50,"unit":"斤","remark":"要漂亮"}`;
/** 生鮮物流訂單：文字解析 */
const SYSTEM_INSTRUCTION_TEXT = `${SYSTEM_INSTRUCTION_ERP_ORDER_CLERK_CORE}

【文字專用補充】
- 略過閒聊、地址、電話、條碼純數字等非叫貨內容。
- 單位：客戶慣用 k／K 視為公斤；斤、包、把、箱、件等依原文合理保留。
- 多欄／雙欄清單依閱讀順序拆成獨立品項，不可合併或漏列。
- 每筆請給 confidence_score：0–100（整體對該列解析的信心）。`;
/** 生鮮物流訂單：圖像／手寫辨識 */
const SYSTEM_INSTRUCTION_VISION = `${SYSTEM_INSTRUCTION_ERP_ORDER_CLERK_CORE}

【圖像專用補充】
- 只辨識紙上／畫面主體的叫貨列，勿將桌面、資料夾、背景條碼當成品項。
- 雙欄／多欄印刷表單須依欄**直向**逐列讀完再讀下一欄，禁止橫向把左右欄併成少數品項或漏列。
- 跨行續寫、小字補註可寫入 remark（如「跨行書寫」）。
- 手寫數量須與該列品名對齊，禁止把不同欄位併成一筆。
- 數字與單位須合理分離，禁止將「20kg」類讀成萬位級錯誤整數。
- 單位：k／K 視為公斤；其餘依畫面如實辨識。
- 每筆請給 confidence_score：0–100，反映你對該列辨識的信心。`;
/** 將 parsed_json 轉成 { items } 供 Few-Shot */
function parseFewShotParsedJsonPayload(raw) {
    try {
        const parsed = JSON.parse(String(raw || "{}"));
        if (parsed && Array.isArray(parsed.items))
            return parsed;
        if (Array.isArray(parsed))
            return { items: parsed };
    }
    catch {
        /* ignore */
    }
    return null;
}
/** 本機路徑讀圖轉 Base64（http URL 請改存本機路徑；失敗回傳 null） */
function readLocalImagePathAsBase64Sync(imagePath) {
    const s = String(imagePath || "").trim();
    if (!s || /^https?:\/\//i.test(s)) {
        if (s && /^https?:\/\//i.test(s))
            console.warn("[gemini-order] Few-Shot image_path 為 URL，請改為本機相對路徑，略過:", s.slice(0, 80));
        return null;
    }
    try {
        const abs = pathMod.isAbsolute(s) ? s : pathMod.join(process.cwd(), s);
        const buf = fsSync.readFileSync(abs);
        const ext = pathMod.extname(abs).toLowerCase();
        let mimeType = "image/jpeg";
        if (ext === ".png")
            mimeType = "image/png";
        else if (ext === ".gif")
            mimeType = "image/gif";
        else if (ext === ".webp")
            mimeType = "image/webp";
        return { data: buf.toString("base64"), mimeType };
    }
    catch (e) {
        console.warn("[gemini-order] Few-Shot 圖檔讀取失敗，略過:", s, e?.message || e);
        return null;
    }
}
/**
 * 從 DB 載入該客戶最多 limit 筆範例（預設 2），組成多輪 contents（user 圖 + model 正確 JSON）。
 * 無 db／customerId／無範例時回傳空陣列。
 */
async function buildDynamicFewShotContents(db, customerId, limit = 2) {
    if (!db || !customerId)
        return [];
    const lim = Math.min(Math.max(1, Number(limit) || 2), 2);
    const rows = await loadFewShotExamplesForCustomer(db, customerId, lim);
    const contents = [];
    for (const ex of rows) {
        const payload = parseFewShotParsedJsonPayload(ex.parsed_json);
        if (!payload)
            continue;
        const img = readLocalImagePathAsBase64Sync(ex.image_path);
        if (!img)
            continue;
        contents.push({
            role: "user",
            parts: [
                { text: "【參考範例】下列為該客戶已人工核可的叫貨單圖片。請對齊筆跡、排版與用語。" },
                { inlineData: { mimeType: img.mimeType, data: img.data } },
            ],
        });
        contents.push({
            role: "model",
            parts: [{ text: JSON.stringify(payload) }],
        });
    }
    return contents;
}
function getGeminiApiKey() {
    const k = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    return k && String(k).trim() ? String(k).trim() : "";
}
function geminiModelCandidates() {
    return [GEMINI_MODEL_DEFAULT];
}
/** 與 SDK responseSchema 一致：{ items: [ { raw_name, quantity, unit, remark, product_id?, confidence_score } ] } */
function buildOrderLinesResponseSchema() {
    const lineItem = {
        type: generative_ai_1.SchemaType.OBJECT,
        properties: {
            raw_name: {
                type: generative_ai_1.SchemaType.STRING,
                description: "標準化食材／品名（繁體）；品質、加工、括號註記已拆至 remark",
            },
            quantity: {
                type: generative_ai_1.SchemaType.NUMBER,
                description: "主數量（正數）；複合單位時僅填主要那一組",
            },
            unit: {
                type: generative_ai_1.SchemaType.STRING,
                description: "主單位（如公斤、斤、包、件、箱）；複合單位時僅填主要單位",
            },
            remark: {
                type: generative_ai_1.SchemaType.STRING,
                description: "另加數量、零星單位、品質／加工／跨行說明；無則空字串",
            },
            product_id: {
                type: generative_ai_1.SchemaType.STRING,
                nullable: true,
                description: "若可對應公司料號則填；不確定則 null",
            },
            confidence_score: {
                type: generative_ai_1.SchemaType.NUMBER,
                description: "0–100 整體信心分數",
            },
        },
        required: ["raw_name", "quantity", "unit", "remark", "confidence_score"],
    };
    return {
        type: generative_ai_1.SchemaType.OBJECT,
        properties: {
            items: {
                type: generative_ai_1.SchemaType.ARRAY,
                items: lineItem,
            },
        },
        required: ["items"],
    };
}
/** Gemini 回傳之 quantity 可能為字串、缺欄位或別名鍵，需統一為有限數字 */
function coerceQuantityFromGemini(q) {
    if (q == null || q === "")
        return 0;
    if (typeof q === "number" && Number.isFinite(q))
        return q;
    const n = parseFloat(String(q).replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
}
/** unit 一律轉成字串；空則傳 ""，由呼叫端決定是否 fallback 公斤 */
function coerceUnitFromGemini(u) {
    if (u == null)
        return "";
    return String(u).trim();
}
function mapRowsToOrderItems(arr) {
    if (!Array.isArray(arr) || arr.length === 0)
        return null;
    const rows = arr
        .map((row) => ({
        rawName: (row.品項 ?? row.rawName ?? row.raw_name ?? "").toString().trim() || "",
        quantity: typeof row.數量 === "number" && Number.isFinite(row.數量)
            ? row.數量
            : coerceQuantityFromGemini(row.數量 ?? row.quantity ?? row.Qty ?? row.qty),
        unit: coerceUnitFromGemini(row.單位 ?? row.unit ?? row.Unit) || null,
        amount: row.金額 != null && String(row.金額).trim() !== "" ? String(row.金額).trim() : null,
        remark: (row.備註 ?? row.remark ?? "").toString().trim() || null,
        confidenceScore: row.confidence_score != null ? Number(row.confidence_score) : undefined,
    }))
        .filter((x) => x.rawName)
        .map((x) => {
        const split = parse_order_message_js_1.splitItemNameRemarks(x.rawName);
        return {
            ...x,
            rawName: split.rawName,
            remark: parse_order_message_js_1.mergeRemarks(x.remark, split.remark),
        };
    });
    return rows.length ? rows : null;
}
/** 已由 schema 約束之物件 → 與 mapRowsToOrderItems 相同結構（略過再次拆括號若已乾淨） */
function mapStructuredOrderLinesToItems(obj) {
    const items = obj && Array.isArray(obj.items) ? obj.items : null;
    if (!items)
        return null;
    return mapRowsToOrderItems(items);
}
async function readImagePathOrBase64(imagePathOrUrl) {
    const s = String(imagePathOrUrl || "").trim();
    if (!s)
        throw new Error("empty image path");
    if (/^https?:\/\//i.test(s)) {
        const res = await fetch(s);
        if (!res.ok)
            throw new Error(`fetch image HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        return { buffer: buf, mimeType: res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg" };
    }
    const abs = pathMod.isAbsolute(s) ? s : pathMod.join(process.cwd(), s);
    const buffer = await fs.readFile(abs);
    const ext = pathMod.extname(abs).toLowerCase();
    let mimeType = "image/jpeg";
    if (ext === ".png")
        mimeType = "image/png";
    else if (ext === ".gif")
        mimeType = "image/gif";
    else if (ext === ".webp")
        mimeType = "image/webp";
    return { buffer, mimeType };
}
async function loadFewShotExamplesForCustomer(db, customerId, limit = 2) {
    if (!db || !customerId)
        return [];
    const n = Math.min(Math.max(1, limit | 0), 5);
    const rows = await db
        .prepare(`SELECT id, image_path, parsed_json, quality_score
     FROM customer_order_image_examples
     WHERE customer_id = ? AND is_active = 1
     ORDER BY quality_score DESC, created_at DESC, updated_at DESC
     LIMIT ?`)
        .all(customerId, n);
    return rows || [];
}
function detectMimeFromBuffer(buffer) {
    if (!buffer || buffer.length < 4)
        return "image/jpeg";
    if (buffer[0] === 0xff && buffer[1] === 0xd8)
        return "image/jpeg";
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47)
        return "image/png";
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46)
        return "image/gif";
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46)
        return "image/webp";
    return "image/jpeg";
}
async function generateStructuredJson(apiKey, modelName, systemInstruction, contentsOrUserParts) {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: buildOrderLinesResponseSchema(),
            temperature: 0.25,
            maxOutputTokens: 8192,
        },
    });
    const isMultiTurn = Array.isArray(contentsOrUserParts) &&
        contentsOrUserParts.length > 0 &&
        typeof contentsOrUserParts[0].role === "string";
    const contents = isMultiTurn
        ? contentsOrUserParts
        : [{ role: "user", parts: contentsOrUserParts }];
    const result = await model.generateContent({ contents });
    const text = result.response.text();
    const rawJsonResponse = text != null ? String(text).trim() : "";
    console.log("=== Gemini Raw JSON Output ===", rawJsonResponse);
    if (!rawJsonResponse)
        return null;
    return JSON.parse(rawJsonResponse);
}
async function tryModelsStructured(apiKey, systemInstruction, buildParts) {
    const models = geminiModelCandidates();
    let lastErr = "";
    for (const modelName of models) {
        try {
            const parts = await buildParts();
            const json = await generateStructuredJson(apiKey, modelName, systemInstruction, parts);
            if (json && json.items && Array.isArray(json.items))
                return json;
        }
        catch (e) {
            lastErr = e?.message || String(e);
            console.warn("[gemini-order] model %s failed: %s", modelName, lastErr);
        }
    }
    console.warn("[gemini-order] all models failed: %s", lastErr);
    return null;
}
async function parseOrderWithGeminiText(rawText, options) {
    const t = String(rawText || "").trim();
    if (!t)
        return null;
    const apiKey = getGeminiApiKey();
    if (!apiKey)
        return null;
    const suffix = options && typeof options.extraPromptSuffix === "string" && options.extraPromptSuffix.trim()
        ? "\n\n【補充對照】\n" + options.extraPromptSuffix.trim()
        : "";
    const json = await tryModelsStructured(apiKey, SYSTEM_INSTRUCTION_TEXT, async () => [
        { role: "user", parts: [{ text: `請解析以下叫貨文字，輸出符合 schema 的 JSON。${suffix}\n\n---\n${t}\n---` }] },
    ]);
    return json ? mapStructuredOrderLinesToItems(json) : null;
}
async function parseOrderWithGeminiImage(buffer, options) {
    if (!buffer || buffer.length === 0)
        return null;
    const apiKey = getGeminiApiKey();
    if (!apiKey)
        return null;
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    const mimeType = detectMimeFromBuffer(buf);
    const b64 = buf.toString("base64");
    const suffix = options && typeof options.extraPromptSuffix === "string" && options.extraPromptSuffix.trim()
        ? "\n\n【補充對照】\n" + options.extraPromptSuffix.trim()
        : "";
    const db = options?.db;
    const customerId = options?.customerId;
    const json = await tryModelsStructured(apiKey, SYSTEM_INSTRUCTION_VISION, async () => {
        const exLim = Math.min(options?.exampleLimit ?? 2, 2);
        const contents = await buildDynamicFewShotContents(db, customerId, exLim);
        const targetText = `【待辨識目標圖】請閱讀下一張叫貨單圖片，列出**所有**品項（勿漏雙欄任一侧），輸出符合 schema 的 JSON。${suffix}`;
        contents.push({
            role: "user",
            parts: [
                { text: targetText },
                { inlineData: { mimeType, data: b64 } },
            ],
        });
        return contents;
    });
    return json ? mapStructuredOrderLinesToItems(json) : null;
}
/**
 * Few-Shot：同一客戶歷史圖 + parsed_json，再加本次目標圖。
 * options.db + customerId 用於載入 customer_order_image_examples；可另傳 options.extraPromptSuffix（如筆跡文字對照）。
 */
async function parseOrderWithGeminiVisionFewShot(targetBuffer, options) {
    if (!targetBuffer || targetBuffer.length === 0)
        return null;
    const apiKey = getGeminiApiKey();
    if (!apiKey)
        return null;
    const db = options?.db;
    const customerId = options?.customerId;
    const exampleLimit = Math.min(options?.exampleLimit ?? 2, 2);
    const extraSuffix = options && typeof options.extraPromptSuffix === "string" && options.extraPromptSuffix.trim()
        ? options.extraPromptSuffix.trim()
        : "";
    const imgSuffix = options && typeof options.extraImagePromptSuffix === "string" && options.extraImagePromptSuffix.trim()
        ? options.extraImagePromptSuffix.trim()
        : "";
    const targetBuf = Buffer.isBuffer(targetBuffer) ? targetBuffer : Buffer.from(targetBuffer);
    const targetMime = detectMimeFromBuffer(targetBuf);
    const targetB64 = targetBuf.toString("base64");
    const fewShotSystem = `${SYSTEM_INSTRUCTION_VISION}

接下來會提供若干「參考範例」對話：每則為一張歷史叫貨單圖片（user）與經人工核可的明細 JSON（model）。請學習該客戶的筆跡、排版與用語風格。
最後一則為「本次待辨識」圖片，請輸出與範例相同結構的 JSON（items 陣列），並為每筆填寫 confidence_score。`;
    const json = await tryModelsStructured(apiKey, fewShotSystem, async () => {
        const contents = await buildDynamicFewShotContents(db, customerId, exampleLimit);
        const extraBlock = [extraSuffix, imgSuffix].filter(Boolean).join("\n\n");
        const finalIntro = "【本次待辨識圖片】請僅依此圖輸出叫貨明細 JSON（items），格式與前述範例一致。" +
            (extraBlock ? `\n\n【補充文字對照／規則】\n${extraBlock}` : "");
        contents.push({
            role: "user",
            parts: [
                { text: finalIntro },
                { inlineData: { mimeType: targetMime, data: targetB64 } },
            ],
        });
        return contents;
    });
    return json ? mapStructuredOrderLinesToItems(json) : null;
}
