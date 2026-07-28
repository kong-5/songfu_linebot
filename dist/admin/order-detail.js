"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerOrderDetailRoutes = registerOrderDetailRoutes;

// 訂單明細頁域（/orders/:orderId 明細與對話檢視、附件·OCR 框、重新辨識、few-shot 範例、
// 品項搬移·依子客戶拆單、凌越 preview/transfer）路由：自 index.js 拆出（拆檔批次 5），純搬移、行為不變。

const express_1 = { default: require("express") };
const id_js_1 = require("../lib/id.js");
const erp_companies_js_1 = require("../lib/erp-companies.js");
const resolve_product_js_1 = require("../lib/resolve-product.js");
const vision_ocr_js_1 = require("../lib/vision-ocr.js");
const order_split_js_1 = require("../lib/order-split.js");
const few_shot_example_save_js_1 = require("../lib/few-shot-example-save.js");
const line_conversation_js_1 = require("../lib/line-conversation.js");
const order_history_items_js_1 = require("../lib/order-history-items.js");
const empty_baskets_js_1 = require("../lib/empty-baskets.js");
const { SF_ICONS, sfInlineIcon, escapeHtml, escapeAttr, escJsStr } = require("./_shared.js");

function registerOrderDetailRoutes(router, ctx) {
    // [fix 2026-07-28 §二B1] logDataChange 早就在 ORDERS_CTX，但本域一直沒解構使用——
    // 導致 re-recognize（整單品項 DELETE+INSERT）、旋轉重辨識、轉入凌越（在 ERP 產生真實單據）
    // 三個破壞性/對外操作全無稽核軌跡。補上。
    const { db, notionPage, loadAdminUsers, logDataChange, getTaipeiCalendarDateYYYYMMDD, fmtTaipeiYMDHM, voidReasonModalHtml, buildLingyuePreview, runLingyueWrite, rebuildOrderItemsForReRecognize, parseKnownSubCustomerLabelsForSelect, resolveSplitTargetOrder, ORDER_LINE_UNITS } = ctx;
    router.post("/orders/:orderId/lingyue-preview", async (req, res) => {
        try {
            const order = await db.prepare(`
        SELECT o.id, o.order_no, o.order_date, o.remark, c.name AS customer_name, c.hq_cust_code, c.teraoka_code
        FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?
      `).get(req.params.orderId);
            if (!order) {
                res.status(404).json({ ok: false, error: "訂單不存在" });
                return;
            }
            const preview = await buildLingyuePreview(order);
            res.json({ ok: true, ...preview });
        }
        catch (e) {
            console.error("[admin] lingyue-preview", e?.message || e);
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
        }
    });
    // 轉入凌越：實際寫入（需在有凌越內網＋ly_datain 的機器，由 LINGYUE_WRITE_CMD 指定橋接）。
    router.post("/orders/:orderId/lingyue-transfer", async (req, res) => {
        try {
            const order = await db.prepare(`
        SELECT o.id, o.order_no, o.order_date, o.remark, o.lingyue_doc_no,
               o.lingyue_claimed_at, o.lingyue_written_at,
               c.name AS customer_name, c.hq_cust_code, c.teraoka_code
        FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?
      `).get(req.params.orderId);
            if (!order) {
                res.status(404).json({ ok: false, error: "訂單不存在" });
                return;
            }
            const actor = req.adminUsername || "";
            const force = req.query.force === "1" || req.query.force === "true";
            // 已轉入且未帶 force → 要求確認：重轉會在凌越產生新單，舊單不會自動刪，須先手動刪除舊單。
            if (order.lingyue_doc_no && !force) {
                res.json({
                    ok: false, needConfirm: true, doc_no: order.lingyue_doc_no,
                    message: `此單已轉入凌越（單號 ${order.lingyue_doc_no}）。\n\n重新轉入會在凌越「產生一張新單」，舊單 ${order.lingyue_doc_no} 不會自動刪除。\n請先到凌越把舊單 ${order.lingyue_doc_no} 刪除，再按「確定」重新轉入。\n\n確定要重新轉入嗎？`,
                });
                return;
            }
            // [fix 2026-07-14] 內網 agent 正在寫入中（已認領、租約未過、單號尚未回填）時，重按「轉入凌越」
            // 會清掉 claimed_at 重新排隊 → 第二條 /wait 再認領再寫 → 凌越兩張單。改成先要求確認。
            // 租約時長與 /wait 的 LEASE_MS 一致（10 分鐘）。
            if (!force && !order.lingyue_doc_no && !order.lingyue_written_at && order.lingyue_claimed_at) {
                const claimedMs = Date.parse(String(order.lingyue_claimed_at));
                if (Number.isFinite(claimedMs) && Date.now() - claimedMs < 600000) {
                    res.json({
                        ok: false, needConfirm: true,
                        message: "內網小幫手已認領此單、正在寫入凌越（通常數十秒內回填單號）。\n\n現在重新排隊可能造成凌越「重複開單」。\n建議稍等 1～2 分鐘再重整頁面確認；若確定內網代理已中斷，再按「確定」重新排隊。",
                    });
                    return;
                }
            }
            const preview = await buildLingyuePreview(order);
            if (!preview.items.length) {
                res.json({ ok: false, error: "此訂單無可轉入品項" });
                return;
            }
            // [fix 2026-07-08] 缺料號整單拒寫（老闆決策）：任一品項無凌越料號就不排隊/不寫入，
            // 直接回報請先補料號。放在轉入入口＝單一把關點，直寫與佇列兩條路徑都涵蓋，也避免被拒單在佇列無限重試。
            if (preview.missing_count > 0) {
                const missNames = preview.items.filter((i) => !i.product_code).map((i) => i.product_name).filter(Boolean);
                res.json({
                    ok: false,
                    error: `有 ${preview.missing_count} 項無凌越料號，請先到品項主檔補上料號再轉入：${missNames.slice(0, 5).join("、")}${missNames.length > 5 ? " 等" : ""}`,
                });
                return;
            }
            const writeCmd = (process.env.LINGYUE_WRITE_CMD || "").trim();
            if (!writeCmd) {
                // 這台沒接凌越橋接（雲端 Cloud Run 打不進內網）→ 標記排隊，由內網 agent 長連線等待後寫入。
                // 清掉舊單號／回寫時間（重轉時），讓 /wait 重新撿到；記錄是誰轉的。
                const now = new Date().toISOString();
                await db.prepare("UPDATE orders SET lingyue_queued_at = ?, lingyue_queued_by = ?, lingyue_doc_no = NULL, lingyue_written_at = NULL, lingyue_claimed_at = NULL, lingyue_write_attempts = 0, lingyue_last_error = NULL WHERE id = ?").run(now, actor, order.id);
                // [fix 2026-07-28 §二B1] 排入凌越佇列留稽核（含是否重轉、被清掉的舊單號）
                try {
                    await logDataChange(req, {
                        entityType: "order",
                        entityId: order.id,
                        action: "lingyue_queue",
                        summary: `排入凌越回寫佇列 ${order.order_no || order.id}（${preview.items.length} 項）${order.lingyue_doc_no ? "，重轉前舊單號 " + order.lingyue_doc_no : ""}`,
                        meta: { force, prev_doc_no: order.lingyue_doc_no || null, items: preview.items.length },
                    });
                } catch (_) { /* 稽核失敗不影響主流程 */ }
                res.json({ ok: true, queued: true, message: "已排入凌越匯入佇列，內網小幫手會在數秒內寫入並回填單號。", ...preview });
                return;
            }
            const payload = JSON.stringify({
                icpno: process.env.LY_ICPNO || "00",
                warehouse: process.env.LY_DEFAULT_WHNO || "",
                price: process.env.LY_DEFAULT_PRICE || "",
                order: preview,
            });
            const result = await runLingyueWrite(writeCmd, payload);
            if (result && result.ok && result.doc_no) {
                const now = new Date().toISOString();
                await db.prepare("UPDATE orders SET lingyue_doc_no = ?, lingyue_written_at = ?, lingyue_queued_by = ? WHERE id = ?").run(String(result.doc_no), now, actor, order.id);
                // [fix 2026-07-28 §二B1] 直寫凌越（在 ERP 產生真實單據）留稽核
                try {
                    await logDataChange(req, {
                        entityType: "order",
                        entityId: order.id,
                        action: "lingyue_write",
                        summary: `直接寫入凌越 ${order.order_no || order.id} → 單號 ${result.doc_no}（${preview.items.length} 項）${order.lingyue_doc_no ? "，重轉前舊單號 " + order.lingyue_doc_no : ""}`,
                        meta: { force, doc_no: String(result.doc_no), prev_doc_no: order.lingyue_doc_no || null, items: preview.items.length },
                    });
                } catch (_) { /* 稽核失敗不影響主流程 */ }
                res.json({ ok: true, doc_no: result.doc_no });
            }
            else {
                res.json({ ok: false, error: (result && result.error) || "凌越寫入失敗" });
            }
        }
        catch (e) {
            console.error("[admin] lingyue-transfer", e?.message || e);
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
        }
    });
    router.get("/orders/:orderId", async (req, res) => {
        const { orderId } = req.params;
        const backTo = (typeof req.query.back === "string" && req.query.back.startsWith("/admin/orders"))
            ? req.query.back
            : "/admin/orders?date_from=" + encodeURIComponent(getTaipeiCalendarDateYYYYMMDD()) + "&date_to=" + encodeURIComponent(getTaipeiCalendarDateYYYYMMDD());
        const order = await db.prepare(`
      SELECT o.id, o.order_no, o.order_date, o.status, o.updated_at, o.raw_message, o.customer_id,
             o.voided_at, o.voided_by, o.void_reason, o.void_note,
             o.lingyue_doc_no, o.lingyue_written_at, o.lingyue_queued_by,
             c.name AS customer_name, c.teraoka_code AS customer_teraoka_code, c.known_sub_customers
      FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.id = ?
    `).get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        // 只取有效（未作廢）的品項
        const items = await db.prepare(`
      SELECT oi.id AS item_id, oi.raw_name, oi.quantity, oi.unit, oi.remark, oi.display_order, oi.need_review, oi.sub_customer, oi.confidence_score,
        p.id AS product_id, p.erp_code, p.name AS product_name, p.unit AS product_unit
      FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ? AND oi.voided_at IS NULL
      ORDER BY COALESCE(oi.display_order, 999999), oi.id
    `).all(orderId);
        // 已作廢品項另外列出（供 AI 學習參考與內稽追溯）
        const voidedItems = await db.prepare(`
      SELECT oi.id AS item_id, oi.raw_name, oi.quantity, oi.unit, oi.product_id, oi.voided_at, oi.voided_by, oi.void_reason, oi.void_note,
        p.name AS product_name, p.erp_code
      FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ? AND oi.voided_at IS NOT NULL
      ORDER BY oi.voided_at DESC, oi.id
    `).all(orderId);
        const attachments = await db.prepare("SELECT id, line_message_id FROM order_attachments WHERE order_id = ?").all(orderId);
        // 新增品項推薦：此客戶歷史最常叫的品項（排除本單已有的），做成快速標籤
        let frequentProducts = [];
        if (order.customer_id) {
            const existingPids = new Set(items.filter((i) => i.product_id).map((i) => String(i.product_id)));
            const freqRows = await db.prepare(`
      SELECT p.id AS id, p.name AS name, p.erp_code AS erp_code, COUNT(*) AS cnt
      FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
      WHERE o.customer_id = ? AND oi.product_id IS NOT NULL AND oi.voided_at IS NULL AND o.voided_at IS NULL
      GROUP BY p.id, p.name, p.erp_code
      ORDER BY cnt DESC, p.name
      LIMIT 20
    `).all(order.customer_id);
            frequentProducts = (freqRows || []).filter((fp) => !existingPids.has(String(fp.id))).slice(0, 10);
        }
        // 連線對照：把每個品項的 raw_name 在原始文字中的實際位置框出來（<mark>），
        // 連線只連到「那個詞」而非整句/整行；沒對應到的品項就不畫線。長名先配對避免被短名吃掉。
        const rawTextForMatch = (order.raw_message || "").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && l !== "[圖片]").join("\n");
        const buildRawMatchHtml = (rawText, itemList, alreadyMatched) => {
            // alreadyMatched（可選 Set）：逐則訊息渲染對話時共用，讓每個品項只在第一次出現的訊息上錨點，
            // 避免同一 item_id 產生重複 DOM id 造成連線對照錯亂。
            const matchedSet = alreadyMatched || new Set();
            if (!rawText) return "";
            const normChar = (ch) => (/[\s,，、。.·:：*xX╳＊()（）]/.test(ch) ? "" : ch.toLowerCase());
            const normArr = [];
            const idxMap = [];
            for (let i = 0; i < rawText.length; i++) {
                const nc = normChar(rawText[i]);
                if (nc) { normArr.push(nc); idxMap.push(i); }
            }
            const normStr = normArr.join("");
            const used = new Array(normStr.length).fill(false);
            const ranges = [];
            const order2 = itemList
                .map((it, i) => ({ it, i, n: String(it.raw_name || "").split("").map(normChar).join("") }))
                .filter((x) => x.n.length >= 1 && !matchedSet.has(x.it.item_id))
                .sort((a, b) => (b.n.length - a.n.length) || (a.i - b.i));
            const unmatched = [];
            // 第一輪：精確子字串（原文完整含品項名）
            for (const { it, n } of order2) {
                let from = 0, pos = -1;
                while (true) {
                    const p = normStr.indexOf(n, from);
                    if (p < 0) break;
                    let occ = false;
                    for (let k = p; k < p + n.length; k++) { if (used[k]) { occ = true; break; } }
                    if (!occ) { pos = p; break; }
                    from = p + 1;
                }
                if (pos < 0) { unmatched.push({ it, n }); continue; }
                for (let k = pos; k < pos + n.length; k++) used[k] = true;
                ranges.push({ start: idxMap[pos], end: idxMap[pos + n.length - 1] + 1, itemId: it.item_id });
                matchedSet.add(it.item_id);
            }
            // 第二輪：最長連續共同子字串退路（品項名有夾字/括號描述時，仍連到重疊的那段）。
            // 門檻：重疊長度 ≥ max(2, 品項名一半) 才連，避免亂連。
            const lcsSubstr = (name, ns, usedArr) => {
                const N = name.length, M = ns.length;
                let best = { start: -1, end: -1, len: 0 };
                const dp = new Array(M + 1).fill(0);
                for (let i = 1; i <= N; i++) {
                    let prev = 0;
                    for (let j = 1; j <= M; j++) {
                        const tmp = dp[j];
                        if (name[i - 1] === ns[j - 1] && !usedArr[j - 1]) {
                            dp[j] = prev + 1;
                            if (dp[j] > best.len) best = { len: dp[j], end: j, start: j - dp[j] };
                        }
                        else dp[j] = 0;
                        prev = tmp;
                    }
                }
                return best.len > 0 ? best : null;
            };
            for (const { it, n } of unmatched) {
                if (n.length < 2) continue;
                const m = lcsSubstr(n, normStr, used);
                if (!m) continue;
                if (m.len < Math.max(2, Math.ceil(n.length * 0.5))) continue;
                for (let k = m.start; k < m.end; k++) used[k] = true;
                ranges.push({ start: idxMap[m.start], end: idxMap[m.end - 1] + 1, itemId: it.item_id });
                matchedSet.add(it.item_id);
            }
            ranges.sort((a, b) => a.start - b.start);
            let html = "", cur = 0;
            for (const r of ranges) {
                if (r.start < cur) continue;
                html += escapeHtml(rawText.slice(cur, r.start));
                html += `<mark class="raw-match" data-item-id="${escapeAttr(String(r.itemId))}" id="rawmatch-${escapeAttr(String(r.itemId))}">${escapeHtml(rawText.slice(r.start, r.end))}</mark>`;
                cur = r.end;
            }
            html += escapeHtml(rawText.slice(cur));
            return html;
        };
        const rawMatchHtml = buildRawMatchHtml(rawTextForMatch, items);
        // 群組對話（含同事回覆）：有紀錄就以聊天式視圖取代純文字，客戶訊息用黃色卡逐則做品項藍底對應，
        // 同事訊息用灰色卡標「姓名（同事）」。舊訂單沒有紀錄則維持原本的 pre 顯示。
        const convoRows = await line_conversation_js_1.getConversationForOrder(db, orderId);
        let convoHtml = "";
        if (convoRows && convoRows.length) {
            const convoMatched = new Set();
            // 對話紀錄可能只掛到同事回覆（例如拆單後的子單、或客戶叫貨訊息未逐則入庫），
            // 若直接以對話取代純文字，叫貨內容會整段消失。先把「對話沒涵蓋到的訂單全文行」
            // 補成一張客戶卡放最前面；錨點與逐則對話共用同一個 Set，避免重複 DOM id 弄亂連線。
            const normForCover = (s) => String(s || "").replace(/[\s,，、。.·:：*xX╳＊()（）]/g, "").toLowerCase();
            const customerJoined = normForCover(convoRows.filter((m) => String(m.sender_kind) !== "employee").map((m) => m.text || "").join("\n"));
            const missingLines = rawTextForMatch.split("\n").filter((l) => l.trim() && !customerJoined.includes(normForCover(l)));
            let missingCard = "";
            if (missingLines.length) {
                const missingBody = buildRawMatchHtml(missingLines.join("\n"), items, convoMatched);
                missingCard = `<div style="background:#fffbeb;border:1px solid #fde68a;border-left:3px solid #d97706;border-radius:8px;padding:7px 10px;">
                  <div style="font-size:11px;color:#92400e;font-weight:700;margin-bottom:2px;">${sfInlineIcon("doc")} 客戶叫貨內容<span style="font-weight:400;color:#b45309;margin-left:6px;">（取自訂單全文，對話紀錄未逐則記錄）</span></div>
                  <div style="font-size:13px;line-height:1.7;white-space:pre-wrap;word-break:break-word;color:#78350f;">${missingBody}</div>
                </div>`;
            }
            convoHtml = missingCard + convoRows.map((m) => {
                const full = fmtTaipeiYMDHM(m.created_at) || "";
                const timeShort = full.length >= 16 ? full.slice(11, 16) : full;
                if (String(m.sender_kind) === "employee") {
                    return `<div style="background:#f3f4f6;border:1px solid #e5e7eb;border-left:3px solid #9ca3af;border-radius:8px;padding:7px 10px;">
                      <div style="font-size:11px;color:#4b5563;font-weight:700;margin-bottom:2px;">${sfInlineIcon("user")} ${escapeHtml(m.sender_name || "同事")}<span style="font-weight:600;">（同事）</span><span style="font-weight:400;color:#6b7280;margin-left:6px;" title="${escapeAttr(full)}">${escapeHtml(timeShort)}</span></div>
                      <div style="font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-word;color:#374151;">${escapeHtml(m.text || "")}</div>
                    </div>`;
                }
                const matchedBody = buildRawMatchHtml(String(m.text || ""), items, convoMatched);
                return `<div style="background:#fffbeb;border:1px solid #fde68a;border-left:3px solid #d97706;border-radius:8px;padding:7px 10px;">
                  <div style="font-size:11px;color:#92400e;font-weight:700;margin-bottom:2px;">${escapeHtml(m.sender_name || "客戶")}<span style="font-weight:400;color:#b45309;margin-left:6px;" title="${escapeAttr(full)}">${escapeHtml(timeShort)}</span></div>
                  <div style="font-size:13px;line-height:1.7;white-space:pre-wrap;word-break:break-word;color:#78350f;">${matchedBody}</div>
                </div>`;
            }).join("");
        }
        // 供照片辨識框比對：本單所有品項的原始名稱（用來把 Vision 偵測到的詞上綠框）
        const ocrItemNamesJson = JSON.stringify(items.map((i) => String(i.raw_name || "")).filter(Boolean)).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
        const needReviewCount = items.filter((i) => i.need_review === 1).length;
        const lowConfThreshold = Number(process.env.ADMIN_CONFIDENCE_REVIEW_THRESHOLD || 70);
        const lowConfCount = items.filter((i) => {
            if (i.need_review === 1)
                return false;
            const c = i.confidence_score;
            return c != null && Number(c) < lowConfThreshold;
        }).length;
        // G21：產品公斤計價 vs 辨識成非公斤單位的計數
        const normalizeUnitForKgCheckTop = (u) => {
            const s = String(u || "").trim().toLowerCase().replace(/\s+/g, "");
            if (!s) return "";
            if (s === "公斤" || s === "kg" || s === "k") return "公斤";
            return s;
        };
        const unitMismatchCount = items.filter((i) => {
            if (i.need_review === 1) return false;
            const pu = normalizeUnitForKgCheckTop(i.product_unit);
            const ou = normalizeUnitForKgCheckTop(i.unit);
            return pu === "公斤" && ou && ou !== "公斤";
        }).length;
        // 備註警示（remark 以「⚠」開頭）計數
        const remarkWarnCount = items.filter((i) => {
            const rt = (i.remark && String(i.remark).trim()) || "";
            return rt.startsWith("⚠");
        }).length;
        // 「待確認」的統一判定：待對應（need_review／product_id NULL）／低信心／單位非公斤／備註警示，任一即算。
        // 逐品項只計一次（need_review 優先短路），reviewFlaggedCount 為需人工核對的「品項數」。
        const isItemFlaggedForReview = (i) => {
            if (i.need_review === 1)
                return true;
            const c = i.confidence_score;
            if (c != null && Number.isFinite(Number(c)) && Number(c) < lowConfThreshold)
                return true;
            const pu = normalizeUnitForKgCheckTop(i.product_unit);
            const ou = normalizeUnitForKgCheckTop(i.unit);
            if (pu === "公斤" && ou && ou !== "公斤")
                return true;
            const rt = (i.remark && String(i.remark).trim()) || "";
            if (rt.startsWith("⚠"))
                return true;
            return false;
        };
        const reviewFlaggedCount = items.filter(isItemFlaggedForReview).length;
        // [2026-07-10] 舊的三段 note（needReviewNote／lowConfNote／unitMismatchNote）已移除：
        // 這些「X 項待確認／低信心／單位非公斤」的資訊已完整彙整進下方「審核焦點列」的膠囊
        // （待對應／低信心／單位非公斤／備註警示），保留兩套會出現「同頁兩個待確認數字打架」，故只留焦點列。
        // 並排審核焦點列：置於「解析明細」欄頂部，一句話交代本單共幾項、其中幾項需複核（傘狀彙總），
        // 並提供「只看需複核」開關（.sf-switch，前端過濾，不動排序／不改後端）。深色安全：用 CSS 變數＋既有 pill。
        const reviewBreakdownPills = [
            needReviewCount > 0 ? `<span class="sf-pill warn" title="尚未對應到貨品主檔，需人工指定品項">${escapeHtml(String(needReviewCount))} 待對應</span>` : "",
            lowConfCount > 0 ? `<span class="sf-pill bad" title="辨識信心低於 ${lowConfThreshold} 分">${escapeHtml(String(lowConfCount))} 低信心</span>` : "",
            unitMismatchCount > 0 ? `<span class="sf-pill warn" title="貨品主檔以公斤計價、卻辨識成非公斤單位">${escapeHtml(String(unitMismatchCount))} 單位非公斤</span>` : "",
            remarkWarnCount > 0 ? `<span class="sf-pill warn" title="AI 於備註標了「⚠」警示">${escapeHtml(String(remarkWarnCount))} 備註警示</span>` : "",
        ].filter(Boolean).join("");
        const reviewFocusBarHtml = `
              <div class="order-review-focus" style="margin:0 0 12px;padding:10px 12px;background:var(--bg-2);border:1px solid var(--line);border-radius:8px;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;">
                <span style="display:inline-flex;align-items:center;gap:6px;font-size:13.5px;color:var(--txt-1);">
                  ${reviewFlaggedCount > 0 ? SF_ICONS.warn : SF_ICONS.check}
                  <span>本單 <strong>${items.length}</strong> 項${reviewFlaggedCount > 0
            ? `，其中 <strong style="color:var(--warn);font-size:15px;">${reviewFlaggedCount}</strong> 項需複核`
            : `<span style="color:var(--txt-3);margin-left:4px;">・辨識良好，無需複核</span>`}</span>
                </span>
                ${reviewBreakdownPills ? `<span style="display:inline-flex;flex-wrap:wrap;gap:6px;align-items:center;">${reviewBreakdownPills}</span>` : ""}
                ${reviewFlaggedCount > 0
            ? `<label class="sf-switch-label" style="margin-left:auto;" title="只顯示需複核（待對應／低信心／單位非公斤／備註警示）的品項（僅前端過濾，不影響排序與儲存）"><input type="checkbox" id="reviewOnlyToggle"><span class="sf-switch"></span>只看需複核</label>`
            : ""}
              </div>`;
        const prevOrder = await db.prepare(`
      SELECT id FROM orders
      WHERE (order_date > ? OR (order_date = ? AND id > ?))
      ORDER BY order_date ASC, id ASC
      LIMIT 1
    `).get(order.order_date, order.order_date, order.id);
        const nextOrder = await db.prepare(`
      SELECT id FROM orders
      WHERE (order_date < ? OR (order_date = ? AND id < ?))
      ORDER BY order_date DESC, id DESC
      LIMIT 1
    `).get(order.order_date, order.order_date, order.id);
        const units = ORDER_LINE_UNITS;
        const unitOptions = units.map((u) => `<option value="${escapeAttr(u)}">${escapeHtml(u)}</option>`).join("");
        const itemsRows = items
            .map((i, idx) => {
            const q = Number(i.quantity);
            const u = (i.unit && i.unit.trim()) || "";
            // 品項標準單位（ERP 主檔單位）：沒帶單位時預設帶它，並把「標準單位＋公斤」排最前，減少手動選擇
            const stdUnit = (i.product_unit && String(i.product_unit).trim()) || "";
            const effU = u || stdUnit;
            const unitOrdered = [];
            const unitSeen = new Set();
            const pushUnitOpt = (x) => { const t = (x == null ? "" : String(x)).trim(); if (t && !unitSeen.has(t)) { unitSeen.add(t); unitOrdered.push(t); } };
            pushUnitOpt(stdUnit);
            pushUnitOpt("公斤");
            // 有標準單位（凌越主檔）的品項：下拉收斂為「標準單位＋公斤＋現值」；沒有標準單位才列完整清單
            if (!stdUnit) units.forEach(pushUnitOpt);
            pushUnitOpt(effU);
            const unitSelect = `<select name="unit_${i.item_id}" form="itemsForm">${unitOptions}</select>`;
            const unitSelectWithVal = `<select name="unit_${i.item_id}" form="itemsForm"><option value="">—</option>${unitOrdered.map((x) => `<option value="${escapeAttr(x)}" ${x === effU ? "selected" : ""}>${escapeHtml(x)}</option>`).join("")}</select>`;
            const erp = i.erp_code ?? "—";
            const pname = i.product_name ? escapeHtml(i.product_name) : "";
            const pid = i.product_id ? String(i.product_id) : "";
            const nameEditLink = pid && pname
                ? `<a href="#" class="product-name-edit" data-product-id="${escapeAttr(pid)}" title="編輯此品項（俗名、單位等）">${pname}</a>`
                : pname;
            const confRaw = i.confidence_score;
            const conf = confRaw != null && Number.isFinite(Number(confRaw)) ? Number(confRaw) : null;
            let confPill = "";
            if (i.need_review !== 1) {
                if (conf == null) {
                    confPill = `<span class="conf-pill conf-none" title="未提供信心分數">—</span>`;
                }
                else if (conf >= 80) {
                    confPill = `<span class="conf-pill conf-high" title="辨識信心高（${conf}/100）">${conf}</span>`;
                }
                else if (conf >= lowConfThreshold) {
                    confPill = `<span class="conf-pill conf-mid" title="辨識信心中（${conf}/100）">${conf}</span>`;
                }
                else {
                    confPill = `<span class="conf-pill conf-low" title="辨識信心低（${conf}/100），建議核對">${conf}</span>`;
                }
            }
            // G21：產品本身以「公斤」計價 但辨識成非公斤單位 → 加黃底警示
            // 正規化：公斤 / kg / KG / Kg / k / K 一律視為公斤；其餘（件/包/條/顆/把/斤/盒/箱/個…）視為非公斤
            const normalizeUnitForKgCheck = (u) => {
                const s = String(u || "").trim().toLowerCase().replace(/\s+/g, "");
                if (!s) return "";
                if (s === "公斤" || s === "kg" || s === "k") return "公斤";
                return s;
            };
            const productUnitNorm = normalizeUnitForKgCheck(i.product_unit);
            const itemUnitNorm = normalizeUnitForKgCheck(i.unit);
            const isUnitMismatchKg = i.need_review !== 1 && productUnitNorm === "公斤" && itemUnitNorm && itemUnitNorm !== "公斤";
            const unitMismatchBadge = isUnitMismatchKg
                ? `<span class="unit-mismatch-badge" title="此品項在貨品主檔以「公斤」計價，但這張單辨識成「${escapeHtml(i.unit || "")}」。請確認後修改單位／數量。">⚠ 單位非公斤</span>`
                : "";
            // remark 以「⚠」開頭＝AI 標記警示（如照片辨識幾何校驗「⚠ 字跡跨列（A/B），請確認」）
            // → 品名旁琥珀徽章（沿用 unit-mismatch-badge 樣式）＋整列淡黃底（order-item-remark-warn）
            const remarkTrimmed = (i.remark && String(i.remark).trim()) || "";
            const isRemarkWarn = remarkTrimmed.startsWith("⚠");
            const remarkWarnBadge = isRemarkWarn
                ? `<span class="unit-mismatch-badge" title="${escapeAttr(remarkTrimmed)}">⚠ ${escapeHtml(remarkTrimmed.replace(/^⚠\s*/, "").split(/[，,；;\n]/)[0].slice(0, 20) || "備註警示")}</span>`
                : "";
            const productCell = i.need_review === 1
                ? `<a href="#" class="product-pick need-review" data-item-id="${escapeAttr(i.item_id)}" data-raw="${escapeAttr(i.raw_name || "")}">待對應</a>${remarkWarnBadge}`
                : `<span class="order-final-product">${nameEditLink}</span>${confPill}${unitMismatchBadge}${remarkWarnBadge} <a href="#" class="product-pick product-change" data-item-id="${escapeAttr(i.item_id)}">改品項</a>`;
            const remarkVal = (i.remark && i.remark.trim()) ? escapeAttr(i.remark.trim()) : "";
            const subCustomerVal = (i.sub_customer && String(i.sub_customer).trim()) ? escapeAttr(String(i.sub_customer).trim()) : "";
            const isLowConf = i.need_review !== 1 && conf != null && conf < lowConfThreshold;
            let rowClasses = "";
            if (i.need_review === 1) rowClasses = "order-item-need-review";
            else if (isLowConf) rowClasses = "order-item-low-conf";
            if (isUnitMismatchKg) rowClasses = rowClasses ? (rowClasses + " order-item-unit-mismatch") : "order-item-unit-mismatch";
            if (isRemarkWarn) rowClasses = rowClasses ? (rowClasses + " order-item-remark-warn") : "order-item-remark-warn";
            // 待確認旗標（供「只看待確認」開關前端過濾）：待對應／低信心／單位非公斤／備註警示任一即為 1
            const isReviewFlag = i.need_review === 1 || isLowConf || isUnitMismatchKg || isRemarkWarn;
            const rawCard = `${idx + 1}. 原始：${String(i.raw_name ?? "").trim() || "—"} ${String(q)}${(i.unit && i.unit.trim()) || ""}`;
            return `<tr data-item-id="${escapeAttr(i.item_id)}" data-raw-name="${escapeAttr(i.raw_name ?? "")}" data-line-unit="${escapeAttr((i.unit && i.unit.trim()) || "")}" data-raw-card="${escapeAttr(rawCard)}" data-review-flag="${isReviewFlag ? "1" : "0"}" class="${escapeAttr(rowClasses)}">
            <td class="order-detail-col-cb"><input type="checkbox" class="item-select-cb" name="selected_items" value="${escapeAttr(i.item_id)}"></td>
            <td class="order-detail-col-sort">
              <span class="item-sort-stack">
                <button type="button" class="btn btn-move-up" title="上移">↑</button>
                <button type="button" class="btn btn-move-down" title="下移">↓</button>
              </span>
            </td>
            <td class="order-detail-col-idx"><span class="order-detail-idx-num">${idx + 1}</span></td>
            <td class="order-table-col-system"><span class="order-final-erp">${escapeHtml(erp)}</span></td>
            <td>${productCell}</td>
            <td><input type="number" inputmode="decimal" class="order-detail-qty-input" name="qty_${i.item_id}" form="itemsForm" value="${escapeAttr(String(q))}" step="any" min="0"></td>
            <td>${unitSelectWithVal}</td>
            <td><input type="text" name="sub_customer_${i.item_id}" form="itemsForm" value="${subCustomerVal}" placeholder="子客戶" style="width:100%;max-width:7rem;"></td>
            <td><input type="text" name="remark_${i.item_id}" form="itemsForm" value="${remarkVal}" placeholder="備註" style="width:100%;max-width:100px;"></td>
            <td><span class="row-act-stack"><button type="button" class="btn item-insert-btn" data-item-id="${escapeAttr(i.item_id)}" data-item-idx="${idx + 1}" title="在第 ${idx + 1} 項下方插入品項（補漏辨識）" aria-label="在此項下方插入品項">＋</button><button type="button" class="btn btn-delete-item order-del-btn order-del-btn-icon" data-item-id="${escapeAttr(i.item_id)}" data-order-id="${escapeAttr(orderId)}" data-raw-name="${escapeAttr(i.raw_name || "")}" title="作廢此列（保留稽核紀錄、可納入 AI 學習）" aria-label="作廢此列">⊘</button></span></td>
          </tr>`;
        })
            .join("");
        const subCustomerLabels = parseKnownSubCustomerLabelsForSelect(order.known_sub_customers);
        const subCustomerSelectOpts = [
            `<option value="">主客戶（未分拆／預設）</option>`,
            ...subCustomerLabels.map((l) => `<option value="${escapeAttr(l)}">${escapeHtml(l)}</option>`),
            `<option value="__custom__">自訂名稱…</option>`,
        ].join("");
        const batchMoveBarHtml = `
            <div class="order-batch-move-bar" style="margin:0 0 12px;padding:10px 12px;background:var(--notion-sidebar);border-radius:6px;border:1px solid var(--notion-border);display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
              <span style="font-weight:600;font-size:13px;">手動拆併單</span>
              <label style="margin:0;display:flex;align-items:center;gap:6px;font-size:13px;">
                <span>目標子客戶</span>
                <select id="target_sub_customer" style="min-width:11rem;padding:4px 8px;">${subCustomerSelectOpts}</select>
              </label>
              <input type="text" id="target_sub_customer_custom" placeholder="選「自訂」或額外輸入正式名稱" style="min-width:12rem;max-width:20rem;padding:4px 8px;" />
              <button type="button" id="btn_move_items" class="btn btn-primary">轉移選取品項</button>
              <button type="button" id="btn_split_by_subcust" class="btn" title="把有填「子客戶」的品項各自拆成獨立訂單（每個子客戶一筆），並自動補該路線空籃；審核時就是分開的兩筆單">依子客戶拆單</button>
              <span id="move_items_status" style="font-size:12px;color:var(--notion-text-secondary);"></span>
            </div>`;
        const orderStatusLc = String(order.status || "").toLowerCase();
        const orderStatusDisplay = orderStatusLc === "approved" ? "已確認" : orderStatusLc === "pending" ? "待確認" : orderStatusLc === "deleted" ? "已作廢" : orderStatusLc === "complaint" ? "客訴" : escapeHtml(String(order.status || ""));
        const confirmOrderFormHtml = orderStatusLc === "approved"
            ? `<form method="post" action="/admin/orders/${encodeURIComponent(orderId)}/unapprove?back=${encodeURIComponent(backTo)}" id="approveOrderForm" style="display:inline;margin:0;flex:0 0 auto;"><button type="submit" class="btn btn-cute-approve" title="再按一次可撤銷確認" onclick="return confirm('確定要撤銷確認？訂單將恢復為待確認。');">已確認</button></form>`
            : `<form method="post" action="/admin/orders/${encodeURIComponent(orderId)}/approve?back=${encodeURIComponent(backTo)}" id="approveOrderForm" style="display:inline;margin:0;flex:0 0 auto;" title="確認後回訂單列表"><button type="submit" class="btn btn-cute-approve">確認</button></form>`;
        const toComplaintFormHtml = orderStatusLc === "complaint" || orderStatusLc === "deleted"
            ? ""
            : `<button type="button" id="btnToComplaint" data-order-id="${escapeAttr(orderId)}" class="sf-btn sm" title="此筆其實是客訴而非訂單，按下將轉入客訴處理流程（轉完留在本頁，不跳轉）" style="color:#c2410c;border-color:#fed7aa;">⚠ 轉為客訴</button>`;
        const statusPillCls = orderStatusLc === "approved" ? "ok" : orderStatusLc === "deleted" ? "bad" : orderStatusLc === "complaint" ? "bad" : "warn";
        // 訂貨日（系統紀錄時間） - 取 updated_at 的前 16 字（YYYY-MM-DD HH:mm）
        const orderReceivedAt = fmtTaipeiYMDHM(order.updated_at);
        // 凌越轉入者 email → 顯示名字
        let queuedByDisplay = order.lingyue_queued_by ? String(order.lingyue_queued_by) : "";
        if (order.lingyue_queued_by) {
            try {
                const hit = (await loadAdminUsers()).find((u) => String(u.username).toLowerCase() === String(order.lingyue_queued_by).toLowerCase());
                if (hit) queuedByDisplay = hit.name || queuedByDisplay;
            } catch (_) { /* 讀不到就用原字串 */ }
        }
        // 出貨日短格式：M/D（週幾），主視覺用；完整 ISO 放 title 供對照
        const orderDateShort = (() => {
            const mm = String(order.order_date || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (!mm) return order.order_date || "—";
            // [fix 2026-07-08] Date.UTC + getUTCDay，避免 UTC 伺服器上星期差一天
            const dt = new Date(Date.UTC(Number(mm[1]), Number(mm[2]) - 1, Number(mm[3])));
            const wd = "日一二三四五六"[dt.getUTCDay()] || "";
            return `${Number(mm[2])}/${Number(mm[3])}` + (wd ? `（${wd}）` : "");
        })();
        // 客戶名 fallback
        const orderCustomerName = (order.customer_name && String(order.customer_name).trim())
            || (order.customer_id ? `客戶 ${String(order.customer_id).slice(0, 6)}` : "（未指定客戶）");
        const hasCustomerName = Boolean(order.customer_name && String(order.customer_name).trim());
        // 出貨日修改成功/失敗訊息
        const dateOkBanner = req.query.ok === "date_saved"
            ? `<div class="sf-pill ok" style="align-self:flex-start;margin-bottom:8px;">✓ 出貨日期已更新</div>`
            : (req.query.ok === "date_unchanged" ? `<div class="sf-pill info" style="align-self:flex-start;margin-bottom:8px;">日期未變動</div>` : "");
        // 作廢資訊（若為已作廢訂單，顯示原因 + 取消作廢按鈕）
        const orderVoidReason = order.void_reason || null;
        const orderVoidLabel = { ai_wrong:"AI 辨識錯誤", customer_complaint:"客訴", customer_cancelled:"客戶取消", duplicate:"重複叫貨", staff_error:"內部錯誤", not_order:"非訂單訊息", other:"其他" }[orderVoidReason] || orderVoidReason;
        const orderVoidedAt = order.voided_at ? fmtTaipeiYMDHM(order.voided_at) : null;
        const isOrderVoided = orderStatusLc === "deleted";
        const body = `
        <div style="padding:20px 24px 0;">
          ${(orderStatusLc === "deleted" || orderStatusLc === "complaint") ? `<div id="orderStatusWm" aria-hidden="true" style="position:fixed;pointer-events:none;overflow:hidden;z-index:3;display:none;"><div id="orderStatusWmInner" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);display:flex;flex-wrap:wrap;gap:34px 70px;align-content:center;justify-content:center;"></div></div><script>(function(){var wm=document.getElementById('orderStatusWm');var inner=document.getElementById('orderStatusWmInner');if(!wm||!inner)return;var txt='${orderStatusLc === "deleted" ? "已作廢" : "客訴"}';var color='${orderStatusLc === "deleted" ? "rgba(220,38,38,0.11)" : "rgba(202,138,4,0.14)"}';var h='';for(var i=0;i<90;i++){h+='<span style="font-size:58px;font-weight:900;letter-spacing:.12em;white-space:nowrap;color:'+color+';">'+txt+'</span>';}inner.innerHTML=h;var anchor=document.querySelector('.notion-main-wrap')||document.querySelector('.notion-main')||document.body;function place(){var r=anchor.getBoundingClientRect();var top=Math.max(0,r.top);wm.style.left=r.left+'px';wm.style.width=r.width+'px';wm.style.top=top+'px';wm.style.height=Math.max(0,window.innerHeight-top)+'px';wm.style.display='block';var d=Math.ceil(Math.sqrt(r.width*r.width+window.innerHeight*window.innerHeight));inner.style.width=d+'px';inner.style.height=d+'px';}place();window.addEventListener('resize',place,{passive:true});window.addEventListener('scroll',place,true);})();</script>` : ""}
          <div class="sf-breadcrumb" style="margin-bottom:6px;"><a href="${escapeAttr(backTo)}">訂單審核</a> · 訂單明細</div>
          ${dateOkBanner}
          ${req.query.ok === "voided" ? `<div class="sf-pill bad" style="align-self:flex-start;margin-bottom:8px;">已作廢此訂單${order.void_reason ? "（"+escapeHtml(orderVoidLabel || "")+"）" : ""}</div>` : ""}
          ${req.query.ok === "unvoided" ? `<div class="sf-pill ok" style="align-self:flex-start;margin-bottom:8px;">已取消作廢，訂單恢復為待確認狀態</div>` : ""}
          ${isOrderVoided ? `
          <div style="background:#fff8e1;border:1px solid #f59e0b;border-radius:8px;padding:10px 14px;margin-bottom:10px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
            <strong style="color:#92400e;">⊘ 此訂單已作廢</strong>
            ${orderVoidLabel ? `<span class="sf-pill warn">${escapeHtml(orderVoidLabel)}</span>` : ""}
            ${order.void_note ? `<span style="font-size:12px;color:var(--txt-2);">${escapeHtml(order.void_note)}</span>` : ""}
            ${orderVoidedAt ? `<span class="mono" style="font-size:11px;color:var(--txt-3);">${escapeHtml(orderVoidedAt)}${order.voided_by?" by "+escapeHtml(order.voided_by):""}</span>` : ""}
            <form method="post" action="/admin/orders/${encodeURIComponent(orderId)}/unvoid${backTo ? "?back=" + encodeURIComponent(backTo) : ""}" style="margin-left:auto;">
              <button type="submit" class="sf-btn sm primary" onclick="return confirm('確定取消作廢並恢復為待確認？');">取消作廢</button>
            </form>
          </div>` : ""}
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">
            <div style="flex:1;min-width:0;">
              <h2 style="margin:0;font-size:20px;font-weight:600;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <a href="/admin/customers/${encodeURIComponent(order.customer_id)}/quick-view?from=orders" style="color:inherit;">${escapeHtml(orderCustomerName)}</a>
                ${hasCustomerName ? "" : `<span class="sf-pill bad" style="font-weight:400;">⚠ 客戶資料缺名稱</span>`}
                <span class="sf-pill ${statusPillCls}">${escapeHtml(orderStatusDisplay)}</span>
                ${order.lingyue_doc_no
                  ? `<span class="sf-pill" style="background:#e0f2f1;color:#00695c;font-weight:700;" title="已轉入凌越${order.lingyue_queued_by ? "，由 " + escapeAttr(queuedByDisplay) + " 轉入" : ""}">↩ 凌越單據號 ${escapeHtml(String(order.lingyue_doc_no))}${order.lingyue_queued_by ? ` <span style="font-weight:400;opacity:.85;">· ${escapeHtml(queuedByDisplay)}</span>` : ""}</span> <button type="button" class="sf-btn sm lingyue-transfer-btn" data-id="${escapeAttr(order.id)}" data-orderno="${escapeAttr(order.order_no || "")}" title="重新轉入凌越（會先提醒你刪除凌越舊單）" style="font-weight:400;">↩ 重新轉入</button>`
                  : `<button type="button" class="sf-btn sm lingyue-transfer-btn" data-id="${escapeAttr(order.id)}" data-orderno="${escapeAttr(order.order_no || "")}" title="轉入凌越（顯示凌越料號並轉入）" style="font-weight:400;">↩ 轉入凌越</button>`}
                ${needReviewCount > 0 ? `<span class="sf-pill warn">${SF_ICONS.warn}<span>${needReviewCount} 待對應</span></span>` : ""}
                ${lowConfCount > 0 ? `<span class="sf-pill bad">${SF_ICONS.warn}<span>${lowConfCount} 低信心</span></span>` : ""}
              </h2>
              <div style="margin-top:8px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;">
                <span style="display:inline-flex;align-items:center;gap:6px;font-size:15px;color:var(--txt-1);">
                  <span style="color:var(--txt-3);">出貨</span>
                  <strong style="font-weight:600;" title="${escapeAttr(order.order_date || "")}">${escapeHtml(orderDateShort)}</strong>
                  <button type="button" class="sf-btn sm ghost" id="orderDateEditToggle" title="修改出貨日" style="padding:2px 7px;color:var(--txt-3);">✎</button>
                </span>
                <span style="font-size:12px;color:var(--txt-3);">
                  訂於 <span class="mono">${escapeHtml(orderReceivedAt)}</span> · <span class="mono">${escapeHtml(order.order_no ?? "—")}</span> · ${escapeHtml(items.length+"")} 項${attachments.length ? " · 圖 "+attachments.length : " · 純文字"}
                </span>
              </div>
              <div id="orderDateEditRow" style="margin-top:8px;display:none;">
                <form method="post" action="/admin/orders/${encodeURIComponent(orderId)}/set-date${backTo ? "?back=" + encodeURIComponent(backTo) : ""}" style="display:inline-flex;gap:6px;align-items:center;margin:0;padding:6px 10px;background:var(--bg-1);border:1px solid var(--line);border-radius:6px;">
                  <span style="font-size:12px;color:var(--txt-2);">改出貨日</span>
                  <input type="date" name="order_date" id="orderEditDate" value="${escapeAttr(order.order_date || "")}" required style="padding:4px 8px;border:1px solid var(--line);border-radius:4px;font-size:13px;font-family:ui-monospace,monospace;width:140px;">
                  <button type="button" class="sf-btn sm" id="orderEditDateTomorrow" title="自動填入明天">明天</button>
                  <button type="button" class="sf-btn sm" id="orderEditDateMon" title="自動填入下週一">下週一</button>
                  <button type="submit" class="sf-btn sm primary" title="儲存新的出貨日">儲存</button>
                  <button type="button" class="sf-btn sm ghost" id="orderDateEditCancel">取消</button>
                </form>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <a class="sf-btn ghost" href="${escapeAttr(backTo)}">← 回列表</a>
              ${prevOrder ? `<a class="sf-btn ghost" href="/admin/orders/${encodeURIComponent(prevOrder.id)}?back=${encodeURIComponent(backTo)}">上一筆</a>` : ""}
              ${nextOrder ? `<a class="sf-btn ghost" href="/admin/orders/${encodeURIComponent(nextOrder.id)}?back=${encodeURIComponent(backTo)}">下一筆</a>` : ""}
            </div>
          </div>
        </div>
        <script>
        (function(){
          function fmtDateTaipei(d){
            const f = new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Taipei" });
            return f.format(d);
          }
          function nextMonday(){
            const today = new Date(fmtDateTaipei(new Date()) + "T00:00:00+08:00");
            const dow = today.getDay();
            let add = (8 - dow) % 7;
            if (add === 0) add = 7;
            return fmtDateTaipei(new Date(today.getTime() + add * 86400000));
          }
          function tomorrow(){
            const d = new Date();
            d.setDate(d.getDate() + 1);
            return fmtDateTaipei(d);
          }
          const inp = document.getElementById("orderEditDate");
          const t = document.getElementById("orderEditDateTomorrow");
          const m = document.getElementById("orderEditDateMon");
          if (t) t.addEventListener("click", () => { if (inp) inp.value = tomorrow(); });
          if (m) m.addEventListener("click", () => { if (inp) inp.value = nextMonday(); });
          const editRow = document.getElementById("orderDateEditRow");
          const editToggle = document.getElementById("orderDateEditToggle");
          const editCancel = document.getElementById("orderDateEditCancel");
          if (editToggle && editRow) editToggle.addEventListener("click", () => {
            const open = editRow.style.display !== "none";
            editRow.style.display = open ? "none" : "flex";
            if (!open && inp) inp.focus();
          });
          if (editCancel && editRow) editCancel.addEventListener("click", () => { editRow.style.display = "none"; });
        })();
        </script>
        <div class="notion-breadcrumb" style="display:none;"><a href="/admin">儀表板</a> / <a href="/admin/orders">訂單審核</a> / 訂單明細</div>
        <p style="margin:0 0 10px;color:var(--notion-text-secondary, #555);font-size:14px;display:none;">${escapeHtml(order.order_no ?? "—")} · ${escapeHtml(order.order_date)} · <a href="/admin/customers/${encodeURIComponent(order.customer_id)}/quick-view?from=orders">${escapeHtml(order.customer_name)}</a> · ${orderStatusDisplay}</p>
        <div style="padding:0 32px;">
          ${req.query.ok === "product" ? "<div class=\"sf-pill ok\" style=\"margin-bottom:8px;\">已更新對應品項</div>" : ""}
          ${req.query.ok === "prod_edit" ? "<div class=\"sf-pill ok\" style=\"margin-bottom:8px;\">已儲存品項</div>" : ""}
          ${req.query.ok === "approved" ? "<div class=\"sf-pill ok\" style=\"margin-bottom:8px;\">已標記為已確認</div>" : ""}
          ${req.query.ok === "unconfirmed" ? "<div class=\"sf-pill\" style=\"margin-bottom:8px;\">已撤銷確認</div>" : ""}
          ${req.query.ok === "rerecog" ? "<div class=\"sf-pill ok\" style=\"margin-bottom:8px;\">已重新辨識明細</div>" : ""}
          ${req.query.ok === "raw_applied" ? "<div class=\"sf-pill ok\" style=\"margin-bottom:8px;\">已補登並解析</div>" : ""}
          ${req.query.ok === "date_saved" ? "<div class=\"sf-pill ok\" style=\"margin-bottom:8px;\">已更新出貨日期</div>" : ""}
          ${req.query.ok === "date_unchanged" ? "<div class=\"sf-pill\" style=\"margin-bottom:8px;\">出貨日期未變更（與原日期相同）</div>" : ""}
          ${req.query.ok === "approved_prev" ? "<div class=\"sf-pill ok\" style=\"margin-bottom:8px;\">已確認上一筆訂單</div>" : ""}
          ${req.query.err === "product" ? "<div class=\"sf-pill bad\" style=\"margin-bottom:8px;\">請選擇有效品項</div>" : ""}
          ${req.query.err === "rerecog" ? "<div class=\"sf-pill bad\" style=\"margin-bottom:8px;\">重新辨識失敗：無法解析出品項（請檢查 Gemini 金鑰與原始文字）</div>" : ""}
          ${req.query.err === "rerecog_empty" ? "<div class=\"sf-pill bad\" style=\"margin-bottom:8px;\">重新辨識失敗：此訂單沒有可解析的原始文字（請用「補登／修正」貼上叫貨內容）</div>" : ""}
          ${req.query.err === "rerecog_gemini" ? "<div class=\"sf-pill bad\" style=\"margin-bottom:8px;\">重新辨識失敗：純文字叫貨須設定 GOOGLE_GEMINI_API_KEY</div>" : ""}
          ${req.query.err === "rerecog_gemini_empty" ? "<div class=\"sf-pill bad\" style=\"margin-bottom:8px;\">重新辨識失敗：Gemini 未解析出任何品項（可能配額用罄或 spending cap）</div>" : ""}
          ${req.query.err === "rerecog_split" ? "<div class=\"sf-pill bad\" style=\"margin-bottom:8px;\">重新辨識失敗：子客戶拆單解析結果無對應品項</div>" : ""}
          ${req.query.err === "rerecog_line" ? "<div class=\"sf-pill bad\" style=\"margin-bottom:8px;\">重新辨識失敗：訂單有圖片附件，但未設定 LINE_CHANNEL_ACCESS_TOKEN</div>" : ""}
          ${req.query.err === "rerecog_vision" ? "<div class=\"sf-pill bad\" style=\"margin-bottom:8px;\">重新辨識失敗：有圖片附件但無法辨識（請設定 Vision 或 Gemini 金鑰）</div>" : ""}
          ${req.query.err === "rerecog_written" ? "<div class=\"sf-pill bad\" style=\"margin-bottom:8px;\">此單已轉入凌越，重新辨識會讓後台明細與凌越不一致。請先到凌越刪除舊單、再用「重新轉入凌越」；若確定要重辨識，請用畫面上的『強制重新辨識』。</div>" : ""}
          ${req.query.err === "apply_raw_empty" ? "<div class=\"sf-pill bad\" style=\"margin-bottom:8px;\">請貼上內容後再送出</div>" : ""}
          ${req.query.err === "apply_raw_parse" ? "<div class=\"sf-pill bad\" style=\"margin-bottom:8px;\">無法解析，請檢查內容或 Gemini 金鑰</div>" : ""}
          ${(() => {
            // 通用 err 顯示：approve 守衛（作廢/客訴單）與 set-date 等 POST 端把完整中文訊息放在 ?err=，
            // 這裡沒有對應代碼分支就會被吞掉（伺服器有擋、使用者無感）。未知代碼一律原文顯示。
            const knownErr = ["product", "rerecog", "rerecog_empty", "rerecog_gemini", "rerecog_gemini_empty", "rerecog_split", "rerecog_line", "rerecog_vision", "rerecog_written", "apply_raw_empty", "apply_raw_parse"];
            const e = typeof req.query.err === "string" ? req.query.err : "";
            return e && !knownErr.includes(e) ? `<div class="sf-pill bad" style="margin-bottom:8px;">${escapeHtml(e)}</div>` : "";
          })()}
        </div>
        <div class="sf-root" style="padding:0 32px 24px 32px;background:var(--bg-0);">
        <div class="order-action-toolbar" style="display:flex;gap:8px;align-items:center;margin:0 0 14px;flex-wrap:wrap;">
          ${confirmOrderFormHtml ? `<span class="sf-toolbar-confirm">${confirmOrderFormHtml}</span>` : ""}
          <form method="post" action="/admin/orders/${encodeURIComponent(orderId)}/re-recognize?back=${encodeURIComponent(backTo)}" style="display:inline;margin:0;">
            <button type="submit" class="sf-btn" title="依原始文字與 LINE 圖片附件重建明細（覆寫現有品項）" onclick="return confirm('依原始訂單重建明細？將覆寫現有品項。');">${SF_ICONS.refresh}<span>重新辨識</span></button>
          </form>
          ${(order.lingyue_doc_no || order.lingyue_written_at) ? `<form method="post" action="/admin/orders/${encodeURIComponent(orderId)}/re-recognize?force=1&back=${encodeURIComponent(backTo)}" style="display:inline;margin:0;">
            <button type="submit" class="sf-btn" style="color:#c0392b;" title="強制重新辨識（此單已轉入凌越，重辨識會讓後台與 ERP 不一致）" onclick="return confirm('⚠ 此單已轉入凌越${order.lingyue_doc_no ? "（單號 " + String(order.lingyue_doc_no).replace(/'/g, "") + "）" : ""}。\\n強制重新辨識會覆寫後台明細，但凌越那張單不會變，兩邊將不一致。\\n\\n確定要強制重辨識嗎？");">${SF_ICONS.refresh}<span>強制重新辨識</span></button>
          </form>` : ""}
          <div class="sf-more-dropdown" id="orderMoreDropdown" style="position:relative;display:inline-block;">
            <button type="button" class="sf-btn" id="btnOrderMoreToggle" aria-haspopup="true" aria-expanded="false" title="更多動作">更多 ▾</button>
            <div class="sf-more-menu" id="orderMoreMenu" role="menu" style="position:absolute;top:calc(100% + 4px);left:0;min-width:220px;background:var(--bg-0);border:1px solid var(--line);border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.12);padding:6px;z-index:50;flex-direction:column;gap:2px;display:none;">
              <button type="button" id="btn-save-example" class="sf-more-item" title="將目前畫面上的明細與附件圖存為該客戶 Few-Shot 範例（多張附件時以第一張為準）" ${attachments.length === 0 ? "disabled" : ""}>${SF_ICONS.spark}<span>儲存為 AI 學習範例</span>${attachments.length === 0 ? `<span style="margin-left:auto;font-size:11px;color:var(--txt-3);">（需有附件）</span>` : ""}</button>
              <a href="/admin/orders/batch-lingyue-xlsx?ids=${encodeURIComponent(orderId)}" class="sf-more-item">${SF_ICONS.dl}<span>匯出凌越</span></a>
              <a href="/admin/orders/${encodeURIComponent(orderId)}/order-sheet?preview=1" class="sf-more-item">${SF_ICONS.list}<span>預覽訂單</span></a>
              <a href="/admin/orders/${encodeURIComponent(orderId)}/order-sheet?download=1" class="sf-more-item">${SF_ICONS.dl}<span>匯出訂貨單</span></a>
            </div>
          </div>
          <style>
            .sf-more-item { display:flex;align-items:center;gap:8px;padding:8px 10px;border:none;background:transparent;text-align:left;font-size:13px;color:var(--txt-1);cursor:pointer;border-radius:6px;text-decoration:none;font-family:inherit;width:100%; }
            .sf-more-item:hover { background:var(--bg-2); }
            .sf-more-item:disabled { color:var(--txt-3);cursor:not-allowed;opacity:.6; }
            .sf-more-item:disabled:hover { background:transparent; }
            .sf-more-item svg { flex:0 0 auto; }
            @media (max-width: 720px) {
              .order-action-toolbar { gap:6px; }
              .order-action-toolbar .sf-btn { padding:6px 10px;font-size:13px; }
              .order-action-toolbar > span[style*="flex:1"] { display:none !important; }
              .sf-toolbar-danger { margin-left:auto; }
            }
          </style>
          <script>
          (function(){
            const moreToggle = document.getElementById("btnOrderMoreToggle");
            const moreMenu = document.getElementById("orderMoreMenu");
            const moreDropdown = document.getElementById("orderMoreDropdown");
            if (!moreToggle || !moreMenu || !moreDropdown) return;
            function isOpen(){ return moreMenu.style.display === "flex"; }
            function closeMore(){ moreMenu.style.display = "none"; moreToggle.setAttribute("aria-expanded","false"); }
            function openMore(){ moreMenu.style.display = "flex"; moreToggle.setAttribute("aria-expanded","true"); }
            closeMore();
            moreToggle.addEventListener("click", function(e){
              e.stopPropagation();
              if (isOpen()) closeMore(); else openMore();
            });
            document.addEventListener("click", function(e){
              if (isOpen() && !moreDropdown.contains(e.target)) closeMore();
            });
            document.addEventListener("keydown", function(e){ if (e.key === "Escape" && isOpen()) closeMore(); });
            moreMenu.querySelectorAll("a,button").forEach(el => el.addEventListener("click", function(){ setTimeout(closeMore, 0); }));
          })();
          </script>
          ${isOrderVoided ? "" : `
          <span style="flex:1;"></span>
          ${toComplaintFormHtml}
          <div class="sf-toolbar-danger" style="display:inline-flex;gap:6px;padding:4px;background:rgba(239,68,68,0.06);border:1px dashed rgba(239,68,68,0.3);border-radius:8px;align-items:center;">
            <form method="post" action="/admin/orders/${encodeURIComponent(orderId)}/void${backTo ? "?back=" + encodeURIComponent(backTo) : ""}" id="voidOrderForm" style="display:inline-flex;margin:0;gap:6px;">
              <input type="hidden" name="void_reason" id="voidOrderReason" value="">
              <input type="hidden" name="void_note" id="voidOrderNote" value="">
              <button type="button" id="btnVoidOrder" class="sf-btn danger" title="作廢整張訂單（會保留稽核紀錄、可由「已作廢訂單」清單恢復）">${SF_ICONS.x}<span>作廢此訂單</span></button>
            </form>
          </div>
          ${voidReasonModalHtml({ prefix: "voidOrder", title: "作廢此訂單" })}
          <script>
          (function(){
            const btn = document.getElementById("btnVoidOrder");
            if (!btn) return;
            btn.addEventListener("click", function(){ window.voidOrderModalOpen(); });
            window.voidOrderModalSubmit = function(reason, note){
              document.getElementById("voidOrderReason").value = reason;
              document.getElementById("voidOrderNote").value = note;
              document.getElementById("voidOrderForm").submit();
            };
          })();
          </script>`}
        </div>
        <div class="order-detail-layout">
        <aside class="order-detail-raw-col" aria-label="原始訂單對照" style="flex:0 0 min(320px, 32vw);max-width:360px;">
          <div class="sf-card raw-message-scroll" id="rawOrderBlock" style="position:sticky;top:12px;max-height:calc(100vh - 24px);overflow-y:auto;">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.mail}原始訂單</div>
              <button type="button" class="sf-btn sm" id="pasteRawToggleBtn" aria-expanded="false" aria-controls="pasteRaw">補登／修正</button>
            </div>
            <div style="padding:14px;">
              ${attachments.length > 0 ? `
                <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:${order.raw_message && String(order.raw_message).replace(/\[圖片\]/g,"").trim() ? "14px" : "0"};">
                  <div style="font-size:11px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">客戶傳的照片 · ${attachments.length} 張</div>
                  ${attachments.map((a, idx) => `
                    <div class="order-attach-card" data-msg="${escapeAttr(a.line_message_id)}" style="border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:#fff;">
                      <div class="order-attach-viewport" style="overflow:auto;max-height:70vh;background:#fff;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y;">
                        <div class="order-attach-stage" style="position:relative;display:inline-block;min-width:100%;line-height:0;">
                          <img class="order-attach-img" data-scale="1" src="/admin/orders/${encodeURIComponent(orderId)}/attachment/${encodeURIComponent(a.line_message_id)}" alt="附件 ${idx + 1}" loading="lazy" style="display:block;width:100%;height:auto;max-height:480px;object-fit:contain;background:#fff;transform-origin:top left;cursor:zoom-in;user-select:none;">
                        </div>
                      </div>
                      <div class="order-attach-zoombar" style="display:flex;align-items:center;gap:4px;padding:5px 8px;background:var(--bg-2);border-top:1px solid var(--line);flex-wrap:wrap;">
                        <button type="button" class="sf-btn sm zoom-out" title="縮小">－</button>
                        <button type="button" class="sf-btn sm zoom-in" title="放大">＋</button>
                        <span class="zoom-label" style="font-size:11px;color:var(--txt-3);font-family:var(--font-mono);min-width:40px;text-align:center;">100%</span>
                        <button type="button" class="sf-btn sm zoom-reset" title="重設大小">重設</button>
                        <button type="button" class="sf-btn sm zoom-full" title="全螢幕檢視（手機可雙指縮放、拖曳、雙擊放大）">全螢幕</button>
                        <button type="button" class="sf-btn sm ocr-box-btn" title="用 Google Vision 框出圖片上偵測到的文字（會呼叫一次 API；綠框=有對應到明細品項，灰框=偵測到但未對應）">辨識框</button>
                        <span class="ocr-box-status" style="font-size:11px;color:var(--txt-3);"></span>
                        <a href="/admin/orders/${encodeURIComponent(orderId)}/attachment/${encodeURIComponent(a.line_message_id)}" target="_blank" rel="noopener" title="另開新分頁看原圖" style="margin-left:auto;font-size:11px;color:var(--txt-3);text-decoration:none;">圖 ${idx + 1} · 新分頁↗</a>
                      </div>
                    </div>
                  `).join("")}
                  <!-- 人工轉正工具列：自動轉正若判錯，可手動轉到正確角度再重新辨識 -->
                  <div id="rotateToolbar" style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 10px;background:var(--bg-2);border:var(--hairline);border-radius:var(--radius);">
                    <span style="font-size:12px;color:var(--txt-2);">圖片歪了？手動轉正：</span>
                    <button type="button" class="sf-btn sm" id="rotLeftBtn" title="左轉 90°">↺ 左轉</button>
                    <button type="button" class="sf-btn sm" id="rotRightBtn" title="右轉 90°">↻ 右轉</button>
                    <span id="rotAngleLabel" style="font-size:12px;color:var(--txt-3);font-family:var(--font-mono);min-width:48px;">0°</span>
                    <button type="button" class="sf-btn sm primary" id="rotReRecogBtn" disabled title="把照片轉到目前角度後重新辨識（會覆寫明細）">依此角度重新辨識</button>
                    <span id="rotStatus" style="font-size:12px;color:var(--txt-3);"></span>
                  </div>
                </div>
              ` : ""}
              ${(() => {
                if (convoHtml) {
                  return `
                    <div style="font-size:11px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">群組對話<span style="text-transform:none;letter-spacing:0;margin-left:6px;color:var(--txt-3);">（<span style="background:rgba(35,131,226,0.14);border-radius:3px;padding:0 3px;">藍底</span> = 已對應到明細・<span style="background:#fffbeb;border:1px solid #fde68a;border-radius:3px;padding:0 3px;color:#92400e;">黃底</span> = 客戶・<span style="background:#f3f4f6;border:1px solid #d1d5db;border-radius:3px;padding:0 3px;color:#4b5563;">灰底</span> = 同事回覆）</span></div>
                    <div id="rawLinesPre" style="display:flex;flex-direction:column;gap:6px;font-family:var(--font-ui);">${convoHtml}</div>
                  `;
                }
                if (rawMatchHtml) {
                  return `
                    <div style="font-size:11px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">客戶打字內容<span style="text-transform:none;letter-spacing:0;margin-left:6px;color:var(--txt-3);">（<span style="background:rgba(35,131,226,0.14);border-radius:3px;padding:0 3px;">藍底</span> = 已對應到明細）</span></div>
                    <pre id="rawLinesPre" style="background:var(--bg-2);padding:10px 12px;border-radius:var(--radius);border:var(--hairline);font-size:13px;line-height:1.7;white-space:pre-wrap;word-break:break-word;margin:0;color:var(--txt-1);font-family:var(--font-ui);">${rawMatchHtml}</pre>
                  `;
                }
                if (attachments.length === 0) {
                  return `<div style="color:var(--txt-3);font-size:13px;padding:24px 8px;text-align:center;">（此訂單無原始訊息）</div>`;
                }
                return "";
              })()}
              <div id="pasteRaw" style="display:none;margin-top:14px;padding-top:14px;border-top:var(--hairline);">
                <form method="post" action="/admin/orders/${encodeURIComponent(orderId)}/apply-raw-text?back=${encodeURIComponent(backTo)}" style="margin:0;">
                  <textarea class="sf-textarea" name="pasted_raw" rows="5" placeholder="貼上叫貨全文（會覆寫明細）" required title="送出後依全文重建明細"></textarea>
                  <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:8px 0 0;font-size:12px;color:var(--txt-2);">
                    <label style="margin:0;"><input type="radio" name="merge_mode" value="replace" checked> 取代整段</label>
                    <label style="margin:0;"><input type="radio" name="merge_mode" value="append"> 接到後面</label>
                  </div>
                  <p style="margin:8px 0 0;"><button type="submit" class="sf-btn primary" onclick="return confirm('依新全文重建明細？現有品項將刪除後重算。');">儲存並解析</button></p>
                </form>
              </div>
            </div>
          </div>
        </aside>
        <script>
        (function(){
          var MIN = 1, MAX = 5, STEP = 0.5;
          function fmt(s){ return Math.round(s*100) + "%"; }
          /* 全螢幕照片檢視：手機雙指縮放／單指拖曳／雙擊放大；
             行內檢視器在手機的 sticky 小框裡放大很難用，全螢幕才看得清手寫字 */
          var fsOverlay = null;
          function closeFullscreen(){
            if (!fsOverlay) return;
            fsOverlay.remove(); fsOverlay = null;
            document.body.style.overflow = "";
          }
          function openFullscreen(src){
            closeFullscreen();
            var ov = document.createElement("div");
            ov.style.cssText = "position:fixed;inset:0;z-index:10000;background:#141414;display:flex;flex-direction:column;";
            ov.innerHTML = '<div style="flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(0,0,0,.88);color:#fff;">'
              + '<button type="button" data-fs="out" style="min-width:44px;height:38px;font-size:20px;font-weight:700;border:1px solid #555;background:#232323;color:#fff;border-radius:8px;">－</button>'
              + '<button type="button" data-fs="in" style="min-width:44px;height:38px;font-size:20px;font-weight:700;border:1px solid #555;background:#232323;color:#fff;border-radius:8px;">＋</button>'
              + '<span data-fs="label" style="font-size:13px;min-width:46px;text-align:center;font-variant-numeric:tabular-nums;">100%</span>'
              + '<button type="button" data-fs="reset" style="height:38px;padding:0 12px;font-size:14px;border:1px solid #555;background:#232323;color:#fff;border-radius:8px;">重設</button>'
              + '<button type="button" data-fs="close" style="margin-left:auto;height:38px;padding:0 14px;font-size:14px;font-weight:700;border:1px solid #666;background:#333;color:#fff;border-radius:8px;">✕ 關閉</button>'
              + '</div>'
              + '<div data-fs="vp" style="flex:1;overflow:auto;-webkit-overflow-scrolling:touch;touch-action:none;overscroll-behavior:contain;">'
              + '<img data-fs="img" alt="訂單照片" draggable="false" style="display:block;width:100%;height:auto;user-select:none;-webkit-user-drag:none;">'
              + '</div>';
            document.body.appendChild(ov);
            document.body.style.overflow = "hidden";
            fsOverlay = ov;
            var vp2 = ov.querySelector('[data-fs="vp"]');
            var im2 = ov.querySelector('[data-fs="img"]');
            var lb2 = ov.querySelector('[data-fs="label"]');
            im2.src = src;
            var scale = 1, MINF = 1, MAXF = 6;
            function setScale(s, cx, cy){
              s = Math.max(MINF, Math.min(MAXF, s));
              var rect = vp2.getBoundingClientRect();
              var ax = (cx == null ? rect.width/2 : cx - rect.left);
              var ay = (cy == null ? rect.height/2 : cy - rect.top);
              var px = ax + vp2.scrollLeft, py = ay + vp2.scrollTop;
              var ratio = s / scale;
              scale = s;
              im2.style.width = Math.round(vp2.clientWidth * scale) + "px";
              lb2.textContent = Math.round(scale*100) + "%";
              vp2.scrollLeft = px*ratio - ax;
              vp2.scrollTop = py*ratio - ay;
            }
            ov.querySelector('[data-fs="close"]').addEventListener("click", closeFullscreen);
            ov.querySelector('[data-fs="in"]').addEventListener("click", function(){ setScale(scale + 0.5); });
            ov.querySelector('[data-fs="out"]').addEventListener("click", function(){ setScale(scale - 0.5); });
            ov.querySelector('[data-fs="reset"]').addEventListener("click", function(){ setScale(1); vp2.scrollLeft = 0; vp2.scrollTop = 0; });
            document.addEventListener("keydown", function esc(e){ if (e.key === "Escape") { closeFullscreen(); document.removeEventListener("keydown", esc); } });
            /* 手勢：pointer 事件自己接手（touch-action:none）——單指平移、雙指捏合、雙擊縮放 */
            var pts = new Map(), startDist = 0, startScale = 1, panX = 0, panY = 0, panSL = 0, panST = 0, lastTap = 0;
            vp2.addEventListener("pointerdown", function(e){
              try { vp2.setPointerCapture(e.pointerId); } catch(_){}
              pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
              if (pts.size === 1) {
                panX = e.clientX; panY = e.clientY; panSL = vp2.scrollLeft; panST = vp2.scrollTop;
                var now = Date.now();
                if (now - lastTap < 320) { setScale(scale > 1.2 ? 1 : 2.5, e.clientX, e.clientY); lastTap = 0; }
                else { lastTap = now; }
              } else if (pts.size === 2) {
                var arr = Array.from(pts.values());
                startDist = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y) || 1;
                startScale = scale;
              }
            });
            vp2.addEventListener("pointermove", function(e){
              if (!pts.has(e.pointerId)) return;
              pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
              if (pts.size === 2) {
                var arr = Array.from(pts.values());
                var d = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y) || 1;
                setScale(startScale * d / startDist, (arr[0].x + arr[1].x)/2, (arr[0].y + arr[1].y)/2);
              } else if (pts.size === 1) {
                vp2.scrollLeft = panSL - (e.clientX - panX);
                vp2.scrollTop = panST - (e.clientY - panY);
              }
            });
            function lift(e){
              pts.delete(e.pointerId);
              if (pts.size === 1) {
                var p = Array.from(pts.values())[0];
                panX = p.x; panY = p.y; panSL = vp2.scrollLeft; panST = vp2.scrollTop;
              }
            }
            vp2.addEventListener("pointerup", lift);
            vp2.addEventListener("pointercancel", lift);
          }
          document.querySelectorAll(".order-attach-card").forEach(function(card){
            var img = card.querySelector(".order-attach-img");
            var vp = card.querySelector(".order-attach-viewport");
            var label = card.querySelector(".zoom-label");
            if (!img || !vp) return;
            function apply(s, cx, cy){
              s = Math.max(MIN, Math.min(MAX, Math.round(s*100)/100));
              var prev = parseFloat(img.dataset.scale) || 1;
              // 以游標位置為中心縮放：保持該點在畫面上的相對位置
              var rect = vp.getBoundingClientRect();
              var px = (cx == null ? rect.width/2 : cx - rect.left) + vp.scrollLeft;
              var py = (cy == null ? rect.height/2 : cy - rect.top) + vp.scrollTop;
              img.dataset.scale = String(s);
              img.style.width = (s*100) + "%";
              img.style.maxHeight = s > 1 ? "none" : "480px";
              img.style.cursor = s > 1 ? "grab" : "zoom-in";
              if (label) label.textContent = fmt(s);
              var ratio = s / prev;
              vp.scrollLeft = px*ratio - (cx == null ? rect.width/2 : cx - rect.left);
              vp.scrollTop = py*ratio - (cy == null ? rect.height/2 : cy - rect.top);
            }
            var bo = card.querySelector(".zoom-out"), bi = card.querySelector(".zoom-in"), br = card.querySelector(".zoom-reset"), bf = card.querySelector(".zoom-full");
            if (bo) bo.addEventListener("click", function(){ apply((parseFloat(img.dataset.scale)||1) - STEP); });
            if (bi) bi.addEventListener("click", function(){ apply((parseFloat(img.dataset.scale)||1) + STEP); });
            if (br) br.addEventListener("click", function(){ apply(1); vp.scrollLeft = 0; vp.scrollTop = 0; });
            if (bf) bf.addEventListener("click", function(){ openFullscreen(img.currentSrc || img.src); });
            // 點圖：手機/平板直接開全螢幕（行內小框放大很難用）；桌面維持放大一級＋拖曳平移
            var dragging = false, moved = false, sx = 0, sy = 0, sl = 0, st = 0;
            img.addEventListener("click", function(e){
              if (moved) { moved = false; return; }
              if (window.matchMedia && window.matchMedia("(max-width: 1024px)").matches) { openFullscreen(img.currentSrc || img.src); return; }
              if ((parseFloat(img.dataset.scale)||1) < MAX) apply((parseFloat(img.dataset.scale)||1) + STEP, e.clientX, e.clientY);
            });
            img.addEventListener("pointerdown", function(e){
              if ((parseFloat(img.dataset.scale)||1) <= 1) return;
              dragging = true; moved = false;
              sx = e.clientX; sy = e.clientY; sl = vp.scrollLeft; st = vp.scrollTop;
              img.style.cursor = "grabbing";
              try { img.setPointerCapture(e.pointerId); } catch(_){}
            });
            img.addEventListener("pointermove", function(e){
              if (!dragging) return;
              var dx = e.clientX - sx, dy = e.clientY - sy;
              if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
              vp.scrollLeft = sl - dx; vp.scrollTop = st - dy;
            });
            function endDrag(){ if (!dragging) return; dragging = false; img.style.cursor = (parseFloat(img.dataset.scale)||1) > 1 ? "grab" : "zoom-in"; }
            img.addEventListener("pointerup", endDrag);
            img.addEventListener("pointercancel", endDrag);
            // Ctrl/⌘ + 滾輪縮放（一般滾輪維持頁面捲動）
            vp.addEventListener("wheel", function(e){
              if (!(e.ctrlKey || e.metaKey)) return;
              e.preventDefault();
              apply((parseFloat(img.dataset.scale)||1) + (e.deltaY < 0 ? STEP : -STEP), e.clientX, e.clientY);
            }, { passive: false });
          });
        })();
        </script>
        <script>
        /* 照片辨識框：按「辨識框」呼叫 Google Vision，把偵測到的每個詞疊上方框。
           綠框＝該詞屬於某個明細品項名稱；灰框＝有讀到字但沒對應到品項（可看出漏辨識）。 */
        (function(){
          var orderBase = "/admin/orders/${encodeURIComponent(orderId)}";
          var itemNames = ${ocrItemNamesJson};
          function normW(s){ return String(s||"").replace(/[\\s,，、。.·:：*xX╳＊()（）0-9]/g, "").toLowerCase(); }
          var itemNorms = itemNames.map(normW).filter(function(x){ return x.length >= 1; });
          var SVGNS = "http://www.w3.org/2000/svg";
          document.querySelectorAll(".order-attach-card").forEach(function(card){
            var img = card.querySelector(".order-attach-img");
            var stage = card.querySelector(".order-attach-stage");
            var btn = card.querySelector(".ocr-box-btn");
            var statusEl = card.querySelector(".ocr-box-status");
            var msg = card.getAttribute("data-msg");
            if (!img || !stage || !btn || !msg) return;
            var overlay = null, loaded = false, on = false;
            function sync(){ if (!overlay) return; overlay.style.width = img.offsetWidth + "px"; overlay.style.height = img.offsetHeight + "px"; overlay.style.left = img.offsetLeft + "px"; overlay.style.top = img.offsetTop + "px"; }
            function render(data){
              overlay = document.createElementNS(SVGNS, "svg");
              overlay.setAttribute("viewBox", "0 0 " + (data.width || 1) + " " + (data.height || 1));
              overlay.setAttribute("preserveAspectRatio", "xMinYMin meet");
              overlay.style.cssText = "position:absolute;pointer-events:none;z-index:3;left:0;top:0;";
              var matched = 0;
              (data.words || []).forEach(function(w){
                var wn = normW(w.text);
                if (!wn) return;
                var hit = itemNorms.some(function(n){ return n.indexOf(wn) >= 0 || wn.indexOf(n) >= 0; });
                if (hit) matched++;
                var r = document.createElementNS(SVGNS, "rect");
                r.setAttribute("x", w.x); r.setAttribute("y", w.y);
                r.setAttribute("width", Math.max(1, w.w)); r.setAttribute("height", Math.max(1, w.h));
                r.setAttribute("rx", "2");
                r.setAttribute("fill", hit ? "rgba(29,158,117,0.20)" : "rgba(120,120,120,0.06)");
                r.setAttribute("stroke", hit ? "#1d9e75" : "#9a9a9a");
                r.setAttribute("stroke-width", hit ? "2.5" : "1");
                overlay.appendChild(r);
              });
              stage.appendChild(overlay);
              sync();
              if (window.ResizeObserver){ try { new ResizeObserver(sync).observe(img); } catch(_){} }
              window.addEventListener("resize", sync);
              if (statusEl) statusEl.textContent = "偵測 " + (data.words ? data.words.length : 0) + " 詞・對應品項 " + matched + (data.cached ? "（快取）" : "");
            }
            btn.addEventListener("click", function(){
              if (loaded){ on = !on; if (overlay) overlay.style.display = on ? "" : "none"; btn.classList.toggle("primary", on); return; }
              btn.disabled = true; var old = btn.textContent; btn.textContent = "辨識中…";
              fetch(orderBase + "/attachment/" + encodeURIComponent(msg) + "/ocr-boxes", { credentials: "same-origin" })
                .then(function(r){ return r.json(); })
                .then(function(d){
                  btn.disabled = false; btn.textContent = old;
                  if (!d || !d.ok){ if (statusEl) statusEl.textContent = (d && d.error) || "辨識框失敗"; return; }
                  loaded = true; on = true; btn.classList.add("primary"); render(d);
                })
                .catch(function(){ btn.disabled = false; btn.textContent = old; if (statusEl) statusEl.textContent = "辨識框請求失敗"; });
            });
          });
        })();
        </script>
        <div class="order-detail-main-col">
        <form id="itemsForm" method="post" action="/admin/orders/${encodeURIComponent(orderId)}/items" novalidate>
          <div class="sf-card" id="items">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.list} 訂單明細 <span class="sf-pill">${items.length} 項</span></div>
              <button type="submit" class="sf-btn primary sm" id="itemsSaveBtnTop" title="儲存數量、單位、備註與排序">${SF_ICONS.check}<span>儲存明細</span></button>
            </div>
            <div style="padding:12px 14px 0;">
              ${reviewFocusBarHtml}
              <p class="order-legend" style="font-size:12px;color:var(--txt-3);margin:0 0 8px;"><span class="order-legend-swatch sw-need" style="display:inline-block;width:10px;height:10px;background:var(--warn);border-radius:2px;vertical-align:middle;margin-right:4px;"></span>待對應：尚未對應到貨品主檔，需人工指定品項</p>
              ${batchMoveBarHtml}
            </div>
            <script>
            /* 「只看待確認」開關：純前端過濾，把 data-review-flag="0" 的品項列隱藏，不動排序、不改後端 */
            /* [fix 2026-07-10] 本 script 位於 table 之前，須等 DOM 解析完再抓 .order-detail-table，否則 querySelector 回 null 開關失效 */
            (function(){
              function wire(){
                var tg = document.getElementById("reviewOnlyToggle");
                var tbl = document.querySelector(".order-detail-table");
                if (!tg || !tbl) return;
                function apply(){
                  tbl.classList.toggle("show-review-only", tg.checked);
                  /* [fix 2026-07-10] 隱藏/顯示品項列後，另一個 IIFE 的原始訂單↔明細連線需重算端點，
                     否則被隱藏列的 getBoundingClientRect 皆 0 → 曲線端點飛到左上角。連線腳本已監聽
                     window resize（schedule→draw），這裡 dispatch 一個 resize 事件即可觸發重繪（最小改動）。 */
                  try { window.dispatchEvent(new Event("resize")); } catch(_){ }
                }
                tg.addEventListener("change", apply);
                apply();
              }
              if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
              else wire();
            })();
            </script>
            <div class="table-scroll-mobile" style="overflow-x:auto;">
              <table class="order-detail-table sf-table" style="font-size:13px;">
                <thead><tr><th style="width:2.25rem;"><input type="checkbox" id="select_all_items" title="全選"></th><th class="order-detail-th-sort" title="順序（上移／下移）"></th><th class="order-detail-th-idx">項次</th><th class="order-table-col-system">料號</th><th>品名</th><th style="width:4.5rem;">數量</th><th>單位</th><th>子客戶/分店</th><th>備註</th><th style="width:2.75rem;">作廢</th></tr></thead>
                <tbody>${itemsRows}</tbody>
                <tr class="add-item-row"><td colspan="10" style="background:var(--bg-2);padding:8px 12px;">
                  <div id="inlineAddItem" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                    <input type="hidden" id="addAfterItemId" value="">
                    <div id="insertPosBar" style="display:none;width:100%;font-size:12px;color:#047857;align-items:center;gap:8px;flex-wrap:wrap;">
                      <span id="insertPosText" style="font-weight:700;"></span>
                      <button type="button" id="insertPosCancel" class="sf-btn sm" style="flex:0 0 auto;">取消插入（改加到最後）</button>
                    </div>
                    ${frequentProducts.length ? `<style>
                      .freq-prod-chip { font-size:12px; padding:4px 10px; border-radius:999px; border:1px solid var(--line); background:var(--bg-1); color:var(--txt-1); cursor:pointer; font-family:inherit; max-width:12rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; line-height:1.4; }
                      .freq-prod-chip:hover { border-color:var(--accent); color:var(--accent); }
                    </style>
                    <div class="freq-chips-row" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;width:100%;margin:0 0 2px;">
                      <span style="font-size:11px;color:var(--txt-3);flex:0 0 auto;">此客戶常叫：</span>
                      ${frequentProducts.map((fp) => `<button type="button" class="freq-prod-chip" data-id="${escapeAttr(String(fp.id))}" data-name="${escapeAttr(fp.name || "")}" title="${escapeAttr((fp.name || "") + (fp.erp_code ? " (" + fp.erp_code + ")" : "") + " · 叫過 " + fp.cnt + " 次")}">${escapeHtml(fp.name || "")}</button>`).join("")}
                    </div>` : ""}
                    <div class="review-product-picker" style="position:relative;flex:1;min-width:220px;">
                      <input type="text" class="review-product-search sf-input" autocomplete="off" placeholder="輸入品名、料號或條碼加入品項…" style="width:100%;box-sizing:border-box;">
                      <input type="hidden" class="review-product-id" value="">
                      <div class="review-product-dropdown" style="display:none;position:absolute;left:0;right:0;top:100%;max-height:280px;overflow-y:auto;background:var(--bg-1);border:1px solid var(--line);border-radius:8px;z-index:40;box-shadow:0 4px 12px rgba(0,0,0,.08);margin-top:4px;"></div>
                    </div>
                    <input type="number" inputmode="decimal" class="add-item-qty sf-input" step="any" min="0" value="0" style="width:5.5rem;" title="數量">
                    <select class="add-item-unit sf-input" style="width:5.5rem;" title="單位">${ORDER_LINE_UNITS.map((u) => `<option value="${escapeAttr(u)}">${escapeHtml(u)}</option>`).join("")}</select>
                    <button type="button" class="sf-btn sm primary" id="inlineAddBtn">${SF_ICONS.plus}<span>新增</span></button>
                    <span class="review-product-label" style="font-size:11px;color:var(--txt-3);"></span>
                  </div>
                </td></tr>
              </table>
            </div>
            <script>
            /* 數量框：點入即全選（像 ERP，直接覆蓋輸入不用先刪） */
            (function(){
              document.addEventListener("focusin", function(e){
                var el = e.target;
                if (el && el.tagName === "INPUT" && (el.classList.contains("order-detail-qty-input") || el.classList.contains("add-item-qty"))) {
                  setTimeout(function(){ try { el.select(); } catch(_){} }, 0);
                }
              });
              /* 點一下（非拖曳選字）也重新全選，避免 focus 後又被點擊清掉 */
              document.addEventListener("mouseup", function(e){
                var el = e.target;
                if (el && el.tagName === "INPUT" && (el.classList.contains("order-detail-qty-input") || el.classList.contains("add-item-qty"))) {
                  if (String(el.value).length && el.selectionStart === el.selectionEnd) { try { el.select(); } catch(_){} }
                }
              });
            })();
            </script>
            <script>
            (function(){
              var wrap = document.querySelector("#inlineAddItem .review-product-picker");
              if (!wrap) return;
              var orderBase = "/admin/orders/${encodeURIComponent(orderId)}";
              var inp = wrap.querySelector(".review-product-search");
              var hidden = wrap.querySelector(".review-product-id");
              var label = document.querySelector("#inlineAddItem .review-product-label");
              var dropdown = wrap.querySelector(".review-product-dropdown");
              var qtyEl = document.querySelector("#inlineAddItem .add-item-qty");
              var unitEl = document.querySelector("#inlineAddItem .add-item-unit");
              var addBtn = document.getElementById("inlineAddBtn");
              var t;
              function hide(){ dropdown.style.display = "none"; }
              // 下拉用 fixed 定位，避免被表格的 overflow 捲動容器裁切（否則新增列在表格底部時下拉會看不到）
              function positionDropdown(){
                var r = inp.getBoundingClientRect();
                dropdown.style.position = "fixed";
                dropdown.style.left = r.left + "px";
                dropdown.style.top = (r.bottom + 2) + "px";
                dropdown.style.width = r.width + "px";
                dropdown.style.right = "auto";
                dropdown.style.zIndex = "1000";
              }
              function show(arr){
                dropdown.innerHTML = (arr && arr.length) ? arr.map(function(p){
                  var esc = function(s){ return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); };
                  return '<div class="review-product-opt" data-id="' + (p.id || "") + '" data-name="' + esc(p.name) + '" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--line);font-size:13px;">' +
                    esc(p.name) + (p.erp_code ? " （" + esc(p.erp_code) + "）" : "") + (p.teraoka_barcode ? " " + esc(p.teraoka_barcode) : "") + "</div>";
                }).join("") : '<div style="padding:8px 12px;color:var(--txt-3);font-size:13px;">無符合品項，請換關鍵字</div>';
                positionDropdown();
                dropdown.style.display = "block";
              }
              window.addEventListener("scroll", function(){ if (dropdown.style.display === "block") positionDropdown(); }, true);
              window.addEventListener("resize", function(){ if (dropdown.style.display === "block") positionDropdown(); });
              function selectProduct(id, name){ hidden.value = id || ""; label.textContent = name ? "已選：" + name : ""; inp.value = name || ""; hide(); }
              /* 常叫品項標籤：點一下直接帶入該品項，游標跳到數量（會自動全選） */
              document.querySelectorAll("#inlineAddItem .freq-prod-chip").forEach(function(chip){
                chip.addEventListener("click", function(){
                  selectProduct(chip.dataset.id, chip.dataset.name);
                  if (qtyEl) { qtyEl.focus(); }
                });
              });
              inp.addEventListener("input", function(){
                var q = (this.value || "").trim();
                hidden.value = ""; label.textContent = "";
                clearTimeout(t);
                if (!q) { hide(); return; }
                t = setTimeout(function(){
                  fetch("/admin/api/products-search?q=" + encodeURIComponent(q) + "&active=1", { credentials: "same-origin" })
                    .then(function(r){ return r.json(); }).then(show).catch(hide);
                }, 200);
              });
              dropdown.addEventListener("click", function(e){
                var opt = e.target.closest(".review-product-opt");
                if (opt && opt.dataset.id) selectProduct(opt.dataset.id, opt.dataset.name);
              });
              document.addEventListener("click", function(e){ if (wrap && !wrap.contains(e.target)) hide(); });
              /* 插入品項：點某列的「＋」，把新增列搬到該列下方，新增後就落在該位置（補漏辨識） */
              var addRow = document.querySelector("tr.add-item-row");
              var addRowHome = addRow ? addRow.parentNode : null;
              var afterInput = document.getElementById("addAfterItemId");
              var posBar = document.getElementById("insertPosBar");
              var posText = document.getElementById("insertPosText");
              var posCancel = document.getElementById("insertPosCancel");
              function resetInsertPos(){
                if (afterInput) afterInput.value = "";
                if (posBar) posBar.style.display = "none";
                if (addRow && addRowHome && addRow.parentNode !== addRowHome) addRowHome.appendChild(addRow);
              }
              if (posCancel) posCancel.addEventListener("click", resetInsertPos);
              document.addEventListener("click", function(e){
                var ib = e.target.closest(".item-insert-btn");
                if (!ib || !addRow) return;
                var tr = ib.closest("tr");
                if (!tr) return;
                tr.after(addRow);
                if (afterInput) afterInput.value = ib.getAttribute("data-item-id") || "";
                if (posBar && posText) {
                  posText.textContent = "插入位置：第 " + (ib.getAttribute("data-item-idx") || "?") + " 項之後";
                  posBar.style.display = "flex";
                }
                try { addRow.scrollIntoView({ behavior: "smooth", block: "center" }); } catch(_){}
                setTimeout(function(){ try { inp.focus(); } catch(_){} }, 250);
              });
              addBtn.addEventListener("click", function(){
                var pid = String(hidden.value || "").trim();
                if (!pid) { alert("請先輸入關鍵字並從下拉選擇品項。"); inp.focus(); return; }
                var qty = parseFloat(qtyEl.value);
                if (!isFinite(qty) || qty < 0) { alert("數量請填 0 或正數。"); qtyEl.focus(); return; }
                addBtn.disabled = true;
                var body = "product_id=" + encodeURIComponent(pid) + "&quantity=" + encodeURIComponent(qty) + "&unit=" + encodeURIComponent(unitEl.value || "公斤");
                var afterId = afterInput ? String(afterInput.value || "").trim() : "";
                if (afterId) body += "&after_item_id=" + encodeURIComponent(afterId);
                // 先自動儲存目前明細（數量/單位/排序等），避免新增後頁面重載把未存的修改洗掉
                var pre = (typeof window.doSaveItems === "function") ? window.doSaveItems() : Promise.resolve(true);
                pre.then(function(saved){
                  if (saved === false) { addBtn.disabled = false; return; }
                  fetch(orderBase + "/items/add", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body, credentials: "same-origin" })
                    .then(function(){ window.location.replace(orderBase + "?ok=add_item&t=" + new Date().getTime() + "#items"); })
                    .catch(function(){ addBtn.disabled = false; alert("新增失敗，請重試。"); });
                });
              });
            })();
            </script>
            <script>
            /* 手機左右滑手勢（iOS 風格）：品項卡「左滑＝作廢」「右滑＝在此列下方插入品項」。
               放開前會顯示紅/綠提示膠囊，超過門檻才觸發；動作直接代理既有按鈕——
               作廢會先跳原因確認視窗（可取消），插入是把新增表單移到該列下方（按「新增」才成立），
               所以不會有誤滑就直接改資料的問題。未過門檻放開會彈回。 */
            (function(){
              var SWIPE_ENABLED = false; // 2026-07：使用回饋「有點卡手」→ 先停用；要重開改 true 即可
              if (!SWIPE_ENABLED) return;
              if (!(window.matchMedia && window.matchMedia("(max-width: 760px)").matches)) return;
              var tbody = document.querySelector("table.order-detail-table tbody");
              if (!tbody) return;
              var THRESH = 96, CLAMP = 140;
              var hint = document.createElement("div");
              hint.style.cssText = "position:fixed;z-index:9998;display:none;padding:8px 14px;border-radius:999px;font-size:14px;font-weight:700;color:#fff;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,.18);transition:background .1s;";
              document.body.appendChild(hint);
              var tr = null, startX = 0, startY = 0, dx = 0, active = false, horiz = false, pid = null;
              function isInteractive(el){ return !!(el && el.closest && el.closest("input, select, textarea, button, a, label")); }
              function setHint(){
                if (!tr) return;
                var r = tr.getBoundingClientRect();
                var over = Math.abs(dx) >= THRESH;
                if (dx < 0) {
                  hint.textContent = over ? "放開作廢 ⊘" : "← 滑到底作廢";
                  hint.style.background = over ? "#b91c1c" : "rgba(185,28,28,.55)";
                  hint.style.left = "auto"; hint.style.right = "12px";
                } else {
                  hint.textContent = over ? "放開插入 ＋" : "滑到底插入 →";
                  hint.style.background = over ? "#047857" : "rgba(4,120,87,.55)";
                  hint.style.right = "auto"; hint.style.left = "12px";
                }
                hint.style.top = (r.top + r.height/2 - 18) + "px";
                hint.style.display = "block";
                hint.style.opacity = String(Math.min(1, Math.abs(dx) / THRESH));
              }
              function reset(snap){
                if (tr) {
                  if (snap && tr.style.transform) {
                    tr.style.transition = "transform .18s ease";
                    tr.style.transform = "";
                    (function(t){ setTimeout(function(){ t.style.transition = ""; }, 220); })(tr);
                  } else {
                    tr.style.transform = ""; tr.style.transition = "";
                  }
                }
                hint.style.display = "none";
                tr = null; active = false; horiz = false; dx = 0; pid = null;
              }
              tbody.addEventListener("pointerdown", function(e){
                if (e.pointerType === "mouse") return;
                if (isInteractive(e.target)) return;
                var row = e.target.closest ? e.target.closest("tr[data-item-id]") : null;
                if (!row) return;
                tr = row; startX = e.clientX; startY = e.clientY; dx = 0; active = true; horiz = false; pid = e.pointerId;
              });
              tbody.addEventListener("pointermove", function(e){
                if (!active || e.pointerId !== pid || !tr) return;
                var mx = e.clientX - startX, my = e.clientY - startY;
                if (!horiz) {
                  if (Math.abs(mx) > 14 && Math.abs(mx) > Math.abs(my) * 1.3) horiz = true;
                  else if (Math.abs(my) > 14) { reset(false); return; } /* 直向 → 交回頁面捲動 */
                }
                if (!horiz) return;
                dx = Math.max(-CLAMP, Math.min(CLAMP, mx));
                tr.style.transform = "translateX(" + dx + "px)";
                setHint();
              });
              function finish(e){
                if (!active || (pid != null && e.pointerId !== pid)) return;
                var row = tr, d = dx, fired = horiz && Math.abs(d) >= THRESH;
                reset(true);
                if (row && fired) {
                  if (d < 0) {
                    var del = row.querySelector(".btn-delete-item");
                    if (del) del.click(); /* 沿用作廢原因確認視窗，可取消 */
                  } else {
                    var ins = row.querySelector(".item-insert-btn");
                    if (ins) ins.click(); /* 新增表單移到此列下方，按「新增」才真的加入 */
                  }
                }
              }
              tbody.addEventListener("pointerup", finish);
              tbody.addEventListener("pointercancel", function(){ reset(true); });
            })();
            </script>
            <div style="padding:12px 14px;border-top:var(--hairline);display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              <button type="submit" class="sf-btn primary" title="儲存數量、單位、備註與排序">${SF_ICONS.check}<span>儲存明細</span></button>
              ${orderStatusLc === "approved" || orderStatusLc === "deleted" || orderStatusLc === "complaint" ? "" : `<button type="submit" form="approveOrderForm" class="btn btn-cute-approve" title="核對完畢，確認後回訂單列表">確認</button>`}
            </div>
          </div>
          ${(voidedItems && voidedItems.length) ? `
          <div class="sf-card" style="margin-top:14px;border-left:3px solid var(--txt-3);">
            <div class="sf-card-head">
              <div class="sf-card-title" style="color:var(--txt-2);">⊘ 已作廢品項 <span class="sf-pill">${voidedItems.length} 筆</span></div>
              <span class="sf-card-sub" style="font-size:11px;">納入 AI 參考用，不會匯出</span>
            </div>
            <div class="table-scroll-mobile" style="overflow-x:auto;">
              <table class="sf-table" style="font-size:12px;">
                <thead><tr><th>原始</th><th>對應品項</th><th style="width:5rem;">數量</th><th>原因</th><th>備註</th><th>作廢人</th><th>時間</th></tr></thead>
                <tbody>
                  ${voidedItems.map(vi => {
                    const reasonLabel = { ai_wrong:"AI 辨識錯誤", customer_changed:"客戶更改", duplicate:"重複叫貨", other:"其他" }[vi.void_reason] || (vi.void_reason || "—");
                    const reasonPill = vi.void_reason === "ai_wrong" ? `<span class="sf-pill warn" style="font-size:10px;">${escapeHtml(reasonLabel)}</span>` : `<span class="sf-pill" style="font-size:10px;">${escapeHtml(reasonLabel)}</span>`;
                    return `<tr style="color:var(--txt-2);">
                      <td>${escapeHtml(vi.raw_name || "—")}</td>
                      <td>${vi.product_name ? escapeHtml(vi.product_name) + (vi.erp_code?` <code style="font-size:10px;color:var(--txt-3);">${escapeHtml(vi.erp_code)}</code>`:"") : `<span style="color:var(--txt-3);">未對應</span>`}</td>
                      <td>${escapeHtml(String(vi.quantity ?? "—"))}${vi.unit?escapeHtml(vi.unit):""}</td>
                      <td>${reasonPill}</td>
                      <td style="font-size:11px;color:var(--txt-3);">${escapeHtml(vi.void_note || "—")}</td>
                      <td style="font-size:11px;color:var(--txt-3);">${escapeHtml(vi.voided_by || "—")}</td>
                      <td class="mono" style="font-size:11px;color:var(--txt-3);">${escapeHtml(fmtTaipeiYMDHM(vi.voided_at, ""))}</td>
                    </tr>`;
                  }).join("")}
                </tbody>
              </table>
            </div>
          </div>` : ""}
        </form>
        <script>
        /* 原始訂單 ↔ 明細 連線對照：全部淡連線 + 滑到某列（或某原始行）該對高亮加粗。
           僅打字訂單（有逐行文字）與桌面版啟用；照片訂單無逐行文字自動略過。 */
        (function(){
          var mqMobile = window.matchMedia("(max-width: 1024px)");
          var layout = document.querySelector(".order-detail-layout");
          var rawPre = document.getElementById("rawLinesPre");
          var table = document.querySelector(".order-detail-table");
          if (!layout || !rawPre || !table) return;
          var SVGNS = "http://www.w3.org/2000/svg";
          var svg = document.createElementNS(SVGNS, "svg");
          svg.setAttribute("id", "orderConnSvg");
          layout.appendChild(svg);
          var marks = [].slice.call(rawPre.querySelectorAll(".raw-match"));
          var rows = [].slice.call(table.querySelectorAll("tbody tr[data-item-id]"));
          function escId(id){ try { return (window.CSS && CSS.escape) ? CSS.escape(id) : String(id).replace(/["\\\\]/g, "\\\\$&"); } catch(_) { return id; } }
          // 配對：伺服器已把每個品項的字框成 <mark data-item-id>，直接用 id 對應；沒框到的品項就不畫線
          var pairs = [];
          rows.forEach(function(row){
            var id = row.getAttribute("data-item-id");
            if (!id) return;
            var mark = rawPre.querySelector('.raw-match[data-item-id="' + escId(id) + '"]');
            if (!mark) return;
            var p = { row: row, raw: mark }; pairs.push(p); row.__pair = p; mark.__pair = p;
          });
          pairs.forEach(function(p){ p.path = document.createElementNS(SVGNS, "path"); svg.appendChild(p.path); });
          var enabled = true;
          try { enabled = localStorage.getItem("songfu.order_conn") !== "0"; } catch(_){}
          function draw(){
            if (mqMobile.matches || !enabled || !pairs.length){ svg.style.display = "none"; return; }
            svg.style.display = "";
            var lr = layout.getBoundingClientRect();
            pairs.forEach(function(p){
              var rr = p.raw.getBoundingClientRect();
              var tr = p.row.getBoundingClientRect();
              /* [fix 2026-07-10] 「只看需複核」隱藏了對應品項列時，其 rect 皆為 0（display:none）。
                 此時不要畫線，否則端點會飛到版面左上角。該 pair 的 path 一併隱藏，開關關掉後 rect 恢復再顯示。 */
              if ((tr.width === 0 && tr.height === 0) || (rr.width === 0 && rr.height === 0)) { p.path.style.display = "none"; return; }
              p.path.style.display = "";
              var x1 = rr.right - lr.left;
              var y1 = (rr.top + rr.height / 2) - lr.top;
              var x2 = tr.left - lr.left;
              var y2 = (tr.top + tr.height / 2) - lr.top;
              var mx = (x1 + x2) / 2;
              p.path.setAttribute("d", "M " + x1 + " " + y1 + " C " + mx + " " + y1 + " " + mx + " " + y2 + " " + x2 + " " + y2);
            });
          }
          var raf = null;
          function schedule(){ if (raf) return; raf = requestAnimationFrame(function(){ raf = null; draw(); }); }
          function setHot(p, on){
            if (!p) return;
            if (p.path) p.path.classList.toggle("conn-hot", on);
            p.row.classList.toggle("conn-hot", on);
            p.raw.classList.toggle("conn-hot", on);
          }
          rows.forEach(function(row){
            row.addEventListener("mouseenter", function(){ if (row.__pair && !mqMobile.matches && enabled) setHot(row.__pair, true); });
            row.addEventListener("mouseleave", function(){ if (row.__pair) setHot(row.__pair, false); });
          });
          marks.forEach(function(mk){
            mk.addEventListener("mouseenter", function(){ if (mk.__pair && !mqMobile.matches && enabled) setHot(mk.__pair, true); });
            mk.addEventListener("mouseleave", function(){ if (mk.__pair) setHot(mk.__pair, false); });
          });
          var head = document.querySelector("#rawOrderBlock .sf-card-head");
          if (head && pairs.length){
            var lbl = document.createElement("label");
            lbl.className = "order-conn-toggle";
            lbl.title = "顯示／隱藏 原始訂單↔明細 對照連線";
            var cb = document.createElement("input");
            cb.type = "checkbox"; cb.checked = enabled;
            var span = document.createElement("span"); span.textContent = "連線";
            lbl.appendChild(cb); lbl.appendChild(span);
            var pasteBtn = document.getElementById("pasteRawToggleBtn");
            if (pasteBtn && pasteBtn.parentNode === head) head.insertBefore(lbl, pasteBtn); else head.appendChild(lbl);
            cb.addEventListener("change", function(){
              enabled = cb.checked;
              try { localStorage.setItem("songfu.order_conn", enabled ? "1" : "0"); } catch(_){}
              draw();
            });
          }
          var scroller = document.getElementById("rawOrderBlock");
          window.addEventListener("scroll", schedule, { passive: true });
          window.addEventListener("resize", schedule);
          if (scroller) scroller.addEventListener("scroll", schedule, { passive: true });
          if (mqMobile.addEventListener) mqMobile.addEventListener("change", schedule);
          if (window.ResizeObserver){ try { new ResizeObserver(schedule).observe(layout); new ResizeObserver(schedule).observe(table); } catch(_){} }
          setTimeout(draw, 60);
          setTimeout(draw, 250);
        })();
        </script>
        </div>
        </div>
        </div>
        <div id="productModal" class="notion-modal-overlay" style="display:none;">
          <div class="notion-modal">
            <div id="productPickView">
              <h3>選擇品項（模糊搜尋）</h3>
              <input type="search" class="notion-modal-search" id="productSearch" placeholder="輸入品名、料號、條碼...">
              <div class="notion-modal-list" id="productList"></div>
              <div class="notion-modal-actions"><button type="button" class="btn" id="productPickCancel">取消</button></div>
            </div>
            <div id="productConfirmView" style="display:none;">
              <h3 style="margin:0 0 12px;">確認對應與記憶範圍</h3>
              <div style="background:var(--notion-sidebar,#f7f6f3);border:1px solid var(--notion-border,#e3e2e0);border-radius:8px;padding:12px 14px;margin-bottom:14px;font-size:15px;line-height:1.6;">
                <div style="color:var(--notion-text-muted,#787774);font-size:12px;margin-bottom:4px;">原始辨識文字</div>
                <div id="confirmRawName" style="font-weight:600;">—</div>
                <div style="text-align:center;color:var(--notion-accent,#2383e2);font-size:18px;margin:4px 0;">↓ 對應到</div>
                <div id="confirmProductName" style="font-weight:700;font-size:17px;color:var(--notion-accent,#2383e2);">—</div>
              </div>
              <p style="font-size:13px;color:var(--notion-text-muted,#787774);margin:0 0 10px;">這次的修正要記住嗎？（記住後，之後相同辨識文字會自動套用）</p>
              <div style="display:flex;flex-direction:column;gap:8px;">
                <button type="button" class="btn" id="confirmScopeNone" style="text-align:left;padding:10px 12px;">${sfInlineIcon("edit")} <strong>只改這一筆</strong>　<span style="color:var(--notion-text-muted,#787774);font-size:12px;">不記憶，下次重新辨識</span></button>
                <button type="button" class="btn btn-primary" id="confirmScopeCustomer" style="text-align:left;padding:10px 12px;">${sfInlineIcon("user")} <strong>記住此客戶</strong>　<span style="opacity:.85;font-size:12px;">此客戶以後都這樣對應（推薦）</span></button>
                <button type="button" class="btn" id="confirmScopeGlobal" style="text-align:left;padding:10px 12px;">${sfInlineIcon("building")} <strong>記住全公司</strong>　<span style="color:var(--notion-text-muted,#787774);font-size:12px;">所有客戶都套用（謹慎使用）</span></button>
              </div>
              <div class="notion-modal-actions" style="margin-top:12px;"><button type="button" class="btn" id="confirmBackBtn">← 重新選品項</button></div>
            </div>
          </div>
        </div>
        <div id="productEditModal" class="notion-modal-overlay" style="display:none;">
          <div class="notion-modal notion-modal-embed">
            <div class="notion-modal-embed-hd">
              <span>編輯品項</span>
              <button type="button" class="btn" id="productEditModalClose">關閉</button>
            </div>
            <iframe id="productEditFrame" title="編輯品項" src="about:blank"></iframe>
          </div>
        </div>
        <script>
        (function(){
          var orderId = ${JSON.stringify(orderId)};
          var firstAttachmentId = ${JSON.stringify(attachments[0]?.id ?? null)};
          var returnPath = '/admin/orders/' + encodeURIComponent(orderId) + '#items';
          // ── 人工轉正工具列 ──
          (function(){
            var imgs = document.querySelectorAll('.order-attach-img');
            var leftBtn = document.getElementById('rotLeftBtn');
            var rightBtn = document.getElementById('rotRightBtn');
            var label = document.getElementById('rotAngleLabel');
            var goBtn = document.getElementById('rotReRecogBtn');
            var statusEl = document.getElementById('rotStatus');
            if (!imgs.length || !goBtn) return;
            var deg = 0;
            function apply(){
              imgs.forEach(function(im){ im.style.transform = 'rotate(' + deg + 'deg)'; });
              if (label) label.textContent = deg + '°';
              goBtn.disabled = (deg % 360 === 0);
            }
            if (leftBtn) leftBtn.addEventListener('click', function(){ deg = (deg + 270) % 360; apply(); });
            if (rightBtn) rightBtn.addEventListener('click', function(){ deg = (deg + 90) % 360; apply(); });
            if (goBtn) goBtn.addEventListener('click', function(){
              if (deg % 360 === 0) return;
              if (!confirm('把照片轉 ' + deg + '° 後重新辨識？將覆寫目前明細。')) return;
              goBtn.disabled = true;
              if (statusEl) statusEl.textContent = '辨識中…';
              var body = 'degrees=' + encodeURIComponent(deg);
              fetch('/admin/orders/' + encodeURIComponent(orderId) + '/re-recognize-rotated', {
                method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' }, body: body
              }).then(function(r){ return r.json(); }).then(function(d){
                if (d && d.ok) { if (statusEl) statusEl.textContent = '完成，重新整理中…'; location.href = '/admin/orders/' + encodeURIComponent(orderId) + '?ok=rerecog#items'; }
                else { if (statusEl) statusEl.textContent = ''; goBtn.disabled = false; alert((d && d.error) ? d.error : '辨識失敗'); }
              }).catch(function(){ if (statusEl) statusEl.textContent = ''; goBtn.disabled = false; alert('請求失敗'); });
            });
          })();
          var modal = document.getElementById('productModal');
          var editModal = document.getElementById('productEditModal');
          var editFrame = document.getElementById('productEditFrame');
          var editModalClose = document.getElementById('productEditModalClose');
          var listEl = document.getElementById('productList');
          var searchEl = document.getElementById('productSearch');
          var currentItemId = null;
          var currentRawName = '';
          var pendingProductId = null;
          var pendingProductName = '';
          var formDirty = false;
          var pickView = document.getElementById('productPickView');
          var confirmView = document.getElementById('productConfirmView');
          function showPickView(){ if(pickView) pickView.style.display=''; if(confirmView) confirmView.style.display='none'; }
          function showConfirmView(){
            if(pickView) pickView.style.display='none';
            if(confirmView) confirmView.style.display='';
            var rn = document.getElementById('confirmRawName');
            var pn = document.getElementById('confirmProductName');
            if(rn) rn.textContent = currentRawName || '（無原始文字）';
            if(pn) pn.textContent = pendingProductName || '';
          }
          function closeProductModal(){ modal.style.display='none'; showPickView(); pendingProductId=null; }
          function openProductEdit(productId, ctx){
            if (!productId || !editModal || !editFrame) return;
            var u = '/admin/products/' + encodeURIComponent(productId) + '/edit?embed=1&return=' + encodeURIComponent(returnPath);
            if (ctx && ctx.raw) u += '&context_raw=' + encodeURIComponent(ctx.raw);
            if (ctx && ctx.unit) u += '&context_unit=' + encodeURIComponent(ctx.unit);
            editFrame.src = u;
            editModal.style.display = 'flex';
          }
          function closeProductEdit(){
            if (editModal) editModal.style.display = 'none';
            if (editFrame) editFrame.src = 'about:blank';
          }
          if (editModalClose) editModalClose.addEventListener('click', closeProductEdit);
          if (editModal) editModal.addEventListener('click', function(e){ if (e.target === editModal) closeProductEdit(); });
          var btnSaveExample = document.getElementById('btn-save-example');
          if (btnSaveExample) {
            btnSaveExample.addEventListener('click', function(){
              if (!firstAttachmentId) {
                alert('此訂單無圖片附件，無法存為 AI 視覺範例。');
                return;
              }
              if (!confirm('請確認目前畫面上的品項與數量皆已 100% 正確。是否將此單存為該客戶的 AI 辨識範例？')) return;
              btnSaveExample.disabled = true;
              fetch('/admin/api/orders/' + encodeURIComponent(orderId) + '/save-as-example', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ attachment_id: firstAttachmentId, quality_score: 100 })
              })
                .then(function(r){
                  return r.text().then(function(t){
                    try { return { ok: r.ok, status: r.status, j: JSON.parse(t) }; } catch (e) { return { ok: false, status: r.status, j: { ok: false, error: t || ('HTTP ' + r.status) } }; }
                  });
                })
                .then(function(x){
                  btnSaveExample.disabled = false;
                  if (x.ok && x.j && x.j.ok) {
                    alert('儲存成功');
                  } else {
                    var errMsg = (x.j && (x.j.error || x.j.message)) ? String(x.j.error || x.j.message) : ('HTTP ' + (x.status || ''));
                    alert('儲存失敗: ' + errMsg);
                  }
                })
                .catch(function(err){
                  btnSaveExample.disabled = false;
                  alert('儲存失敗: ' + (err && err.message ? err.message : '請稍後再試'));
                });
            });
          }
          function searchProducts(q){
            fetch('/admin/api/products-search?q=' + encodeURIComponent(q)).then(function(r){ return r.json(); }).then(function(arr){
              listEl.innerHTML = arr.map(function(p){
                var esc = function(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
                var nm = esc(p.name);
                return '<div data-product-id="' + (p.id || '') + '" data-product-name="' + nm + '" class="product-option">' + nm + ' ' + esc(p.erp_code) + ' ' + esc(p.teraoka_barcode) + '</div>';
              }).join('') || '<div>無符合品項</div>';
            });
          }
          searchProducts('');
          searchEl.oninput = function(){ searchProducts(searchEl.value); };
          document.addEventListener('click', function(e){
            var nameEdit = e.target.closest('.product-name-edit');
            if (nameEdit) {
              e.preventDefault();
              var tr = nameEdit.closest('tr');
              var raw = (tr && tr.getAttribute('data-raw-name')) || '';
              var uu = (tr && tr.getAttribute('data-line-unit')) || '';
              openProductEdit(nameEdit.getAttribute('data-product-id'), { raw: raw, unit: uu });
              return;
            }
            var pick = e.target.closest('.product-pick');
            if (pick) {
              e.preventDefault();
              currentItemId = pick.getAttribute('data-item-id');
              var pickTr = pick.closest('tr');
              // 「改品項」連結無 data-raw，改從該列 data-raw-name 取得原始辨識文字
              currentRawName = pick.getAttribute('data-raw') || (pickTr && pickTr.getAttribute('data-raw-name')) || '';
              pendingProductId = null;
              showPickView();
              modal.style.display = 'flex';
              searchEl.value = currentRawName;
              searchProducts(searchEl.value);
            }
          });
          // 步驟一：選品項 → 不立刻存，先進入「確認記憶範圍」步驟
          listEl.addEventListener('click', function(e){
            var div = e.target.closest('.product-option');
            if (!div || !currentItemId) return;
            var productId = div.getAttribute('data-product-id');
            if (!productId) return;
            pendingProductId = productId;
            pendingProductName = div.getAttribute('data-product-name') || (div.textContent || '').trim();
            showConfirmView();
          });
          // 步驟二：依使用者選的範圍送出（scope=none/customer/global）
          function submitProductChange(scope){
            if (!pendingProductId || !currentItemId) { closeProductModal(); return; }
            var theItemId = currentItemId;
            var url = '/admin/orders/' + encodeURIComponent(orderId) + '/items/' + encodeURIComponent(theItemId) + '/product';
            var body = 'product_id=' + encodeURIComponent(pendingProductId) + '&scope=' + encodeURIComponent(scope);
            closeProductModal();
            fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' }, body: body })
              .then(function(r){ return r.json(); })
              .then(function(data){
                if (data && data.ok && data.productName !== undefined) {
                  var tr = document.querySelector('tr[data-item-id="' + theItemId.replace(/"/g, '\\"') + '"]');
                  var pid = (data.productId || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                  var pnm = (data.productName || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                  var namePart = pid ? ('<a href="#" class="product-name-edit" data-product-id="' + pid + '" title="編輯此品項（俗名、單位等）">' + pnm + '</a>') : pnm;
                  if (tr && tr.cells[4]) tr.cells[4].innerHTML = namePart + ' <a href="#" class="product-pick product-change" data-item-id="' + theItemId.replace(/"/g, '&quot;') + '">改品項</a>';
                } else { alert(data && data.error ? data.error : '更新失敗'); }
              })
              .catch(function(){ alert('請求失敗'); });
          }
          (function(){
            var bNone = document.getElementById('confirmScopeNone');
            var bCust = document.getElementById('confirmScopeCustomer');
            var bGlob = document.getElementById('confirmScopeGlobal');
            var bBack = document.getElementById('confirmBackBtn');
            var bCancel = document.getElementById('productPickCancel');
            if (bNone) bNone.addEventListener('click', function(){ submitProductChange('none'); });
            if (bCust) bCust.addEventListener('click', function(){ submitProductChange('customer'); });
            if (bGlob) bGlob.addEventListener('click', function(){ submitProductChange('global'); });
            if (bBack) bBack.addEventListener('click', function(){ showPickView(); });
            if (bCancel) bCancel.addEventListener('click', function(){ closeProductModal(); });
          })();
          document.addEventListener('click', function(e){
            var up = e.target.closest('.btn-move-up');
            if (up) {
              var trU = up.closest('tr');
              if (trU && trU.previousElementSibling) {
                trU.parentNode.insertBefore(trU, trU.previousElementSibling);
                formDirty = true;
              }
              return;
            }
            var down = e.target.closest('.btn-move-down');
            if (down) {
              var trD = down.closest('tr');
              if (trD && trD.nextElementSibling) {
                trD.parentNode.insertBefore(trD.nextElementSibling, trD);
                formDirty = true;
              }
              return;
            }
            var btn = e.target.closest('.btn-delete-item');
            if (!btn) return;
            var itemId = btn.getAttribute('data-item-id');
            var ordId = btn.getAttribute('data-order-id');
            var rawName = btn.getAttribute('data-raw-name') || '此品項';
            if (!itemId || !ordId) return;
            // 作廢原因彈窗（用 prompt 簡易選單）
            var reasonInput = window.prompt('作廢「' + rawName + '」的原因？\\n\\n  1 = AI 辨識錯誤（預設，會回饋給學習庫）\\n  2 = 客戶更改\\n  3 = 重複叫貨\\n  4 = 其他\\n\\n按「取消」放棄作廢。', '1');
            if (reasonInput === null) return;
            var reasonMap = { '1':'ai_wrong', '2':'customer_changed', '3':'duplicate', '4':'other' };
            var reason = reasonMap[String(reasonInput).trim()] || 'ai_wrong';
            var note = '';
            if (reason !== 'ai_wrong') {
              note = window.prompt('備註（可留白）：', '') || '';
            }
            var fd = new FormData();
            fd.append('void_reason', reason);
            if (note) fd.append('void_note', note);
            var url = '/admin/orders/' + encodeURIComponent(ordId) + '/items/' + encodeURIComponent(itemId) + '/delete';
            fetch(url, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept':'application/json' }, body: fd })
              .then(function(r){ return r.json(); })
              .then(function(data){ if (data && data.ok) { var tr = btn.closest('tr'); if (tr) tr.remove(); } else { alert(data && data.error ? data.error : '作廢失敗'); } })
              .catch(function(){ alert('請求失敗'); });
          });
          // 全域 toast 已抽到 shell 級共用實作（uiScript 內的 window.sfToast），此頁與庫存頁共用同一份實作與時長。
          // 用薄包裝在「呼叫當下」解析 window.sfToast（uiScript 位於 body 內容之後，parse 時可能尚未定義；
          // 但所有 sfToast 呼叫都在事件處理器內、載入後才觸發，此時 window.sfToast 已就緒）。
          function sfToast(text, kind){ if (window.sfToast) window.sfToast(text, kind); }
          // 轉為客訴：AJAX 呼叫，成功後跳 toast、留在本頁（不跳轉到客訴畫面，避免一直點來點去）
          (function(){
            var btnTC = document.getElementById('btnToComplaint');
            if (!btnTC) return;
            btnTC.addEventListener('click', function(){
              if (!confirm('確定將此筆轉為客訴？將不再出現在訂單列表，並進入客訴處理流程。')) return;
              var oid = btnTC.getAttribute('data-order-id');
              btnTC.disabled = true;
              fetch('/admin/orders/' + encodeURIComponent(oid) + '/to-complaint', { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' } })
                .then(function(r){ return r.json().catch(function(){ return { ok: r.ok }; }); })
                .then(function(d){
                  if (d && d.ok) {
                    sfToast('✓ 已轉為客訴，此筆已移出訂單列表');
                    btnTC.textContent = '✓ 已轉客訴';
                    btnTC.style.color = '#059669';
                    btnTC.style.borderColor = '#a7f3d0';
                  } else {
                    btnTC.disabled = false;
                    sfToast('轉為客訴失敗，請再試一次', 'err');
                  }
                })
                .catch(function(){ btnTC.disabled = false; sfToast('轉為客訴請求失敗，請檢查網路', 'err'); });
            });
          })();
          var itemsForm = document.getElementById('itemsForm');
          var itemsSaving = false;
          // 儲存明細（AJAX）抽成函式，回傳 Promise<boolean>；供「儲存明細」與「確認→下一筆」共用
          function doSaveItems(submitterBtn){
            return new Promise(function(resolve){
              if (!itemsForm) { resolve(true); return; } // 沒有明細表單，視為已存
              if (itemsSaving) { resolve(false); return; } // 防連點重複送出
              itemsSaving = true;
              var btn = (submitterBtn && submitterBtn.getAttribute && submitterBtn.getAttribute('type') === 'submit') ? submitterBtn : itemsForm.querySelector('button[type="submit"]');
              var saveBtns = Array.prototype.slice.call(itemsForm.querySelectorAll('button[type="submit"]'));
              var origText = btn ? btn.innerHTML : '';
              saveBtns.forEach(function(b){ b.disabled = true; });
              if (btn) btn.textContent = '儲存中…';
              function restore(){ itemsSaving = false; saveBtns.forEach(function(b){ b.disabled = false; }); if (btn) btn.innerHTML = origText; }
              var formData = new FormData(itemsForm);
              formData.delete("selected_items");
              var params = new URLSearchParams(formData);
              var seq = 1;
              itemsForm.querySelectorAll('tbody tr[data-item-id]').forEach(function(tr){
                var id = tr.getAttribute('data-item-id');
                if (id) { params.append('ord_' + id, String(seq)); seq++; }
              });
              fetch(itemsForm.action, { method: 'POST', body: params, headers: { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' } })
                .then(function(r){
                  return r.text().then(function(t){
                    var d = null;
                    try { d = t ? JSON.parse(t) : null; } catch (_) { /* 非 JSON：保留原始文字 */ }
                    return { ok: r.ok, status: r.status, data: d, rawText: t };
                  });
                })
                .then(function(result){
                  restore();
                  if (result.ok && result.data && result.data.ok) {
                    formDirty = false;
                    sfToast('✓ 已儲存明細');
                    resolve(true);
                  } else {
                    var serverMsg = (result.data && result.data.error)
                      ? result.data.error
                      : (result.rawText ? String(result.rawText).slice(0, 200) : '');
                    console.error('[儲存明細] HTTP ' + result.status, result);
                    sfToast('儲存失敗 (HTTP ' + result.status + ')' + (serverMsg ? '：' + serverMsg : '，請再試一次'), 'err');
                    resolve(false);
                  }
                })
                .catch(function(err){
                  restore();
                  console.error('[儲存明細] 請求例外：', err);
                  sfToast('儲存請求失敗：' + (err && err.message ? err.message : '網路或伺服器無回應'), 'err');
                  resolve(false);
                });
            });
          }
          // 供「新增/插入品項」流程先自動存明細用（該段 script 在前面、不同 IIFE 作用域）
          window.doSaveItems = doSaveItems;
          if (itemsForm) {
            itemsForm.addEventListener('change', function(){ formDirty = true; });
            itemsForm.addEventListener('input', function(){ formDirty = true; });
            itemsForm.addEventListener('submit', function(e){ e.preventDefault(); doSaveItems(e.submitter); });
          }
          // 「確認 → 下一筆」：若明細有未存變更，先自動存明細、成功才確認並跳下一筆
          // （解決按下一筆一直彈「未儲存」通知、以及存了還被擋的困擾；存檔失敗則停在本頁不放行）
          var approveForm = document.getElementById('approveOrderForm');
          if (approveForm) {
            approveForm.addEventListener('submit', function(e){
              if (!formDirty) return; // 無未存變更，直接放行（beforeunload 因 formDirty=false 不會彈）
              e.preventDefault();
              doSaveItems(null).then(function(ok){
                if (ok) { formDirty = false; approveForm.submit(); }
                else { sfToast('明細尚未存成功，已停在本頁，請確認後再按一次「確認」', 'err'); }
              });
            });
          }
          window.addEventListener('beforeunload', function(e){
            if (!formDirty) return;
            e.preventDefault();
            e.returnValue = '';
          });
          document.addEventListener('submit', function(e){
            var f = e.target;
            if (!formDirty || !f || f.tagName !== 'FORM') return;
            if (f.id === 'itemsForm' || f.id === 'approveOrderForm') return; // 這兩個自己處理（存明細／存後確認）
            if (confirm('明細有尚未儲存的變更，確定要離開此頁？')) { formDirty = false; }
            else { e.preventDefault(); }
          }, true);
          document.addEventListener('click', function(e){
            var a = e.target.closest('a');
            if (!a || !formDirty) return;
            var href = a.getAttribute('href') || '';
            if (!href || href.startsWith('#')) return;
            if (confirm('明細有尚未儲存的變更，確定要離開此頁？')) { formDirty = false; return; }
            e.preventDefault();
          }, true);
          var pasteBtn = document.getElementById('pasteRawToggleBtn');
          var pastePanel = document.getElementById('pasteRaw');
          function setPasteOpen(open){
            if (!pastePanel || !pasteBtn) return;
            pastePanel.style.display = open ? 'block' : 'none';
            pasteBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
            pasteBtn.textContent = open ? '收合' : '補登／修正';
          }
          if (pasteBtn && pastePanel) {
            pasteBtn.addEventListener('click', function(){
              var hidden = window.getComputedStyle(pastePanel).display === 'none';
              setPasteOpen(hidden);
            });
            var qs = window.location.search || '';
            var h = (window.location.hash || '').replace(/^#/, '');
            if (h === 'pasteRaw' || /err=apply_raw/.test(qs)) setPasteOpen(true);
          }
          var selAllItems = document.getElementById('select_all_items');
          if (selAllItems) {
            selAllItems.addEventListener('change', function(){
              document.querySelectorAll('tbody .item-select-cb').forEach(function(cb){ cb.checked = selAllItems.checked; });
            });
          }
          var btnMoveItems = document.getElementById('btn_move_items');
          if (btnMoveItems) {
            btnMoveItems.addEventListener('click', function(){
              var ids = [];
              document.querySelectorAll('tbody .item-select-cb:checked').forEach(function(cb){ ids.push(cb.value); });
              var sel = document.getElementById('target_sub_customer');
              var custom = document.getElementById('target_sub_customer_custom');
              var customVal = (custom && custom.value.trim()) ? custom.value.trim() : '';
              var targetName = '';
              if (customVal) {
                targetName = customVal;
              } else if (sel) {
                if (sel.value === '__custom__') {
                  alert('請在下方輸入框填寫目標子客戶正式名稱。');
                  return;
                }
                targetName = sel.value || '';
              }
              if (!ids.length) { alert('請至少勾選一筆品項。'); return; }
              var st = document.getElementById('move_items_status');
              if (st) st.textContent = '處理中…';
              btnMoveItems.disabled = true;
              fetch('/admin/api/orders/' + encodeURIComponent(orderId) + '/move-items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ itemIds: ids, targetSubCustomer: targetName })
              })
                .then(function(r){ return r.json().then(function(j){ return { ok: r.ok, j: j }; }); })
                .then(function(x){
                  btnMoveItems.disabled = false;
                  if (st) st.textContent = '';
                  if (x.ok && x.j && x.j.ok) {
                    window.location.reload();
                    return;
                  }
                  alert(x.j && x.j.error ? x.j.error : '轉移失敗');
                })
                .catch(function(){
                  btnMoveItems.disabled = false;
                  if (st) st.textContent = '';
                  alert('請求失敗');
                });
            });
          }
          // 依子客戶一鍵拆單：先自動存明細（把剛填的「子客戶」存進資料庫），再呼叫拆單
          var btnSplitSub = document.getElementById('btn_split_by_subcust');
          if (btnSplitSub) {
            btnSplitSub.addEventListener('click', function(){
              if (!confirm('將把有填「子客戶」的品項各自拆成獨立訂單（每個子客戶一筆），並自動補該路線空籃。\\n拆出去的訂單會出現在待確認清單，附有同一張原始訂單照片。\\n\\n確定拆單？')) return;
              var st = document.getElementById('move_items_status');
              btnSplitSub.disabled = true;
              if (st) st.textContent = '拆單中…';
              var pre = (typeof window.doSaveItems === 'function') ? window.doSaveItems() : Promise.resolve(true);
              pre.then(function(saved){
                if (saved === false) { btnSplitSub.disabled = false; if (st) st.textContent = ''; return; }
                fetch('/admin/api/orders/' + encodeURIComponent(orderId) + '/split-by-sub-customer', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                  credentials: 'same-origin'
                })
                  .then(function(r){ return r.json().then(function(j){ return { ok: r.ok, j: j }; }); })
                  .then(function(x){
                    btnSplitSub.disabled = false;
                    if (st) st.textContent = '';
                    if (x.ok && x.j && x.j.ok) {
                      var n = (x.j.moved || []).length;
                      sfToast('✓ 已拆出 ' + n + ' 筆子客戶訂單（空籃已補），即將重新整理…');
                      setTimeout(function(){ window.location.reload(); }, 900);
                      return;
                    }
                    alert(x.j && x.j.error ? x.j.error : '拆單失敗');
                  })
                  .catch(function(){
                    btnSplitSub.disabled = false;
                    if (st) st.textContent = '';
                    alert('拆單請求失敗');
                  });
              });
            });
          }
        })();
        </script>
      `;
        // 內稽稽核軌跡：列出本訂單與其品項的所有變更紀錄
        let auditRows = [];
        try {
            auditRows = await db.prepare(
                "SELECT created_at, actor_username, action, summary, meta_json, entity_type, entity_id " +
                "FROM data_change_log WHERE (entity_type = 'order' AND entity_id = ?) " +
                "OR (entity_type = 'order_item' AND meta_json LIKE ?) " +
                "ORDER BY created_at DESC LIMIT 100"
            ).all(req.params.orderId, `%"order_id":"${req.params.orderId}"%`);
        }
        catch (e) {
            console.warn("[admin] audit fetch failed:", e?.message || e);
        }
        const auditRowsHtml = auditRows.length
            ? auditRows.map(r => `<tr><td style="white-space:nowrap;font-size:12px;">${escapeHtml(r.created_at || "")}</td><td style="font-size:12px;">${escapeHtml(r.actor_username || "－")}</td><td style="font-size:12px;"><span style="display:inline-block;padding:1px 6px;border-radius:4px;background:#f0f0f0;">${escapeHtml(r.action || "")}</span></td><td style="font-size:12px;">${escapeHtml(r.summary || "")}</td></tr>`).join("")
            : "<tr><td colspan='4' style='color:#999;text-align:center;'>尚無稽核紀錄</td></tr>";
        const auditCard = `
        <div class="notion-card" style="margin-top:20px;">
          <h2 style="margin-top:0;font-size:16px;">稽核軌跡（內稽用）</h2>
          <p class="notion-hint" style="margin:6px 0 12px 0;">列出本訂單與其品項所有的變更／作廢／確認紀錄。任何「刪除」會保留品項快照於日誌中，可透過 metadata 還原。</p>
          <table style="width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:left;font-size:12px;padding:4px 6px;border-bottom:1px solid var(--notion-border);">時間</th><th style="text-align:left;font-size:12px;padding:4px 6px;border-bottom:1px solid var(--notion-border);">操作者</th><th style="text-align:left;font-size:12px;padding:4px 6px;border-bottom:1px solid var(--notion-border);">動作</th><th style="text-align:left;font-size:12px;padding:4px 6px;border-bottom:1px solid var(--notion-border);">說明</th></tr></thead><tbody>${auditRowsHtml}</tbody></table>
        </div>`;
        // 轉入凌越彈窗（明細頁；與列表頁同一份，複製貼上，見 CLAUDE.md 不強求 DRY）
        const lyTransferModalHtml = `
        <div id="lyTransferModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;align-items:flex-start;justify-content:center;padding:32px 16px;overflow:auto;">
          <div class="sf-card" style="max-width:640px;width:100%;margin:auto;" onclick="event.stopPropagation();">
            <div class="sf-card-head">
              <div class="sf-card-title">↩ 轉入凌越 <span id="lyTransferOrderNo" class="sf-pill"></span></div>
              <button type="button" class="sf-btn sm ghost" id="lyTransferClose" title="關閉">✕</button>
            </div>
            <div style="padding:14px 16px;">
              <div id="lyTransferLoading" style="color:var(--txt-3);font-size:13px;">讀取中…</div>
              <div id="lyTransferContent" style="display:none;"></div>
            </div>
            <div style="padding:12px 16px;border-top:var(--hairline);display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
              <span id="lyTransferMsg" style="font-size:12px;color:var(--txt-3);flex:1;min-width:180px;"></span>
              <div style="display:flex;gap:8px;">
                <button type="button" class="sf-btn sm ghost" id="lyTransferCancel">關閉</button>
                <button type="button" class="sf-btn sm primary" id="lyTransferConfirm" disabled>確認轉入</button>
              </div>
            </div>
          </div>
        </div>
        <script>
        (function(){
          var modal = document.getElementById("lyTransferModal");
          if (!modal) return;
          var titleNo = document.getElementById("lyTransferOrderNo");
          var loading = document.getElementById("lyTransferLoading");
          var content = document.getElementById("lyTransferContent");
          var msg = document.getElementById("lyTransferMsg");
          var confirmBtn = document.getElementById("lyTransferConfirm");
          var curId = null;
          function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
          function openModal(){ modal.style.display="flex"; document.body.style.overflow="hidden"; }
          function closeModal(){ modal.style.display="none"; document.body.style.overflow=""; }
          function renderPreview(d){
            if (!d || d.ok === false) { loading.textContent = "讀取失敗：" + ((d && d.error) || ""); return; }
            var rows = (d.items||[]).map(function(it){
              var code = it.product_code ? '<span class="mono">'+esc(it.product_code)+'</span>' : '<span style="color:#b91c1c;font-weight:700;">缺料號</span>';
              return '<tr><td style="font-size:12px;">'+code+'</td><td>'+esc(it.product_name)+'</td><td style="text-align:right;">'+esc(it.quantity)+'</td><td>'+esc(it.unit)+'</td></tr>';
            }).join("");
            var custCode = d.customer_code ? '<span class="mono">('+esc(d.customer_code)+')</span>' : '<span style="color:#b91c1c;">（缺凌越編號）</span>';
            var head = '<div style="font-size:12px;color:var(--txt-2);margin-bottom:8px;">客戶：'+esc(d.customer_name)+' '+custCode+' · 出貨日 '+esc(d.order_date)+'</div>';
            var warn = "";
            if (d.missing_count > 0) warn += '<div class="sf-pill warn" style="margin:0 0 8px;display:inline-block;">有 '+d.missing_count+' 項缺凌越料號，這些列凌越收不進去，請先到明細補料號</div>';
            if (!d.customer_code) warn += '<div class="sf-pill bad" style="margin:0 0 8px;display:inline-block;">此客戶缺凌越編號（HQCustCode），請先到客戶編輯補上</div>';
            content.innerHTML = head + warn + '<div style="overflow-x:auto;"><table class="sf-table" style="font-size:12px;"><thead><tr><th>凌越料號</th><th>品名</th><th style="text-align:right;">數量</th><th>單位</th></tr></thead><tbody>'+(rows||'<tr><td colspan="4" style="text-align:center;color:var(--txt-3);padding:16px;">無可轉入品項</td></tr>')+'</tbody></table></div>';
            content.style.display="block"; loading.style.display="none";
            confirmBtn.disabled = !(d.items && d.items.length);
          }
          document.querySelectorAll(".lingyue-transfer-btn").forEach(function(btn){
            btn.addEventListener("click", function(){
              curId = this.dataset.id;
              titleNo.textContent = this.dataset.orderno || "";
              loading.style.display="block"; loading.textContent="讀取中…"; content.style.display="none"; content.innerHTML="";
              msg.textContent=""; confirmBtn.disabled=true;
              openModal();
              fetch("/admin/orders/"+encodeURIComponent(curId)+"/lingyue-preview", {method:"POST", credentials:"same-origin"})
                .then(function(r){ return r.json(); }).then(renderPreview)
                .catch(function(){ loading.textContent="讀取失敗，請重試。"; });
            });
          });
          function lySubmit(force){
            confirmBtn.disabled=true; msg.textContent="轉入中…";
            fetch("/admin/orders/"+encodeURIComponent(curId)+"/lingyue-transfer"+(force?"?force=1":""), {method:"POST", credentials:"same-origin"})
              .then(function(r){ return r.json(); })
              .then(function(res){
                if (res && res.ok && res.doc_no) { msg.textContent = "✅ 已轉入凌越，單據號 " + res.doc_no + "，即將重新整理…"; setTimeout(function(){ location.reload(); }, 1200); }
                else if (res && res.queued) { msg.textContent = "✅ " + (res.message || "已排入凌越匯入佇列，數秒內自動完成…") + " 稍候自動重新整理。"; setTimeout(function(){ location.reload(); }, 6000); }
                else if (res && res.needConfirm) { if (window.confirm(res.message || "此單已轉入凌越，確定要重新轉入嗎？請先到凌越刪除舊單。")) { lySubmit(true); } else { msg.textContent="已取消重新轉入。"; confirmBtn.disabled=false; } }
                else if (res && res.mode === "preview") { msg.textContent = "ℹ️ " + (res.message || "這台無法直接寫入凌越，僅顯示料號預覽。"); confirmBtn.disabled=false; }
                else { msg.textContent = "❌ " + ((res && res.error) || "轉入失敗"); confirmBtn.disabled=false; }
              })
              .catch(function(){ msg.textContent="❌ 轉入失敗，請重試。"; confirmBtn.disabled=false; });
          }
          confirmBtn.addEventListener("click", function(){ if (!curId) return; lySubmit(false); });
          document.getElementById("lyTransferClose").addEventListener("click", closeModal);
          document.getElementById("lyTransferCancel").addEventListener("click", closeModal);
          modal.addEventListener("click", function(e){ if (e.target===modal) closeModal(); });
          document.addEventListener("keydown", function(e){ if (e.key==="Escape" && modal.style.display==="flex") closeModal(); });
        })();
        </script>`;
        res.type("text/html").send(notionPage("訂單明細", body + auditCard + lyTransferModalHtml, "orders", res));
    });
    router.get("/orders/:orderId/attachment/:messageId", async (req, res) => {
        const { orderId, messageId } = req.params;
        const att = await db.prepare("SELECT id FROM order_attachments WHERE order_id = ? AND line_message_id = ?").get(orderId, messageId);
        if (!att) {
            res.status(404).send("找不到該附件");
            return;
        }
        const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        if (!token) {
            res.status(503).send("未設定 LINE Channel Access Token，無法取得圖片");
            return;
        }
        try {
            const resp = await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!resp.ok) {
                res.status(resp.status).send("無法取得 LINE 圖片");
                return;
            }
            const contentType = resp.headers.get("content-type") || "image/jpeg";
            res.setHeader("Content-Type", contentType);
            const buf = await resp.arrayBuffer();
            res.send(Buffer.from(buf));
        }
        catch (e) {
            console.error("[admin] 取得 LINE 圖片失敗:", e?.message || e);
            res.status(500).send("取得圖片時發生錯誤");
        }
    });
    // 照片辨識框：對附件圖跑 Google Vision，回傳每個字詞的方框＋圖片尺寸。
    // 按鈕觸發（前端），行程內快取避免同一張重複計費。
    const _ocrBoxCache = new Map();
    router.get("/orders/:orderId/attachment/:messageId/ocr-boxes", async (req, res) => {
        const { orderId, messageId } = req.params;
        const att = await db.prepare("SELECT id FROM order_attachments WHERE order_id = ? AND line_message_id = ?").get(orderId, messageId);
        if (!att) {
            res.status(404).json({ ok: false, error: "找不到該附件" });
            return;
        }
        if (_ocrBoxCache.has(messageId)) {
            res.json(Object.assign({ ok: true, cached: true }, _ocrBoxCache.get(messageId)));
            return;
        }
        const hasVision = process.env.VISION_USE_ADC === "1" || !!process.env.GOOGLE_CLOUD_VISION_API_KEY;
        if (!hasVision) {
            res.status(503).json({ ok: false, error: "未設定 Google Vision（GOOGLE_CLOUD_VISION_API_KEY 或 VISION_USE_ADC）" });
            return;
        }
        const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        if (!token) {
            res.status(503).json({ ok: false, error: "未設定 LINE Channel Access Token" });
            return;
        }
        try {
            const resp = await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!resp.ok) {
                res.status(resp.status).json({ ok: false, error: "無法取得 LINE 圖片" });
                return;
            }
            const buf = Buffer.from(await resp.arrayBuffer());
            const boxes = await (0, vision_ocr_js_1.getWordBoxesFromImageBuffer)(buf);
            if (!boxes || !boxes.words || boxes.words.length === 0) {
                res.status(502).json({ ok: false, error: "Vision 未偵測到文字（或未回應）" });
                return;
            }
            _ocrBoxCache.set(messageId, boxes);
            res.json(Object.assign({ ok: true, cached: false }, boxes));
        }
        catch (e) {
            console.error("[admin] ocr-boxes 失敗:", e?.message || e);
            res.status(500).json({ ok: false, error: "辨識框處理失敗" });
        }
    });
    router.post("/orders/:orderId/re-recognize", async (req, res) => {
        const { orderId } = req.params;
        const backTo = (typeof req.query.back === "string" && req.query.back.startsWith("/admin/orders"))
            ? req.query.back
            : "/admin/orders";
        const redirErr = (code) => {
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?err=" + encodeURIComponent(code) + "&back=" + encodeURIComponent(backTo) + "#items");
        };
        try {
            const order = await db.prepare("SELECT id, customer_id, raw_message, lingyue_doc_no, lingyue_written_at FROM orders WHERE id = ?").get(orderId);
            if (!order) {
                res.status(404).send("訂單不存在");
                return;
            }
            // [fix 2026-07-28 §二B2] 守衛：已回寫凌越的單重新辨識＝整單品項 DELETE+INSERT，
            // 但凌越那張單不會跟著變 → 後台與 ERP 靜默分歧。未帶 force 一律擋，給可行動訊息。
            const force = req.query.force === "1" || req.query.force === "true";
            if ((order.lingyue_doc_no || order.lingyue_written_at) && !force) {
                redirErr("rerecog_written");
                return;
            }
            const beforeItems = await db.prepare("SELECT raw_name, quantity, unit, product_id FROM order_items WHERE order_id = ? AND voided_at IS NULL").all(orderId);
            const attachments = await db.prepare("SELECT line_message_id FROM order_attachments WHERE order_id = ? ORDER BY created_at ASC").all(orderId);
            const result = await rebuildOrderItemsForReRecognize(orderId, order.customer_id, order.raw_message, attachments);
            if (!result.ok) {
                const err = result.error;
                const code = err === "line_token"
                    ? "rerecog_line"
                    : err === "no_vision"
                        ? "rerecog_vision"
                        : err === "empty_source"
                            ? "rerecog_empty"
                            : err === "no_gemini_key"
                                ? "rerecog_gemini"
                                : err === "gemini_empty"
                                    ? "rerecog_gemini_empty"
                                    : err === "split_no_match"
                                        ? "rerecog_split"
                                        : "rerecog";
                redirErr(code);
                return;
            }
            try {
                const afterItems = await db.prepare("SELECT raw_name, quantity, unit, product_id FROM order_items WHERE order_id = ? AND voided_at IS NULL").all(orderId);
                await logDataChange(req, {
                    entityType: "order",
                    entityId: orderId,
                    action: "re_recognize",
                    summary: `重新辨識訂單明細（${beforeItems.length} 項 → ${afterItems.length} 項）${force ? "（force：已略過凌越守衛）" : ""}`,
                    meta: { force, forcedOverWritten: !!(order.lingyue_doc_no || order.lingyue_written_at), before: beforeItems, after: afterItems },
                });
            } catch (_) { /* 稽核失敗不影響主流程 */ }
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=rerecog&back=" + encodeURIComponent(backTo) + "#items");
        }
        catch (e) {
            console.error("[admin] re-recognize failed", e?.message || e, e?.stack);
            redirErr("rerecog");
        }
    });
    /** 人工旋轉後重新辨識：把附件圖按指定角度轉正（跳過自動偵測），重跑辨識覆寫明細。回 JSON。 */
    router.post("/orders/:orderId/re-recognize-rotated", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const { orderId } = req.params;
        try {
            const degRaw = parseInt(String(req.body.degrees || "0"), 10);
            const deg = ((Number.isFinite(degRaw) ? degRaw : 0) % 360 + 360) % 360;
            const order = await db.prepare("SELECT id, customer_id, raw_message, lingyue_doc_no, lingyue_written_at FROM orders WHERE id = ?").get(orderId);
            if (!order) { res.status(404).json({ ok: false, error: "訂單不存在" }); return; }
            // [fix 2026-07-28 §二B2] 旋轉重辨識同樣是整單覆寫；已轉入凌越的單擋下，避免後台與 ERP 分歧。
            if (order.lingyue_doc_no || order.lingyue_written_at) {
                res.status(409).json({ ok: false, error: "此單已轉入凌越，不能重新辨識（會與凌越不一致）。請先刪除凌越舊單再處理。" });
                return;
            }
            const beforeItems = await db.prepare("SELECT raw_name, quantity, unit, product_id FROM order_items WHERE order_id = ? AND voided_at IS NULL").all(orderId);
            const attachments = await db.prepare("SELECT line_message_id FROM order_attachments WHERE order_id = ? ORDER BY created_at ASC").all(orderId);
            if (!attachments.length) { res.status(400).json({ ok: false, error: "此訂單沒有圖片附件，無法旋轉重新辨識。" }); return; }
            const result = await rebuildOrderItemsForReRecognize(orderId, order.customer_id, order.raw_message, attachments, { forceRotateDeg: deg, skipAutoOrient: true });
            if (!result.ok) {
                res.json({ ok: false, error: "旋轉 " + deg + "° 後仍無法辨識出品項（error=" + (result.error || "parse") + "）。可換個角度再試。" });
                return;
            }
            try {
                const afterItems = await db.prepare("SELECT raw_name, quantity, unit, product_id FROM order_items WHERE order_id = ? AND voided_at IS NULL").all(orderId);
                await logDataChange(req, {
                    entityType: "order",
                    entityId: orderId,
                    action: "re_recognize_rotated",
                    summary: `旋轉 ${deg}° 後重新辨識明細（${beforeItems.length} 項 → ${afterItems.length} 項）`,
                    meta: { degrees: deg, before: beforeItems, after: afterItems },
                });
            } catch (_) { /* 稽核失敗不影響主流程 */ }
            res.json({ ok: true, degrees: deg });
        }
        catch (e) {
            console.error("[admin] re-recognize-rotated failed", e?.message || e);
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
        }
    });
    /** 手動將訂單附件圖 + 目前明細存為 Few-Shot 範例（圖檔存於 data/few-shot-examples，DB 僅存 image_path） */
    router.post("/orders/:orderId/few-shot-example", express_1.default.json(), express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const { orderId } = req.params;
        const wantsJson = req.get("X-Requested-With") === "XMLHttpRequest" || (req.get("Accept") || "").includes("application/json");
        try {
            const attachmentId = String(req.body?.attachment_id ?? "").trim();
            const qualityRaw = req.body?.quality_score;
            const note = String(req.body?.note ?? "").trim().slice(0, 500);
            const qualityScore = qualityRaw != null && qualityRaw !== "" ? parseFloat(String(qualityRaw)) : 1;
            if (!attachmentId) {
                if (wantsJson) {
                    res.status(400).json({ ok: false, error: "缺少 attachment_id（order_attachments 資料表 id）" });
                    return;
                }
                res.status(400).send("缺少 attachment_id");
                return;
            }
            const result = await few_shot_example_save_js_1.saveFewShotExampleFromOrderAttachment(db, {
                orderId,
                attachmentId,
                qualityScore,
                note,
            });
            if (wantsJson) {
                res.json({ ok: true, ...result });
                return;
            }
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=few_shot#items");
        }
        catch (e) {
            console.error("[admin] few-shot-example", e?.message || e);
            if (wantsJson) {
                res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 400) });
                return;
            }
            res.status(500).send("儲存 Few-Shot 範例失敗");
        }
    });
    /** JSON API：一鍵將訂單附件＋目前明細存為 Few-Shot（未傳 attachment_id 時使用該訂單第一張附件） */
    router.post("/api/orders/:orderId/save-as-example", express_1.default.json(), async (req, res) => {
        const { orderId } = req.params;
        try {
            let attachmentId = String(req.body?.attachment_id ?? "").trim();
            if (!attachmentId) {
                const row = await db.prepare("SELECT id FROM order_attachments WHERE order_id = ? ORDER BY COALESCE(created_at, '') ASC, id ASC LIMIT 1").get(orderId);
                attachmentId = row?.id ? String(row.id) : "";
            }
            if (!attachmentId) {
                res.status(400).json({ ok: false, error: "此訂單無圖片附件，無法存為視覺範例。" });
                return;
            }
            const qs = req.body?.quality_score;
            const qualityScore = qs != null && qs !== "" ? parseFloat(String(qs)) : 100;
            const note = String(req.body?.note ?? "").trim().slice(0, 500);
            const result = await few_shot_example_save_js_1.saveFewShotExampleFromOrderAttachment(db, {
                orderId,
                attachmentId,
                qualityScore: Number.isFinite(qualityScore) && qualityScore > 0 ? qualityScore : 100,
                note,
            });
            res.json({
                ok: true,
                message: "儲存成功",
                ...result,
            });
        }
        catch (e) {
            const msg = e && typeof e.message === "string" ? e.message : String(e ?? "unknown");
            console.error("[Save Example Error]", e);
            res.status(500).json({ ok: false, error: msg.slice(0, 800), message: msg.slice(0, 800) });
        }
    });
    /** 手動將勾選品項轉移至同客戶／同送貨日之目標子客戶訂單（找不到則新建並複製 raw、附件） */
    router.post("/api/orders/:orderId/move-items", express_1.default.json(), async (req, res) => {
        try {
            const { orderId } = req.params;
            const rawIds = req.body?.itemIds;
            const itemIds = Array.isArray(rawIds)
                ? [...new Set(rawIds.map((x) => String(x).trim()).filter(Boolean))]
                : [];
            const targetSubCustomer = req.body?.targetSubCustomer != null ? String(req.body.targetSubCustomer).trim() : "";
            if (!itemIds.length) {
                res.status(400).json({ ok: false, error: "請選擇至少一筆品項" });
                return;
            }
            const sourceOrder = await db.prepare(`
        SELECT o.id, o.customer_id, o.order_date, o.raw_message, o.line_group_id, o.remark, o.order_sub_split_key
        FROM orders o WHERE o.id = ?
      `).get(orderId);
            if (!sourceOrder) {
                res.status(404).json({ ok: false, error: "訂單不存在" });
                return;
            }
            const phCheck = itemIds.map(() => "?").join(",");
            const belong = await db.prepare(`SELECT id FROM order_items WHERE order_id = ? AND id IN (${phCheck})`).all(orderId, ...itemIds);
            if (belong.length !== itemIds.length) {
                res.status(400).json({ ok: false, error: "部分品項不存在或不屬於此訂單" });
                return;
            }
            const subVal = targetSubCustomer === "" ? null : targetSubCustomer;
            const phUp = itemIds.map(() => "?").join(",");
            // [fix 2026-07-08] 建新單(resolveSplitTargetOrder 內)＋搬品項＋補空籃包進單一交易，
            // 中途失敗整批回滾，不留「建了空殼新單卻沒搬到品項」的半套狀態。傳 tx handle 給共用函式。
            const doMove = async (h) => {
                // [fix 2026-07-14] 拆到子客戶時，同日 NULL 主單先標成 '' 桶（比照 line.js），
                // 否則之後整單重辨識 NULL＝全部品項，子客戶品項會重建回主單 → 重複出貨。
                if (targetSubCustomer !== "") {
                    await order_split_js_1.markSameDayMainOrdersAsSplitBase(h, sourceOrder.customer_id, sourceOrder.order_date);
                }
                const targetOrderId = await resolveSplitTargetOrder(h, sourceOrder, targetSubCustomer);
                if (targetOrderId === orderId) {
                    await h.prepare(`UPDATE order_items SET sub_customer = ? WHERE order_id = ? AND id IN (${phUp})`).run(subVal, orderId, ...itemIds);
                }
                else {
                    await h.prepare(`UPDATE order_items SET order_id = ?, sub_customer = ? WHERE order_id = ? AND id IN (${phUp})`).run(targetOrderId, subVal, orderId, ...itemIds);
                    // 拆出去的子單是獨立一趟配送 → 空籃各自重新記錄（冪等：已有就不重複補）
                    await empty_baskets_js_1.insertEmptyBaskets(h, sourceOrder.customer_id, [targetOrderId]);
                }
                return targetOrderId;
            };
            const targetOrderId = (typeof db.transaction === "function") ? await db.transaction(doMove) : await doMove(db);
            res.json({ ok: true, targetOrderId });
        }
        catch (e) {
            console.error("[admin] move-items", e?.message || e, e?.stack);
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 400) });
        }
    });
    // 依子客戶一鍵拆單：把本單內有填「子客戶」的品項，依子客戶各自拆成獨立訂單
    // （找同客戶＋同出貨日既有的 split 單就併入，否則新建；複製附件、補該路線空籃）。
    // 拆完審核清單就會看到每個子客戶各一筆訂單，空籃也各自記錄。
    router.post("/api/orders/:orderId/split-by-sub-customer", express_1.default.json(), async (req, res) => {
        try {
            const { orderId } = req.params;
            const sourceOrder = await db.prepare(`
        SELECT o.id, o.customer_id, o.order_date, o.raw_message, o.line_group_id, o.remark, o.order_sub_split_key
        FROM orders o WHERE o.id = ?
      `).get(orderId);
            if (!sourceOrder) {
                res.status(404).json({ ok: false, error: "訂單不存在" });
                return;
            }
            const rows = await db.prepare(`
        SELECT id, sub_customer FROM order_items
        WHERE order_id = ? AND voided_at IS NULL AND TRIM(COALESCE(sub_customer, '')) <> ''
      `).all(orderId);
            const groups = new Map();
            for (const r of rows) {
                const key = String(r.sub_customer).trim();
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(r.id);
            }
            // 本單自己的 split key（若本單就是某子客戶的單）不用再拆
            const ownKey = String(sourceOrder.order_sub_split_key || "").trim();
            if (ownKey) groups.delete(ownKey);
            if (!groups.size) {
                res.status(400).json({ ok: false, error: "沒有需要拆分的品項：請先在品項的「子客戶」欄填上分店/子客戶名稱。" });
                return;
            }
            const moved = [];
            // [fix 2026-07-08] 整批拆單包進單一交易：中途某子客戶失敗則整批回滾，不留半套拆單。
            // moved 只在交易成功回傳後才送出（失敗會被外層 catch 接住回 500，不會誤報）。
            const doSplit = async (h) => {
                // [fix 2026-07-14] 拆單前先把同日 NULL 主單（含本單）標成 '' 桶（比照 line.js），
                // 否則之後整單重辨識 NULL＝全部品項，子客戶品項會重建回主單 → 重複出貨。
                await order_split_js_1.markSameDayMainOrdersAsSplitBase(h, sourceOrder.customer_id, sourceOrder.order_date);
                for (const [subName, ids] of groups) {
                    const targetOrderId = await resolveSplitTargetOrder(h, sourceOrder, subName);
                    if (targetOrderId === orderId) continue;
                    const ph = ids.map(() => "?").join(",");
                    await h.prepare(`UPDATE order_items SET order_id = ?, sub_customer = ? WHERE order_id = ? AND id IN (${ph})`).run(targetOrderId, subName, orderId, ...ids);
                    // 子單是獨立一趟配送 → 空籃各自重新記錄（冪等）
                    await empty_baskets_js_1.insertEmptyBaskets(h, sourceOrder.customer_id, [targetOrderId]);
                    moved.push({ subCustomer: subName, orderId: targetOrderId, count: ids.length });
                }
            };
            if (typeof db.transaction === "function") await db.transaction(doSplit);
            else await doSplit(db);
            res.json({ ok: true, moved });
        }
        catch (e) {
            console.error("[admin] split-by-sub-customer", e?.message || e, e?.stack);
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 400) });
        }
    });
}
