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
const gemini_model_name_js_1 = require("./gemini-model-name.js");
const gemini_usage_log_js_1 = require("./gemini-usage-log.js");
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
exports.geminiModelCandidatesFor = geminiModelCandidatesFor;
exports.coerceQuantityFromGemini = coerceQuantityFromGemini;
exports.coerceUnitFromGemini = coerceUnitFromGemini;
exports.buildHistoryItemsOptionBlock = buildHistoryItemsOptionBlock;
exports.parseOrderVisionForEval = parseOrderVisionForEval;
/**
 * 文字／圖像共用：台灣生鮮物流接單專家邏輯（實際 systemInstruction 來自資料庫 prompt_versions 或內建備援）。
 */
const gemini_prompt_defaults_js_1 = require("./gemini-prompt-defaults.js");
const gemini_prompt_resolve_js_1 = require("./gemini-prompt-resolve.js");
function buildSubCustomerInstructionBlock(knownSubCustomers) {
    const t = String(knownSubCustomers || "").trim();
    if (!t)
        return "";
    return `

【極重要：子客戶拆單與名稱校正】
這可能是一張包含多個分店/單位的合併訂單。
這個群組旗下固定的子客戶名單為：[ ${t} ]。
- 請根據圖片或文字的排版、標題、括號備註，判斷每個品項屬於哪個單位。
- **強制校正**：請務必優先對應到名單中的標準名稱。例如：客人若簡寫「附小」或「東大」，但名單中有「東大附小」，請一律輸出「東大附小」。
- 若該品項沒有特別標示，或是屬於預設主要客戶，請在 sub_customer 輸出空字串 ""。
- 若客人的寫法完全無法對應名單，才照實輸出其寫法（仍填在 sub_customer）。`;
}
/**
 * Dynamic Option Prompting：歷史叫貨品項小抄，將品名配對收斂為選擇題。
 */
function buildHistoryItemsOptionBlock(historyItems) {
    const arr = Array.isArray(historyItems) ? historyItems : [];
    const cleaned = [];
    const seen = new Set();
    for (const x of arr) {
        const s = String(x || "").trim();
        if (!s || seen.has(s))
            continue;
        seen.add(s);
        cleaned.push(s);
    }
    if (!cleaned.length)
        return "";
    const maxList = 450;
    const list = cleaned.slice(0, maxList);
    const joined = list.join(", ");
    const tail = cleaned.length > maxList
        ? `\n（以下名單已截斷顯示；資料庫尚有約 ${cleaned.length - maxList} 筆未列出，仍請優先在已列出名單中配對。）`
        : "";
    return `

【極重要：品項配對限制】
這張表單是該客戶的歷史常用叫貨品項，請『優先且盡量』從以下品項名單中進行配對：
[${joined}]
如果圖片上的字跡潦草或難以辨識，但形狀與上述名單中的某個品項高度相似，請直接使用名單中的標準品名輸出（raw_name 請用名單中的完整字樣）。只有當你 100% 確定圖片上的字『絕對不是』名單中的任何一項時，才允許輸出新的品名。${tail}`;
}
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
async function buildDynamicFewShotContents(db, customerId, limit = 2, excludeIds = []) {
    if (!db || !customerId)
        return [];
    const lim = Math.min(Math.max(1, Number(limit) || 2), 5);
    const rows = await loadFewShotExamplesForCustomer(db, customerId, lim, excludeIds);
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
/**
 * @param {"text"|"vision"} kind 文字叫貨用較省模型，圖片／視覺用較強模型（見 gemini-model-name.js）
 */
function geminiModelCandidatesFor(kind) {
    const primary = kind === "vision"
        ? (0, gemini_model_name_js_1.getGeminiVisionModelName)()
        : (0, gemini_model_name_js_1.getGeminiTextModelName)();
    const fallbacks = ["gemini-2.5-flash", "gemini-2.0-flash"];
    const seen = new Set();
    const out = [];
    for (const m of [primary, ...fallbacks]) {
        if (m && !seen.has(m)) {
            seen.add(m);
            out.push(m);
        }
    }
    return out;
}
function geminiModelCandidates() {
    return geminiModelCandidatesFor("text");
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
            sub_customer: {
                type: generative_ai_1.SchemaType.STRING,
                description: "子分店／子單位標準名稱；無則空字串",
            },
        },
        required: ["raw_name", "quantity", "unit", "remark", "confidence_score", "sub_customer"],
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
function coerceSubCustomerFromRow(row) {
    const v = row.sub_customer ?? row.Sub_customer ?? row.subCustomer;
    if (v == null)
        return null;
    const t = String(v).trim();
    return t === "" ? null : t;
}
/**
 * 自單列物件擷取數量：AI 可能用 quantity／Quantity／QTY／中文「數量」等；
 * 注意：若「數量」鍵存在但為空字串，不可擋住後續英文鍵（舊版 ?? 鏈會誤用空字串）。
 */
function pickQuantityFromRow(row) {
    if (!row || typeof row !== "object")
        return 0;
    const keys = [
        "數量",
        "quantity",
        "Quantity",
        "QUANTITY",
        "QTY",
        "Qty",
        "qty",
    ];
    for (const k of keys) {
        if (!Object.prototype.hasOwnProperty.call(row, k))
            continue;
        const v = row[k];
        if (v == null || v === "")
            continue;
        if (typeof v === "number" && Number.isFinite(v))
            return v;
        const coerced = coerceQuantityFromGemini(v);
        if (Number.isFinite(coerced))
            return coerced;
    }
    return 0;
}
/** 預印籃子／單位標籤誤判為品項且無有效數量時略過 */
function isLikelyBlankPreprintBasketRow(rawName, quantity) {
    if (quantity > 0)
        return false;
    const s = String(rawName || "").replace(/\s+/g, "");
    if (!s)
        return true;
    if (/^籃子[：:]?個?$/.test(s))
        return true;
    if (s === "籃子" || s === "個")
        return true;
    if (/^其他品項$/.test(s) || /^備註$/.test(s))
        return true;
    return false;
}
function mapRowsToOrderItems(arr) {
    if (!Array.isArray(arr) || arr.length === 0)
        return null;
    const rows = arr
        .map((row) => ({
        rawName: (row.品項 ?? row.rawName ?? row.raw_name ?? row.Raw_name ?? "").toString().trim() || "",
        quantity: pickQuantityFromRow(row),
        unit: coerceUnitFromGemini(row.單位 ?? row.unit ?? row.Unit ?? row.UNIT ?? row.UnitName ?? row.unit_name) || null,
        amount: row.金額 != null && String(row.金額).trim() !== "" ? String(row.金額).trim() : null,
        remark: (row.備註 ?? row.remark ?? row.Remark ?? "").toString().trim() || null,
        subCustomer: coerceSubCustomerFromRow(row),
        confidenceScore: row.confidence_score != null ? Number(row.confidence_score) : undefined,
    }))
        .filter((x) => x.rawName)
        .filter((x) => !isLikelyBlankPreprintBasketRow(x.rawName, x.quantity))
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
async function loadFewShotExamplesForCustomer(db, customerId, limit = 2, excludeIds = []) {
    if (!db || !customerId)
        return [];
    const n = Math.min(Math.max(1, limit | 0), 5);
    const exc = Array.isArray(excludeIds) ? excludeIds.filter(Boolean).map(String) : [];
    let sql = `SELECT id, image_path, parsed_json, quality_score
     FROM customer_order_image_examples
     WHERE customer_id = ? AND is_active = 1`;
    const params = [customerId];
    if (exc.length) {
        sql += ` AND id NOT IN (${exc.map(() => "?").join(", ")})`;
        params.push(...exc);
    }
    sql += ` ORDER BY quality_score DESC, created_at DESC, updated_at DESC
     LIMIT ?`;
    params.push(n);
    const rows = await db.prepare(sql).all(...params);
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
async function generateStructuredJson(apiKey, modelName, systemInstruction, contentsOrUserParts, usageCtx) {
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
    const t0 = Date.now();
    const result = await model.generateContent({ contents });
    const latencyMs = Date.now() - t0;
    const meta = result.response.usageMetadata;
    if (usageCtx?.db) {
        await gemini_usage_log_js_1.recordGeminiUsage(usageCtx.db, {
            customer_id: usageCtx.customerId ?? null,
            call_kind: usageCtx.callKind || "structured",
            model_name: modelName,
            latency_ms: latencyMs,
            prompt_tokens: meta?.promptTokenCount,
            candidates_tokens: meta?.candidatesTokenCount,
            total_tokens: meta?.totalTokenCount,
            prompt_version_id: usageCtx.promptVersionId ?? null,
        });
    }
    const text = result.response.text();
    const rawJsonResponse = text != null ? String(text).trim() : "";
    console.log("=== Gemini Raw JSON Output ===", rawJsonResponse);
    if (!rawJsonResponse)
        return null;
    return JSON.parse(rawJsonResponse);
}
async function tryModelsStructured(apiKey, systemInstruction, buildParts, kind = "text", usageCtx) {
    const models = geminiModelCandidatesFor(kind);
    let lastErr = "";
    for (const modelName of models) {
        try {
            const parts = await buildParts();
            const json = await generateStructuredJson(apiKey, modelName, systemInstruction, parts, usageCtx);
            if (json && json.items && Array.isArray(json.items))
                return json;
        }
        catch (e) {
            lastErr = e?.message || String(e);
            console.warn("[gemini-order] model %s failed: %s", modelName, lastErr);
        }
    }
    console.warn("[gemini-order] all models failed: %s", lastErr);
    const quotaOrCap =
        /spending cap|429|RESOURCE_EXHAUSTED|Too Many Requests|quota/i.test(lastErr || "");
    if (quotaOrCap) {
        console.error("[gemini-order] Gemini 被拒絕（429／額度或每月支出上限）：請至 https://ai.google.dev/gemini-api/docs/rate-limits 查看限制，並至 https://ai.studio/spend 調高 AI Studio 專案的 Monthly spending cap；若使用 Cloud 帳單請一併檢查 Generative Language API 配額與付款帳戶。");
    }
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
    const rp = await gemini_prompt_resolve_js_1.resolvePromptBody(options?.db, "text");
    const systemInst = rp.body + buildSubCustomerInstructionBlock(options?.knownSubCustomers);
    const usageCtx = options?.db
        ? { db: options.db, customerId: options.customerId ?? null, callKind: "text", promptVersionId: rp.versionId }
        : undefined;
    const json = await tryModelsStructured(apiKey, systemInst, async () => [
        { role: "user", parts: [{ text: `請解析以下叫貨文字，輸出符合 schema 的 JSON。${suffix}\n\n---\n${t}\n---` }] },
    ], "text", usageCtx);
    return json ? mapStructuredOrderLinesToItems(json) : null;
}
/**
 * Gemini 視覺：單張叫貨圖 → 結構化品項。
 * @param historyItems 可選第三參數；若傳入（含空陣列）則優先於 options.historyItems。用於 Dynamic Option Prompting 歷史品項小抄。
 */
async function parseOrderWithGeminiImage(buffer, options, historyItems) {
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
    const mergedHistory = historyItems !== undefined
        ? (Array.isArray(historyItems) ? historyItems : [])
        : (Array.isArray(options?.historyItems) ? options.historyItems : []);
    const optMerged = { ...options, historyItems: mergedHistory };
    const rp = await gemini_prompt_resolve_js_1.resolvePromptBody(db, "vision");
    const visionSystem = rp.body + buildSubCustomerInstructionBlock(optMerged?.knownSubCustomers) + buildHistoryItemsOptionBlock(optMerged?.historyItems);
    const usageCtx = db
        ? { db, customerId: customerId ?? null, callKind: "vision", promptVersionId: rp.versionId }
        : undefined;
    const json = await tryModelsStructured(apiKey, visionSystem, async () => {
        const exLim = Math.min(options?.exampleLimit ?? 2, 2);
        const contents = await buildDynamicFewShotContents(db, customerId, exLim, []);
        const targetText = `【待辨識目標圖】請閱讀下一張叫貨單圖片，列出**所有**品項（勿漏雙欄任一侧），輸出符合 schema 的 JSON。${suffix}`;
        contents.push({
            role: "user",
            parts: [
                { text: targetText },
                { inlineData: { mimeType, data: b64 } },
            ],
        });
        return contents;
    }, "vision", usageCtx);
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
    const rp = await gemini_prompt_resolve_js_1.resolvePromptBody(db, "vision");
    const visionCore = rp.body + buildSubCustomerInstructionBlock(options?.knownSubCustomers) + buildHistoryItemsOptionBlock(options?.historyItems);
    const fewShotSystem = `${visionCore}

接下來會提供若干「參考範例」對話：每則為一張歷史叫貨單圖片（user）與經人工核可的明細 JSON（model）。請學習該客戶的筆跡、排版與用語風格。
最後一則為「本次待辨識」圖片，請輸出與範例相同結構的 JSON（items 陣列），並為每筆填寫 confidence_score、sub_customer。`;
    const usageCtxFs = db
        ? { db, customerId: customerId ?? null, callKind: "vision_few_shot", promptVersionId: rp.versionId }
        : undefined;
    const json = await tryModelsStructured(apiKey, fewShotSystem, async () => {
        const contents = await buildDynamicFewShotContents(db, customerId, exampleLimit, []);
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
    }, "vision", usageCtxFs);
    return json ? mapStructuredOrderLinesToItems(json) : null;
}
/**
 * Eval 後台：單一指定模型、可選 vision prompt 正文／版本、Few-Shot 策略；預設排除評測中之範例 id，避免題目與 Few-Shot 重疊。
 * fewShotStrategy: none（無參考圖）｜standard（與線上視覺相同前言 + 動態 Few-Shot）｜explicit（Few-Shot 長前言如 vision_few_shot）
 */
async function parseOrderVisionForEval(buffer, options) {
    const apiKey = getGeminiApiKey();
    if (!apiKey)
        return null;
    if (!buffer || buffer.length === 0)
        return null;
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    const mimeType = detectMimeFromBuffer(buf);
    const b64 = buf.toString("base64");
    const suffix = options && typeof options.extraPromptSuffix === "string" && options.extraPromptSuffix.trim()
        ? "\n\n【補充對照】\n" + options.extraPromptSuffix.trim()
        : "";
    const extraSuffix = options && typeof options.extraPromptSuffix === "string" && options.extraPromptSuffix.trim()
        ? options.extraPromptSuffix.trim()
        : "";
    const imgSuffix = options && typeof options.extraImagePromptSuffix === "string" && options.extraImagePromptSuffix.trim()
        ? options.extraImagePromptSuffix.trim()
        : "";
    const db = options?.db;
    const customerId = options?.customerId;
    const strategyRaw = options?.fewShotStrategy ?? "standard";
    const strategy = strategyRaw === "explicit" ? "explicit" : strategyRaw === "none" ? "none" : "standard";
    const exampleLimit = Math.min(Math.max(0, Number(options?.exampleLimit ?? 2)), 5);
    const excludeIds = Array.isArray(options?.excludeExampleIds) ? options.excludeExampleIds.filter(Boolean).map(String) : [];
    const mergedHistory = Array.isArray(options?.historyItems) ? options.historyItems : [];
    let resolvedPromptVersionId = options?.promptVersionId != null && String(options.promptVersionId).trim()
        ? String(options.promptVersionId).trim()
        : null;
    let rpBody;
    if (options?.promptBody && String(options.promptBody).trim()) {
        rpBody = String(options.promptBody);
    }
    else {
        const rp = await gemini_prompt_resolve_js_1.resolvePromptBody(db, "vision");
        rpBody = rp.body;
        resolvedPromptVersionId = rp.versionId;
    }
    const visionCore = rpBody + buildSubCustomerInstructionBlock(options?.knownSubCustomers) + buildHistoryItemsOptionBlock(mergedHistory);
    let visionSystem = visionCore;
    if (strategy === "explicit") {
        visionSystem = `${visionCore}

接下來會提供若干「參考範例」對話：每則為一張歷史叫貨單圖片（user）與經人工核可的明細 JSON（model）。請學習該客戶的筆跡、排版與用語風格。
最後一則為「本次待辨識」圖片，請輸出與範例相同結構的 JSON（items 陣列），並為每筆填寫 confidence_score、sub_customer。`;
    }
    const usageCtx = db && options?.recordUsage !== false
        ? {
            db,
            customerId: customerId ?? null,
            callKind: "eval",
            promptVersionId: resolvedPromptVersionId,
        }
        : undefined;
    const modelName = options?.modelName && String(options.modelName).trim()
        ? String(options.modelName).trim()
        : (0, gemini_model_name_js_1.getGeminiVisionModelName)();
    const contents = [];
    if (strategy !== "none" && exampleLimit > 0) {
        const fsContents = await buildDynamicFewShotContents(db, customerId, exampleLimit, excludeIds);
        contents.push(...fsContents);
    }
    let targetText;
    if (strategy === "explicit") {
        const extraBlock = [extraSuffix, imgSuffix].filter(Boolean).join("\n\n");
        targetText = "【本次待辨識圖片】請僅依此圖輸出叫貨明細 JSON（items），格式與前述範例一致。" +
            (extraBlock ? `\n\n【補充文字對照／規則】\n${extraBlock}` : "");
    }
    else {
        targetText = `【待辨識目標圖】請閱讀下一張叫貨單圖片，列出**所有**品項（勿漏雙欄任一侧），輸出符合 schema 的 JSON。${suffix}`;
    }
    contents.push({
        role: "user",
        parts: [
            { text: targetText },
            { inlineData: { mimeType, data: b64 } },
        ],
    });
    try {
        const json = await generateStructuredJson(apiKey, modelName, visionSystem, contents, usageCtx);
        return json ? mapStructuredOrderLinesToItems(json) : null;
    }
    catch (e) {
        console.warn("[gemini-order] parseOrderVisionForEval failed:", e?.message || e);
        return null;
    }
}
