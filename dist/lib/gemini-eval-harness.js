"use strict";
/**
 * 訂單圖辨識 Golden Set 評測：以 customer_order_image_examples.parsed_json 為標準答案。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEvalQuotaToday = getEvalQuotaToday;
exports.reserveFullEvalSlot = reserveFullEvalSlot;
exports.normItemNameKey = normItemNameKey;
exports.scoreOneExample = scoreOneExample;
exports.loadGoldenExampleRows = loadGoldenExampleRows;
exports.runVisionGoldenEval = runVisionGoldenEval;
const gemini_order_helpers_js_1 = require("./gemini-order-helpers.js");
const gemini_prompt_resolve_js_1 = require("./gemini-prompt-resolve.js");
exports.EVAL_FULL_RUN_DAILY_CAP = 5;
exports.EVAL_SETTINGS_DATE_KEY = "eval_harness_daily_date";
exports.EVAL_SETTINGS_COUNT_KEY = "eval_harness_daily_full_count";
async function getEvalQuotaToday(db) {
    const today = new Date().toISOString().slice(0, 10);
    const dRow = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(exports.EVAL_SETTINGS_DATE_KEY);
    const cRow = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(exports.EVAL_SETTINGS_COUNT_KEY);
    let used = 0;
    if (String(dRow?.value || "") === today && cRow?.value != null)
        used = parseInt(String(cRow.value), 10) || 0;
    const remaining = Math.max(0, exports.EVAL_FULL_RUN_DAILY_CAP - used);
    return { today, used, remaining };
}
/** 預約一次「全量評測」配額（成功後即扣次；失敗時仍計入，避免腳本誤迴圈）。 */
async function reserveFullEvalSlot(db) {
    const today = new Date().toISOString().slice(0, 10);
    const q = await getEvalQuotaToday(db);
    if (q.remaining <= 0) {
        return {
            ok: false,
            message: `今日全量評測已達上限（每日最多 ${exports.EVAL_FULL_RUN_DAILY_CAP} 次）。`,
            ...q,
        };
    }
    await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(exports.EVAL_SETTINGS_DATE_KEY, today);
    await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(exports.EVAL_SETTINGS_COUNT_KEY, String(q.used + 1));
    const q2 = await getEvalQuotaToday(db);
    return { ok: true, message: "已預約一次全量評測。", ...q2 };
}
function normItemNameKey(s) {
    return String(s || "")
        .trim()
        .replace(/\s+/g, "")
        .toLowerCase();
}
function normUnitKey(u) {
    return String(u || "")
        .trim()
        .replace(/\s+/g, "")
        .toLowerCase();
}
/** 將 parsed_json 轉成與 Gemini 輸出可比對之列 */
function goldItemsFromParsedJson(raw) {
    try {
        const parsed = JSON.parse(String(raw || "{}"));
        const obj = parsed && typeof parsed === "object" ? parsed : {};
        return gemini_order_helpers_js_1.mapStructuredOrderLinesToItems(obj);
    }
    catch {
        return null;
    }
}
/**
 * 逐筆 gold 對 pred：同品名（規格化名稱）Greedy 配對；無則計入漏列／誤列。
 */
function scoreOneExample(goldRows, predRows) {
    const gold = goldRows || [];
    const pred = predRows || [];
    const usedPred = new Set();
    const pairs = [];
    for (const g of gold) {
        const gn = normItemNameKey(g.rawName);
        let pj = -1;
        for (let j = 0; j < pred.length; j++) {
            if (usedPred.has(j))
                continue;
            if (normItemNameKey(pred[j].rawName) === gn) {
                pj = j;
                break;
            }
        }
        if (pj >= 0) {
            usedPred.add(pj);
            pairs.push({ g, p: pred[pj] });
        }
    }
    const tp = pairs.length;
    const fp = pred.length - tp;
    const fn = gold.length - tp;
    let qtyRelErrSum = 0;
    let qtyPairs = 0;
    let unitOk = 0;
    let unitPairs = 0;
    for (const { g, p } of pairs) {
        const gq = Number(g.quantity) || 0;
        const pq = Number(p.quantity) || 0;
        if (gq > 0)
            qtyRelErrSum += Math.abs(pq - gq) / gq;
        else
            qtyRelErrSum += Math.abs(pq - gq);
        qtyPairs++;
        unitPairs++;
        if (normUnitKey(g.unit) === normUnitKey(p.unit))
            unitOk++;
    }
    const precision = tp + fp > 0 ? tp / (tp + fp) : gold.length === 0 && pred.length === 0 ? 1 : null;
    const recall = tp + fn > 0 ? tp / (tp + fn) : gold.length === 0 ? 1 : null;
    const avgQtyRelErr = qtyPairs > 0 ? qtyRelErrSum / qtyPairs : null;
    const unitMatchRate = unitPairs > 0 ? unitOk / unitPairs : null;
    return {
        tp,
        fp,
        fn,
        precision,
        recall,
        avgQtyRelErr,
        unitMatchRate,
        matchedPairs: pairs.length,
    };
}
async function loadGoldenExampleRows(db, opts) {
    const maxOut = Math.min(100, Math.max(1, opts?.maxExamples ?? 80));
    const fetchN = Math.min(300, maxOut * 5);
    const activeOnly = opts?.activeOnly !== false;
    let sql = `SELECT id, customer_id, image_path, parsed_json, is_active, quality_score
    FROM customer_order_image_examples
    WHERE parsed_json IS NOT NULL AND TRIM(parsed_json) != ''`;
    if (activeOnly)
        sql += ` AND is_active = 1`;
    sql += ` ORDER BY quality_score DESC, updated_at DESC LIMIT ?`;
    const rows = (await db.prepare(sql).all(fetchN)) || [];
    const out = [];
    for (const r of rows) {
        if (out.length >= maxOut)
            break;
        const goldItems = goldItemsFromParsedJson(r.parsed_json);
        if (!goldItems || goldItems.length === 0)
            continue;
        out.push({ ...r, _goldItems: goldItems });
    }
    return out;
}
async function runVisionGoldenEval(db, opts) {
    await gemini_prompt_resolve_js_1.ensureSeedPromptVersions(db);
    const promptVersionId = opts?.promptVersionId != null && String(opts.promptVersionId).trim()
        ? String(opts.promptVersionId).trim()
        : "";
    let promptBody = null;
    let resolvedPv = null;
    if (promptVersionId) {
        const prow = await db.prepare("SELECT id, body FROM prompt_versions WHERE id = ? AND slot = 'vision'").get(promptVersionId);
        if (prow?.body) {
            promptBody = String(prow.body);
            resolvedPv = String(prow.id);
        }
    }
    if (!promptBody) {
        const rp = await gemini_prompt_resolve_js_1.resolvePromptBody(db, "vision");
        promptBody = rp.body;
        resolvedPv = rp.versionId;
    }
    const modelName = opts?.modelName && String(opts.modelName).trim()
        ? String(opts.modelName).trim()
        : "";
    const fewShotStrategy = opts?.fewShotStrategy === "explicit" || opts?.fewShotStrategy === "none"
        ? opts.fewShotStrategy
        : "standard";
    const exampleLimit = Math.min(5, Math.max(0, Number(opts?.exampleLimit ?? 2)));
    const maxExamples = Math.min(100, Math.max(1, Number(opts?.maxExamples ?? 80)));
    const activeOnly = opts?.activeOnly !== false;
    const golden = await loadGoldenExampleRows(db, { maxExamples, activeOnly });
    const perImage = [];
    let sumTp = 0;
    let sumFp = 0;
    let sumFn = 0;
    let sumQtyErr = 0;
    let sumQtyN = 0;
    let sumUnitOk = 0;
    let sumUnitN = 0;
    let apiErrors = 0;
    for (const ex of golden) {
        let pred = null;
        let readErr = null;
        try {
            const img = await gemini_order_helpers_js_1.readImagePathOrBase64(ex.image_path);
            const cust = await db.prepare("SELECT known_sub_customers FROM customers WHERE id = ?").get(ex.customer_id);
            pred = await gemini_order_helpers_js_1.parseOrderVisionForEval(img.buffer, {
                db,
                customerId: ex.customer_id,
                promptBody,
                promptVersionId: resolvedPv,
                modelName: modelName || undefined,
                fewShotStrategy,
                exampleLimit,
                excludeExampleIds: [ex.id],
                knownSubCustomers: cust?.known_sub_customers ?? "",
                recordUsage: opts?.recordUsage !== false,
            });
            if (!pred)
                apiErrors++;
        }
        catch (e) {
            readErr = String(e?.message || e).slice(0, 200);
            apiErrors++;
        }
        const sc = scoreOneExample(ex._goldItems, pred || []);
        sumTp += sc.tp;
        sumFp += sc.fp;
        sumFn += sc.fn;
        if (sc.avgQtyRelErr != null) {
            sumQtyErr += sc.avgQtyRelErr * sc.matchedPairs;
            sumQtyN += sc.matchedPairs;
        }
        if (sc.unitMatchRate != null && sc.matchedPairs > 0) {
            sumUnitOk += Math.round(sc.unitMatchRate * sc.matchedPairs);
            sumUnitN += sc.matchedPairs;
        }
        perImage.push({
            exampleId: ex.id,
            customerId: ex.customer_id,
            goldLines: ex._goldItems.length,
            predLines: pred ? pred.length : 0,
            precision: sc.precision,
            recall: sc.recall,
            avgQtyRelErr: sc.avgQtyRelErr,
            unitMatchRate: sc.unitMatchRate,
            readErr,
        });
    }
    const microPrecision = sumTp + sumFp > 0 ? sumTp / (sumTp + sumFp) : golden.length === 0 ? 1 : null;
    const microRecall = sumTp + sumFn > 0 ? sumTp / (sumTp + sumFn) : golden.length === 0 ? 1 : null;
    const microAvgQtyRelErr = sumQtyN > 0 ? sumQtyErr / sumQtyN : null;
    const microUnitMatchRate = sumUnitN > 0 ? sumUnitOk / sumUnitN : null;
    return {
        goldenCount: golden.length,
        promptVersionId: resolvedPv,
        modelLabel: modelName || "(環境預設 GEMINI_MODEL_VISION)",
        fewShotStrategy,
        exampleLimit,
        microPrecision,
        microRecall,
        microAvgQtyRelErr,
        microUnitMatchRate,
        apiErrors,
        perImage,
        sumTp,
        sumFp,
        sumFn,
    };
}
