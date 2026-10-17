"use strict";
/* global document, window, localStorage, fetch */
/**
 * 北農行情走勢看板頁面（2026-10-17 改版）：取代原本「一市場一列」的大表格。
 *   - 一品名一列（台北一/二量加權合併），列上直接看：中價、較前日、30 日走勢小圖、
 *     30 日價位位置條、相對低檔／高檔標籤、交易量。手機自動改成卡片（不吃全站 table→卡片轉換）。
 *   - 點任一列 → 走勢面板：中價線＋上下價區間帶＋7 日均線＋交易量柱，30 日～一年切換，
 *     附採購參考一句話與當日各市場明細（原大表的上/中/下/平均/量都在這裡）。
 *   - ★關注品項存在這台裝置（localStorage），置頂＋「只看關注」。
 * 資料口徑見 dist/lib/wholesale-trend.js。
 *
 * 瀏覽器端程式寫成 marketBoardClient()，以 Function#toString 注入頁面——
 * 好處是 npm run lint 也會檢查到前端程式（打錯變數名當場紅）。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMarketBoardBody = buildMarketBoardBody;

const { escapeHtml, escapeAttr } = require("./_shared.js");

const CSS = `
.mk-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0 12px;}
.mk-toolbar input[type=date]{padding:7px 10px;border:1px solid var(--line-2);border-radius:8px;background:var(--bg-1,#fff);color:var(--txt-1);font:inherit;}
.mk-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;color:var(--txt-3);margin-bottom:12px;}
.mk-meta b{color:var(--txt-1);font-size:15px;}
.mk-sum{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:12px;}
.mk-sum button{all:unset;cursor:pointer;box-sizing:border-box;border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--notion-card,#fff);display:flex;flex-direction:column;gap:2px;}
.mk-sum button.on{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft);}
.mk-sum .n{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.1;}
.mk-sum .l{font-size:12px;color:var(--txt-3);}
.mk-movers{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;}
.mk-movers .notion-card{margin:0;padding:10px 12px;}
.mk-movers h3{margin:0 0 6px;font-size:13px;color:var(--txt-2);font-weight:600;}
.mk-mv{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid var(--notion-border-soft,#f0efed);cursor:pointer;font-size:13.5px;}
.mk-mv:first-of-type{border-top:0;}
.mk-mv span:last-child{font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap;}
.mk-ctl{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;}
.mk-ctl input[type=search]{flex:1 1 200px;max-width:340px;padding:8px 12px;border:1px solid var(--line-2);border-radius:8px;background:var(--bg-1,#fff);color:var(--txt-1);font:inherit;}
.mk-ctl select{padding:7px 10px;border:1px solid var(--line-2);border-radius:8px;background:var(--bg-1,#fff);color:var(--txt-1);font:inherit;}
.mk-list{padding:0;overflow:hidden;}
.mk-row{display:grid;grid-template-columns:28px minmax(120px,1.4fr) 132px 84px 78px minmax(150px,1.3fr) 104px;grid-template-areas:"star name spark price chg pos vol";align-items:center;gap:10px;padding:9px 14px;border-top:1px solid var(--notion-border-soft,#f0efed);cursor:pointer;}
.mk-row:hover{background:var(--bg-2,#f7f8fa);}
.mk-row.mk-head{cursor:default;background:transparent;border-top:0;font-size:12px;color:var(--txt-3);font-weight:600;padding-top:10px;padding-bottom:6px;}
.mk-row.mk-head:hover{background:transparent;}
.mk-star{all:unset;grid-area:star;cursor:pointer;width:24px;height:24px;display:flex;align-items:center;justify-content:center;color:var(--txt-4);border-radius:6px;}
.mk-star.on{color:var(--warn);} .mk-star.on svg{fill:currentColor;}
.mk-star svg{width:16px;height:16px;}
.mk-name{grid-area:name;min-width:0;}
.mk-name .t{font-weight:600;font-size:14.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.mk-name .c{font-size:11.5px;color:var(--txt-3);font-variant-numeric:tabular-nums;display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
.mk-spark{grid-area:spark;height:30px;}
.mk-spark svg{display:block;width:100%;height:30px;}
.mk-price{grid-area:price;text-align:right;font-variant-numeric:tabular-nums;font-weight:700;font-size:16px;}
.mk-price small{display:block;font-size:11px;font-weight:400;color:var(--txt-3);}
.mk-chg{grid-area:chg;text-align:right;font-variant-numeric:tabular-nums;font-size:13px;font-weight:600;white-space:nowrap;}
.mk-pos{grid-area:pos;min-width:0;}
.mk-vol{grid-area:vol;text-align:right;font-variant-numeric:tabular-nums;font-size:12.5px;color:var(--txt-2);}
.mk-vol small{display:block;font-size:11px;color:var(--txt-3);}
.mk-up{color:var(--bad);} .mk-dn{color:var(--ok);} .mk-flat{color:var(--txt-3);}
.mk-bar{position:relative;height:6px;border-radius:99px;background:linear-gradient(90deg,var(--ok-soft),var(--warn-soft),var(--bad-soft));margin:3px 0 4px;}
.mk-bar i{position:absolute;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:var(--txt-1);border:2px solid var(--notion-card,#fff);box-shadow:0 0 0 1px var(--line-3);}
.mk-bar-l{display:flex;justify-content:space-between;font-size:11px;color:var(--txt-3);font-variant-numeric:tabular-nums;}
.mk-tag{display:inline-flex;align-items:center;font-size:11px;font-weight:600;padding:1px 7px;border-radius:99px;white-space:nowrap;}
.mk-tag.low{background:var(--ok-soft);color:var(--ok);}
.mk-tag.high{background:var(--bad-soft);color:var(--bad);}
.mk-tag.tu{background:var(--bad-soft);color:var(--bad);font-weight:500;}
.mk-tag.td{background:var(--ok-soft);color:var(--ok);font-weight:500;}
.mk-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:3px;}
.mk-tag.adv-more{background:var(--ok);color:#fff;}
.mk-tag.adv-less{background:var(--bad);color:#fff;}
.mk-name .o{font-size:11.5px;color:var(--accent);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.mk-adv{font-weight:700;margin-bottom:4px;}
.mk-adv.more{color:var(--ok);} .mk-adv.less{color:var(--bad);}
.mk-ours{margin:4px 0 16px;}
.mk-ours h3{font-size:13px;margin:0 0 6px;color:var(--txt-2);}
.mk-om,.mk-or{display:grid;grid-template-columns:minmax(0,1.4fr) auto minmax(0,1.6fr) auto;gap:8px;align-items:center;padding:7px 0;border-top:1px solid var(--notion-border-soft,#f0efed);font-size:13px;}
.mk-or{grid-template-columns:minmax(0,1fr) 92px auto;}
.mk-om .c,.mk-or .c,.mk-ours .c{font-size:11.5px;color:var(--txt-3);}
.mk-x{all:unset;cursor:pointer;color:var(--txt-3);font-size:12px;padding:3px 6px;border:1px solid var(--line);border-radius:6px;}
.mk-omsg{color:var(--bad);font-size:12.5px;margin-top:4px;}
.mk-ours input[type=search]{width:100%;box-sizing:border-box;margin-top:6px;}
.mk-more{display:block;width:100%;padding:12px;border:0;border-top:1px solid var(--notion-border-soft,#f0efed);background:transparent;color:var(--accent);font:inherit;font-weight:600;cursor:pointer;}
.mk-empty{padding:28px 16px;text-align:center;color:var(--txt-3);}
.mk-foot{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;}
.mk-note{font-size:12px;color:var(--txt-3);line-height:1.6;margin:6px 0 14px;}
/* 走勢面板：桌面右側抽屜、手機底部滑出 */
.mk-mask{position:fixed;inset:0;background:rgba(10,12,16,.35);z-index:900;display:none;}
.mk-drawer{position:fixed;top:0;right:0;bottom:0;width:min(560px,100vw);background:var(--notion-card,#fff);color:var(--txt-1);z-index:901;box-shadow:-8px 0 30px rgba(0,0,0,.18);transform:translateX(105%);transition:transform .22s ease;display:flex;flex-direction:column;}
.mk-open .mk-mask{display:block;} .mk-open .mk-drawer{transform:none;}
.mk-dh{display:flex;align-items:flex-start;gap:10px;padding:14px 16px 10px;border-bottom:1px solid var(--line);}
.mk-dh .t{font-size:19px;font-weight:700;line-height:1.25;}
.mk-dh .c{font-size:12px;color:var(--txt-3);}
.mk-dh .x{all:unset;cursor:pointer;margin-left:auto;font-size:22px;line-height:1;padding:4px 8px;color:var(--txt-3);}
.mk-db{overflow-y:auto;padding:12px 16px 28px;-webkit-overflow-scrolling:touch;}
.mk-big{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:6px;}
.mk-big .p{font-size:30px;font-weight:800;font-variant-numeric:tabular-nums;}
.mk-big .u{font-size:12px;color:var(--txt-3);}
.mk-hint{font-size:13.5px;line-height:1.6;background:var(--bg-2,#f7f8fa);border-radius:8px;padding:9px 11px;margin:8px 0 12px;}
.mk-chart{position:relative;margin:6px 0 4px;touch-action:pan-y;}
.mk-chart svg{display:block;width:100%;}
.mk-tip{position:absolute;top:0;pointer-events:none;background:var(--notion-card,#fff);border:1px solid var(--line-2);border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.14);padding:6px 9px;font-size:12px;line-height:1.5;display:none;white-space:nowrap;font-variant-numeric:tabular-nums;z-index:2;}
.mk-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:11.5px;color:var(--txt-3);margin-bottom:12px;}
.mk-legend i{display:inline-block;width:14px;height:3px;vertical-align:middle;margin-right:4px;border-radius:2px;}
.mk-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:14px;}
.mk-stats > div{border:1px solid var(--line);border-radius:8px;padding:7px 9px;}
.mk-stats .l{font-size:11.5px;color:var(--txt-3);}
.mk-stats .v{font-size:15px;font-weight:700;font-variant-numeric:tabular-nums;}
.mk-stats .s{font-size:11px;font-variant-numeric:tabular-nums;}
.mk-mkts h3{font-size:13px;margin:0 0 6px;color:var(--txt-2);}
.mk-mkt{display:grid;grid-template-columns:60px repeat(4,minmax(0,1fr)) 72px;gap:6px;font-size:12.5px;padding:6px 0;border-top:1px solid var(--notion-border-soft,#f0efed);font-variant-numeric:tabular-nums;text-align:right;}
.mk-mkt > :first-child{text-align:left;}
.mk-mkt.h{color:var(--txt-3);font-size:11.5px;border-top:0;}
@media (max-width:1100px){
  .mk-row{grid-template-columns:28px minmax(110px,1.3fr) 110px 78px 70px minmax(130px,1.2fr);grid-template-areas:"star name spark price chg pos";}
  .mk-vol{display:none;}
}
@media (max-width:760px){
  .mk-sum{grid-template-columns:repeat(2,minmax(0,1fr));}
  .mk-movers{grid-template-columns:1fr;}
  .mk-row.mk-head{display:none;}
  .mk-row{grid-template-columns:26px minmax(0,1fr) auto;grid-template-areas:"star name price" ". spark chg" ". pos vol";gap:4px 10px;padding:11px 12px;}
  .mk-spark{height:34px;} .mk-spark svg{height:34px;}
  .mk-vol{display:block;align-self:end;}
  .mk-chg{align-self:center;}
  .mk-drawer{top:auto;left:0;width:100vw;height:88vh;border-radius:16px 16px 0 0;transform:translateY(105%);}
  .mk-stats{grid-template-columns:repeat(2,minmax(0,1fr));}
  .mk-om{grid-template-columns:minmax(0,1fr) auto;}
  .mk-om > div:nth-child(3){grid-column:1 / -1;}
  .mk-big .p{font-size:26px;}
}
`;

/**
 * @param {object} o
 * @param {string} o.reqDate     使用者選的日期
 * @param {string} o.dateStr     實際顯示的資料日期
 * @param {boolean} o.fellBack
 * @param {string} o.snapSource  "api" | "snapshot" | ""
 * @param {string} o.cat
 * @param {string} o.msg
 * @param {number} o.rawCount    當日該分類原始列數（市場×品名）
 * @param {{dates:string[], items:object[]}} o.board
 * @param {Record<string, object[]>} o.markets  品名 → 當日各市場明細
 * @param {string} o.rulesText
 * @param {{ok?:string, err?:string}} o.query
 * @param {object} o.icons  SF_ICONS
 * @param {Record<string, object[]>} o.maps  北農品名 → 我們的料號（含庫存、每單位公斤）
 * @param {string[]} o.watch  全公司共用關注品名
 * @param {{minDate:string|null}} o.coverage  歷史快照最早日期
 */
function buildMarketBoardBody(o) {
    const { reqDate, dateStr, fellBack, snapSource, cat, msg, board, markets, rulesText, query, icons } = o;
    const maps = o.maps || {}, watch = o.watch || [], coverage = o.coverage || {};
    const mapCount = Object.values(maps).reduce((n, l) => n + l.length, 0);
    const catLabel = cat === "fruit" ? "水果" : cat === "all" ? "全部" : "蔬菜";
    const sourceTag = snapSource === "api" ? `<span class="mk-tag" style="background:var(--ok-soft);color:var(--ok);">即時 API</span>`
        : snapSource === "snapshot" ? `<span class="mk-tag" style="background:var(--warn-soft);color:var(--txt-2);">本地快照</span>` : "";
    const days = board.dates.length;
    const payload = JSON.stringify({
        date: dateStr,
        dates: board.dates,
        items: board.items,
        markets,
        maps,
        watch,
        star: icons.star || "",
    }).replace(/</g, "\\u003c");
    const catSeg = [["veg", "蔬菜"], ["fruit", "水果"], ["all", "全部"]]
        .map(([v, label]) => `<a href="/admin/logistics/market?date=${escapeAttr(dateStr)}&cat=${v}" class="${cat === v ? "on" : ""}">${label}</a>`).join("");
    return `
    <style>${CSS}</style>
    <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 行情報表</div>
    <div class="sf-seg" style="margin:2px 0 14px;">
      <button type="button" class="active" onclick="location.href='/admin/logistics/market'">北農行情</button>
      <button type="button" onclick="location.href='/admin/logistics/livestock'">畜產雞蛋行情</button>
    </div>
    <h1 class="notion-page-title">北農行情走勢</h1>
    <form method="get" action="/admin/logistics/market" class="mk-toolbar">
      <input type="date" name="date" value="${escapeAttr(reqDate)}" aria-label="日期" onchange="this.form.submit()">
      <input type="hidden" name="cat" value="${escapeAttr(cat)}">
      <a href="/admin/logistics/market?date=${escapeAttr(reqDate)}&cat=${escapeAttr(cat)}&refresh=1" class="btn btn-primary" title="即時向農業部 API 抓取（可能需數秒）">更新最新</a>
      <a href="/admin/logistics/market/mapping" class="btn" title="把北農品名對到我們的凌越料號">對照我們的貨品${mapCount ? `（已對 ${mapCount} 項）` : ""}</a>
      <a href="/admin/logistics/market/history" class="btn" title="多品項同圖比較">多品項比較</a>
    </form>
    <div class="mk-meta">
      <b>資料日期 ${escapeHtml(dateStr)}</b>${sourceTag}
      ${fellBack ? `<span>（${escapeHtml(reqDate)} 尚無資料，已顯示最近營業日）</span>` : ""}
      ${board.items.length ? `<span>${catLabel} ${board.items.length} 項・走勢取近 ${days} 個交易日</span>` : ""}
    </div>
    ${board.partial ? `<p class="notion-msg warn" style="padding:8px 12px;border-radius:8px;background:var(--warn-soft);color:var(--txt-1);">這天目前只公布了${escapeHtml(board.markets.join("、"))}的資料（其他市場通常晚一點才出）。為了比較基準一致，下方漲跌、走勢與交易量都只用${escapeHtml(board.markets.join("、"))}計算；晚點按「更新最新」就會補齊。</p>` : ""}
    ${query.ok === "1" ? '<p class="notion-msg ok">已儲存加價規則。</p>' : ""}
    ${query.err === "rules" ? '<p class="notion-msg err">規則格式錯誤：請輸入 JSON 物件，例如 {"*":2,"LM":10}（key 是 ERP 料號前綴、value 是加價）。</p>' : ""}
    ${msg ? `<p class="notion-msg warn" style="padding:8px 12px;border-radius:8px;background:var(--warn-soft);color:var(--txt-1);">${escapeHtml(msg)}</p>` : ""}
    ${board.items.length ? `
    <div class="mk-sum" id="mkSum"></div>
    <div class="mk-movers" id="mkMovers"></div>
    <div class="mk-ctl">
      <div class="sf-seg">${catSeg}</div>
      <input id="mkQ" type="search" placeholder="搜尋品名或品號…" autocomplete="off">
      <select id="mkSort" aria-label="排序">
        <option value="vol">依交易量</option>
        <option value="up">漲幅大→小</option>
        <option value="dn">跌幅大→小</option>
        <option value="low">相對便宜優先</option>
        <option value="high">相對貴優先</option>
        <option value="sup">往年接下來會漲優先</option>
        <option value="sdn">往年接下來會跌優先</option>
        <option value="code">依品號</option>
      </select>
      <label class="sf-switch-label" title="只列已對照到我們料號的品項（＋關注品項）"><input type="checkbox" id="mkOurs0"><span class="sf-switch"></span>只看我們有賣的</label>
      <label class="sf-switch-label"><input type="checkbox" id="mkWatchOnly"><span class="sf-switch"></span>只看關注</label>
    </div>
    <div class="notion-card mk-list" id="mkList"></div>
    <p class="mk-note">價格＝台北一／台北二「中價」以交易量加權合併，單位元／公斤；對照了我們的料號並填每單位公斤的，會另外換算成元/箱（元/把…）。
      「30日位置」：最左＝近 30 個交易日最便宜、最右＝最貴。「相對低檔」＝位置在最低 20% 且比 30 日均價低 10% 以上；「相對高檔」反之。
      「走升／走跌」＝7 日均比 30 日均高／低 8% 以上。「往年4週」＝過去兩年同一天之後 4 週的平均漲跌。
      <b>建議多備／少進</b>＝價位與往年季節兩個訊號加起來同方向才給（便宜＋往年會漲＝多備；貴＋往年會跌＝少進），只是參考，現場判斷優先。
      ☆ 關注品項全公司共用。紅＝漲（進貨變貴）、綠＝跌。
      歷史資料${coverage.minDate ? `目前從 ${escapeHtml(coverage.minDate)} 起` : "還沒有"}，系統每天自動往回補，目標兩年。</p>
    <div class="mk-foot">
      <a href="/admin/logistics/market/export.csv?date=${escapeAttr(dateStr)}&cat=${escapeAttr(cat)}" class="btn">下載 CSV</a>
      <a href="/admin/logistics/market/export.xlsx?date=${escapeAttr(dateStr)}&cat=${escapeAttr(cat)}" class="btn">下載 Excel</a>
    </div>
    <div class="mk-mask" id="mkMask"></div>
    <aside class="mk-drawer" id="mkDrawer" aria-hidden="true"><div class="mk-dh" id="mkDh"></div><div class="mk-db" id="mkDb"></div></aside>
    <script>(${marketBoardClient.toString()})(${payload});</script>
    ` : ""}
    <details class="notion-card" style="margin-top:16px;">
      <summary style="cursor:pointer;font-weight:600;">LINE 報價加價規則</summary>
      <p class="notion-hint">格式為 JSON，key 為 ERP 料號前綴、value 為加價。<code>*</code> 代表預設。例：<code>{"*":2,"LM":10}</code>。</p>
      <form method="post" action="/admin/logistics/market/rules">
        <textarea name="rules_json" rows="8" class="sf-textarea" style="width:100%;box-sizing:border-box;">${escapeHtml(rulesText)}</textarea>
        <p style="margin-top:8px;"><button type="submit" class="btn btn-primary">儲存規則</button></p>
      </form>
    </details>
    `;
}

/** 瀏覽器端：不可引用任何 module 層變數（會以原始碼注入頁面）。 */
function marketBoardClient(D) {
    var items = D.items || [];
    var maps = D.maps || {};
    var byName = {};
    items.forEach(function (it) { byName[it.name] = it; });
    var watch = {};
    (D.watch || []).forEach(function (n) { watch[n] = 1; });
    var OKEY = "mkt_ours_v1";
    var hasMaps = Object.keys(maps).length > 0;
    var oursPref = null;
    try { oursPref = localStorage.getItem(OKEY); } catch (_) { /* 私密模式讀不到就用預設 */ }
    var state = { q: "", sort: "vol", watchOnly: false, ours: hasMaps && oursPref !== "0", flt: "all", limit: 80 };
    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
    function f1(v) { return v == null ? "—" : Number(v).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
    function fInt(v) { return v == null ? "—" : Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 }); }
    function fQty(v) { return v == null ? "—" : Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 }); }
    function cls(p) { return p == null ? "mk-flat" : (p > 0.05 ? "mk-up" : (p < -0.05 ? "mk-dn" : "mk-flat")); }
    function chg(p) { if (p == null) return '<span class="mk-flat">—</span>'; return '<span class="' + cls(p) + '">' + (p > 0.05 ? "▲" : (p < -0.05 ? "▼" : "")) + (p > 0 ? "+" : "") + p.toFixed(1) + "%</span>"; }
    function post(url, body) {
        return fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
            .then(function (r) { return r.json().catch(function () { return { ok: false, error: "伺服器回應異常（" + r.status + "），請重新整理再試。" }; }); });
    }

    // 「今天該多進還是少進」：價位（近 30 日相對位置）＋季節（往年接下來 4 週）兩票，同向才給建議；走勢只當說明
    function advice(it) {
        var sp = it.seasonPct, seasonUp = it.seasonYears > 0 && sp != null && sp >= 8, seasonDn = it.seasonYears > 0 && sp != null && sp <= -8;
        var score = (it.signal === "low" ? 1 : it.signal === "high" ? -1 : 0) + (seasonUp ? 1 : seasonDn ? -1 : 0);
        var why = [];
        if (it.signal === "low") why.push("現在比近 30 日便宜");
        if (it.signal === "high") why.push("現在比近 30 日貴");
        if (seasonUp) why.push("往年接下來 4 週平均漲 " + sp.toFixed(0) + "%");
        if (seasonDn) why.push("往年接下來 4 週平均跌 " + Math.abs(sp).toFixed(0) + "%");
        return { k: score >= 1 ? "more" : (score <= -1 ? "less" : null), why: why };
    }
    function tags(it, withAdvice) {
        var h = "", a = advice(it);
        if (withAdvice && a.k === "more") h += '<span class="mk-tag adv-more">建議多備</span>';
        if (withAdvice && a.k === "less") h += '<span class="mk-tag adv-less">建議少進</span>';
        if (it.signal === "low") h += '<span class="mk-tag low">相對低檔</span>';
        else if (it.signal === "high") h += '<span class="mk-tag high">相對高檔</span>';
        if (it.trend === "up") h += '<span class="mk-tag tu">走升</span>';
        else if (it.trend === "down") h += '<span class="mk-tag td">走跌</span>';
        if (it.seasonYears > 0 && it.seasonPct != null && Math.abs(it.seasonPct) >= 5) h += '<span class="mk-tag ' + (it.seasonPct > 0 ? "tu" : "td") + '" title="過去 ' + it.seasonYears + ' 年同期，接下來 4 週的平均漲跌">往年4週' + (it.seasonPct > 0 ? "▲" : "▼") + Math.abs(it.seasonPct).toFixed(0) + "%</span>";
        return h;
    }
    function spark(vals) {
        var pts = (vals || []).filter(function (v) { return v != null; });
        if (pts.length < 2) return '<svg viewBox="0 0 100 30" preserveAspectRatio="none"></svg>';
        var mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts);
        if (mx === mn) { mx += 1; mn -= 1; }
        var n = pts.length, d = "";
        for (var i = 0; i < n; i++) { d += (i ? "L" : "M") + (i / (n - 1) * 100).toFixed(2) + "," + (27 - (pts[i] - mn) / (mx - mn) * 24).toFixed(2); }
        var last = pts[n - 1], first = pts[0];
        var col = last > first * 1.02 ? "var(--bad)" : (last < first * 0.98 ? "var(--ok)" : "var(--txt-3)");
        return '<svg viewBox="0 0 100 30" preserveAspectRatio="none"><path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>';
    }
    function posBar(it) {
        var t = tags(it, true);
        if (it.pos30 == null) return '<div class="mk-bar-l"><span>近30日價格持平</span></div>' + (t ? '<div class="mk-tags">' + t + "</div>" : "");
        return '<div class="mk-bar" title="近 ' + it.days + ' 個交易日：最低 ' + f1(it.min30) + '、最高 ' + f1(it.max30) + '"><i style="left:' + Math.max(3, Math.min(97, it.pos30)) + '%"></i></div>'
            + '<div class="mk-bar-l"><span>低 ' + f1(it.min30) + "</span><span>高 " + f1(it.max30) + "</span></div>"
            + (t ? '<div class="mk-tags">' + t + "</div>" : "");
    }
    function oursLine(it) {
        var m = maps[it.name];
        if (!m || !m.length) return "";
        var a = m[0];
        return '<div class="o">我們：' + esc(a.name) + " ・ 庫存 " + fQty(a.qty) + esc(a.unit) + (m.length > 1 ? " 等 " + m.length + " 項" : "") + "</div>";
    }
    function unitPrice(it) {
        var m = (maps[it.name] || []).filter(function (x) { return x.kg; })[0];
        return m ? "≈" + fInt(it.mid * m.kg) + "/" + esc(m.unit || "單位") : "元/kg";
    }
    function rowHtml(it) {
        var on = watch[it.name] ? " on" : "";
        return '<div class="mk-row" data-n="' + esc(it.name) + '">'
            + '<button type="button" class="mk-star' + on + '" data-star="' + esc(it.name) + '" aria-label="關注">' + D.star + "</button>"
            + '<div class="mk-name"><div class="t">' + esc(it.name) + '</div><div class="c">' + esc(it.code || "") + "</div>" + oursLine(it) + "</div>"
            + '<div class="mk-spark">' + spark(it.spark) + "</div>"
            + '<div class="mk-price">' + f1(it.mid) + "<small>" + unitPrice(it) + "</small></div>"
            + '<div class="mk-chg">' + chg(it.dayPct) + "</div>"
            + '<div class="mk-pos">' + posBar(it) + "</div>"
            + '<div class="mk-vol">' + fInt(it.volume) + " kg" + (it.volPct != null ? '<small>量 ' + (it.volPct > 0 ? "+" : "") + it.volPct.toFixed(0) + "% vs 7日</small>" : "") + "</div>"
            + "</div>";
    }
    var HEAD = '<div class="mk-row mk-head"><span></span><span>品名</span><span>近30日走勢</span><span style="text-align:right">中價</span><span style="text-align:right">較前日</span><span>30日價位位置・建議</span><span style="text-align:right" class="mk-vol">交易量</span></div>';
    function filtered() {
        var q = state.q.toLowerCase();
        var out = items.filter(function (it) {
            if (state.watchOnly && !watch[it.name]) return false;
            if (state.ours && !maps[it.name] && !watch[it.name]) return false;
            if (q) {
                var hay = it.name + " " + (it.code || "") + " " + (maps[it.name] || []).map(function (m) { return m.name + " " + m.code; }).join(" ");
                if (hay.toLowerCase().indexOf(q) < 0) return false;
            }
            if (state.flt === "more") return advice(it).k === "more";
            if (state.flt === "less") return advice(it).k === "less";
            if (state.flt === "low") return it.signal === "low";
            if (state.flt === "high") return it.signal === "high";
            return true;
        });
        var num = function (v, d) { return v == null ? d : v; };
        var cmp = {
            vol: function (a, b) { return num(b.volume, 0) - num(a.volume, 0); },
            up: function (a, b) { return num(b.dayPct, -1e9) - num(a.dayPct, -1e9); },
            dn: function (a, b) { return num(a.dayPct, 1e9) - num(b.dayPct, 1e9); },
            low: function (a, b) { return num(a.vsAvg30, 1e9) - num(b.vsAvg30, 1e9); },
            high: function (a, b) { return num(b.vsAvg30, -1e9) - num(a.vsAvg30, -1e9); },
            sup: function (a, b) { return num(b.seasonPct, -1e9) - num(a.seasonPct, -1e9); },
            sdn: function (a, b) { return num(a.seasonPct, 1e9) - num(b.seasonPct, 1e9); },
            code: function (a, b) { return (a.code || "~").localeCompare(b.code || "~"); },
        }[state.sort];
        out.sort(function (a, b) { var w = (watch[b.name] ? 1 : 0) - (watch[a.name] ? 1 : 0); return w || cmp(a, b); });
        return out;
    }
    function renderList() {
        var list = filtered();
        var shown = list.slice(0, state.limit);
        var empty = state.watchOnly ? "還沒有關注品項：點品名左邊的 ☆ 加入（全公司共用）"
            : (state.ours ? "篩選後沒有品項。「只看我們有賣的」只列已對照的北農品名，可關掉它看全部，或到「對照我們的貨品」補對照。" : "沒有符合的品項，換個關鍵字或篩選試試");
        var h = HEAD + (shown.length ? shown.map(rowHtml).join("") : '<div class="mk-empty">' + empty + "</div>");
        if (list.length > shown.length) h += '<button type="button" class="mk-more" id="mkMore">顯示更多（還有 ' + (list.length - shown.length) + " 項）</button>";
        $("mkList").innerHTML = h;
        var more = $("mkMore");
        if (more) more.onclick = function () { state.limit += 150; renderList(); };
    }
    function renderSummary() {
        var pool = items.filter(function (it) { return !state.ours || maps[it.name] || watch[it.name]; });
        var c = { more: 0, less: 0, low: 0, high: 0 };
        pool.forEach(function (it) {
            var a = advice(it).k;
            if (a) c[a]++;
            if (it.signal === "low") c.low++;
            if (it.signal === "high") c.high++;
        });
        var defs = [["more", "建議多備", "mk-dn"], ["less", "建議少進", "mk-up"], ["low", "相對低檔（便宜）", "mk-dn"], ["high", "相對高檔（貴）", "mk-up"]];
        $("mkSum").innerHTML = defs.map(function (d) {
            return '<button type="button" data-flt="' + d[0] + '" class="' + (state.flt === d[0] ? "on" : "") + '"><span class="n ' + d[2] + '">' + c[d[0]] + '</span><span class="l">' + d[1] + "</span></button>";
        }).join("");
        // 漲跌榜只看有一定交易量的品項（小量品項一天翻倍是常態，沒參考價值）
        var big = pool.filter(function (it) { return it.dayPct != null && (it.volume || 0) >= 1000; });
        var ups = big.slice().sort(function (a, b) { return b.dayPct - a.dayPct; }).filter(function (it) { return it.dayPct > 0.05; }).slice(0, 5);
        var dns = big.slice().sort(function (a, b) { return a.dayPct - b.dayPct; }).filter(function (it) { return it.dayPct < -0.05; }).slice(0, 5);
        var mv = function (list) { return list.length ? list.map(function (it) { return '<div class="mk-mv" data-n="' + esc(it.name) + '"><span>' + esc(it.name) + " <small style=\"color:var(--txt-3)\">" + f1(it.mid) + "</small></span>" + chg(it.dayPct) + "</div>"; }).join("") : '<div class="mk-flat" style="font-size:13px">無</div>'; };
        $("mkMovers").innerHTML = '<div class="notion-card"><h3>今天漲最多（量 ≥1 噸）</h3>' + mv(ups) + '</div><div class="notion-card"><h3>今天跌最多（量 ≥1 噸）</h3>' + mv(dns) + "</div>";
    }

    // ── 走勢面板 ──
    var cur = null, hist = null, range = 90;
    function closeDrawer() { document.body.classList.remove("mk-open"); $("mkDrawer").setAttribute("aria-hidden", "true"); cur = null; }
    function hintHtml(it) {
        var a = advice(it), s = "";
        if (a.k === "more") s += '<div class="mk-adv more">建議多備：' + esc(a.why.join("、")) + "</div>";
        else if (a.k === "less") s += '<div class="mk-adv less">建議少進、能等就等：' + esc(a.why.join("、")) + "</div>";
        else s += '<div class="mk-adv">照平常量進' + (a.why.length ? "：" + esc(a.why.join("、")) + "，兩個訊號沒有同方向" : "") + "</div>";
        if (it.days < 10 || it.vsAvg30 == null) return s + "<div>近 30 日資料不足 10 個交易日，價位判斷先不做。</div>";
        var t = "今日 " + f1(it.mid) + " 元，比 30 日均價 " + f1(it.avg30) + (it.vsAvg30 >= 0 ? " 高 " : " 低 ") + Math.abs(it.vsAvg30).toFixed(0) + "%，在近 30 日區間的 " + (it.pos30 == null ? "—" : it.pos30 + "%") + " 位置。";
        if (it.trend === "up") t += "近一週均價比 30 日均高 " + it.trendPct.toFixed(0) + "%，正在走升。";
        else if (it.trend === "down") t += "近一週均價比 30 日均低 " + Math.abs(it.trendPct).toFixed(0) + "%，正在走跌。";
        else t += "近一週價格大致平穩。";
        if (it.lastYear != null) { var ly = (it.mid - it.lastYear) / it.lastYear * 100; t += "去年同期約 " + f1(it.lastYear) + " 元，今年" + (ly >= 0 ? "貴 " : "便宜 ") + Math.abs(ly).toFixed(0) + "%。"; }
        if (it.seasonYears > 0 && it.seasonPct != null) t += "過去 " + it.seasonYears + " 年這個時候，接下來 4 週平均" + (it.seasonPct >= 0 ? "漲 " : "跌 ") + Math.abs(it.seasonPct).toFixed(0) + "%。";
        else t += "還沒有往年同期資料（系統每天自動往回補，補滿兩年就會出現季節判斷）。";
        return s + "<div>" + esc(t) + "</div>";
    }
    function openDrawer(name) {
        var it = byName[name];
        if (!it) return;
        cur = it; hist = null;
        document.body.classList.add("mk-open");
        $("mkDrawer").setAttribute("aria-hidden", "false");
        $("mkDh").innerHTML = '<button type="button" class="mk-star' + (watch[name] ? " on" : "") + '" data-star="' + esc(name) + '" aria-label="關注">' + D.star + '</button><div><div class="t">' + esc(it.name) + '</div><div class="c">' + esc(it.code || "") + " ・ 資料日期 " + esc(D.date) + '</div></div><button type="button" class="x" id="mkX" aria-label="關閉">×</button>';
        $("mkX").onclick = closeDrawer;
        var mk = (D.markets[name] || []);
        var mkHtml = mk.length ? '<div class="mk-mkts"><h3>當日各市場（元/kg）</h3><div class="mk-mkt h"><span>市場</span><span>上價</span><span>中價</span><span>下價</span><span>平均</span><span>量 kg</span></div>'
            + mk.map(function (m) { return '<div class="mk-mkt"><span>' + esc(m.m) + "</span><span>" + f1(m.hi) + '</span><span style="font-weight:700">' + f1(m.mid) + "</span><span>" + f1(m.lo) + "</span><span>" + f1(m.avg) + "</span><span>" + fInt(m.vol) + "</span></div>"; }).join("") + "</div>" : "";
        $("mkDb").innerHTML = '<div class="mk-big"><span class="p">' + f1(it.mid) + '</span><span class="u">元/kg 中價</span>' + chg(it.dayPct) + '<span class="u">較前日' + (it.prevMid != null ? "（" + f1(it.prevMid) + "）" : "") + "</span></div>"
            + '<div class="mk-tags">' + tags(it, false) + "</div>"
            + '<div class="mk-hint">' + hintHtml(it) + "</div>"
            + '<div class="sf-seg" id="mkRange">' + [[30, "30日"], [90, "90日"], [180, "半年"], [365, "一年"], [730, "兩年"], ["season", "季節對照"]].map(function (r) { return '<button type="button" data-r="' + r[0] + '" class="' + (String(range) === String(r[0]) ? "active" : "") + '">' + r[1] + "</button>"; }).join("") + "</div>"
            + '<div class="mk-chart" id="mkChart"><div class="mk-empty">載入走勢中…</div></div>'
            + '<div class="mk-legend" id="mkLegend"></div>'
            + '<div class="mk-stats" id="mkStats"></div>'
            + '<div class="mk-ours" id="mkOurs"></div>'
            + mkHtml;
        renderOurs();
        var end = D.date;
        var start = new Date(new Date(end + "T00:00:00Z").getTime() - 800 * 86400000).toISOString().slice(0, 10);
        fetch("/admin/logistics/market/history.json?crops=" + encodeURIComponent(name) + "&start=" + start + "&end=" + end, { credentials: "same-origin" })
            .then(function (r) { return r.json(); })
            .then(function (j) {
                if (cur !== it) return;
                if (!j.ok) throw new Error(j.error || "讀取失敗");
                hist = ((j.series || {})[name] || []).filter(function (p) { return p.mid != null; });
                drawChart(); drawStats();
            })
            .catch(function (e) { if (cur === it) $("mkChart").innerHTML = '<div class="mk-empty">走勢載入失敗：' + esc(e.message || e) + "。請重新整理頁面再點一次；一直失敗請回報。</div>"; });
    }
    function dayMs(iso) { return new Date(iso + "T00:00:00Z").getTime(); }
    function yearsAgo(iso, y) { var d = new Date(iso + "T00:00:00Z"); d.setUTCFullYear(d.getUTCFullYear() - y); return d.toISOString().slice(0, 10); }
    /** 離目標日 ±7 天內最近的一筆 */
    function near(h, iso) { var t = dayMs(iso), best = null, bd = 8 * 86400000; h.forEach(function (p) { var d = Math.abs(dayMs(p.date) - t); if (d < bd) { bd = d; best = p; } }); return best; }
    function drawStats() {
        var it = cur, h = hist || [];
        var avgN = function (n) { var a = h.slice(-n).map(function (p) { return p.mid; }); return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : null; };
        var ly = near(h, yearsAgo(D.date, 1)), ly2 = near(h, yearsAgo(D.date, 2));
        var vs = function (v) { if (v == null || !(v > 0)) return ""; var p = (it.mid - v) / v * 100; return '<div class="s ' + cls(p) + '">今日' + (p >= 0 ? "高 " : "低 ") + Math.abs(p).toFixed(0) + "%</div>"; };
        var cells = [
            ["7日均", it.ma7, true], ["30日均", it.avg30, true], ["90日均", h.length >= 30 ? avgN(90) : null, true], ["30日最低", it.min30, false],
            ["30日最高", it.max30, false], ["去年同期" + (ly ? "（" + ly.date.slice(5) + "）" : ""), ly ? ly.mid : null, true],
            ["前年同期" + (ly2 ? "（" + ly2.date.slice(5) + "）" : ""), ly2 ? ly2.mid : null, true],
        ];
        var html = cells.map(function (c) { return '<div><div class="l">' + esc(c[0]) + '</div><div class="v">' + f1(c[1]) + "</div>" + (c[2] ? vs(c[1]) : "") + "</div>"; }).join("");
        html += '<div><div class="l">往年接下來 4 週</div><div class="v ' + cls(it.seasonPct) + '">' + (it.seasonYears > 0 && it.seasonPct != null ? (it.seasonPct > 0 ? "▲+" : "▼") + it.seasonPct.toFixed(0) + "%" : "—") + '</div><div class="s mk-flat">' + (it.seasonYears > 0 ? it.seasonYears + " 年平均" : "資料補齊中") + "</div></div>";
        $("mkStats").innerHTML = html;
    }
    function legend(list) { $("mkLegend").innerHTML = list.map(function (l) { return '<span><i style="background:' + l[0] + (l[2] ? ";height:8px" : "") + '"></i>' + l[1] + "</span>"; }).join(""); }
    function bindTip(svg, W, nearest) {
        var tip = $("mkTip"), g = $("mkG");
        function at(clientX) {
            var r = svg.getBoundingClientRect(), sx = (clientX - r.left) / r.width * W, o = nearest(sx);
            if (!o) return;
            g.setAttribute("x1", o.x); g.setAttribute("x2", o.x); g.style.display = "";
            tip.innerHTML = o.html; tip.style.display = "block";
            var px = o.x / W * r.width;
            tip.style.left = (px > r.width / 2 ? px - tip.offsetWidth - 10 : px + 10) + "px";
        }
        svg.addEventListener("pointermove", function (e) { at(e.clientX); });
        svg.addEventListener("pointerdown", function (e) { at(e.clientX); });
        svg.addEventListener("pointerleave", function () { g.style.display = "none"; tip.style.display = "none"; });
    }
    function drawChart() { if (range === "season") drawSeason(); else drawRange(); }
    function drawRange() {
        var box = $("mkChart"), h = hist || [];
        legend([["var(--accent)", "中價"], ["var(--warn)", "7日均"], ["var(--accent-soft)", "上價～下價", 1], ["var(--line-2)", "交易量", 1]]);
        var cutoff = new Date(dayMs(D.date) - range * 86400000).toISOString().slice(0, 10);
        var pts = h.filter(function (p) { return p.date > cutoff; });
        if (pts.length < 2) { box.innerHTML = '<div class="mk-empty">這段期間資料不足 2 天。系統每天會自動往回補歷史（目標兩年），也可以到「多品項比較」頁按「回補歷史」先補。</div>'; return; }
        var ma = pts.map(function (p) {
            var idx = h.indexOf(p), win = h.slice(Math.max(0, idx - 6), idx + 1).map(function (x) { return x.mid; });
            return win.reduce(function (s, v) { return s + v; }, 0) / win.length;
        });
        var W = Math.max(300, box.clientWidth || 520), H = 240, pl = 40, pr = 8, pt = 10, pb = 22, vh = 40;
        var priceB = H - pb - vh - 6;
        var vals = [];
        pts.forEach(function (p, i) { vals.push(p.mid, ma[i]); if (p.high != null) vals.push(p.high); if (p.low != null) vals.push(p.low); });
        var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
        var padv = (mx - mn) * 0.08 || 1; mn -= padv; mx += padv;
        var vmax = Math.max.apply(null, pts.map(function (p) { return p.volume || 0; })) || 1;
        var n = pts.length;
        var X = function (i) { return pl + (W - pl - pr) * (n === 1 ? 0.5 : i / (n - 1)); };
        var Y = function (v) { return pt + (priceB - pt) * (1 - (v - mn) / (mx - mn)); };
        var s = '<svg viewBox="0 0 ' + W + " " + H + '" height="' + H + '">';
        for (var k = 0; k <= 3; k++) { var gv = mn + (mx - mn) * k / 3, gy = Y(gv); s += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '" stroke="var(--line)"/><text x="' + (pl - 5) + '" y="' + (gy + 3).toFixed(1) + '" font-size="10" fill="var(--txt-3)" text-anchor="end">' + gv.toFixed(0) + "</text>"; }
        var bw = Math.max(1, (W - pl - pr) / n * 0.7);
        pts.forEach(function (p, i) { if (!p.volume) return; var bh = p.volume / vmax * vh; s += '<rect x="' + (X(i) - bw / 2).toFixed(1) + '" y="' + (H - pb - bh).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" fill="var(--line-2)"/>'; });
        var top = "", bot = "";
        pts.forEach(function (p, i) { var hi = p.high != null ? p.high : p.mid, lo = p.low != null ? p.low : p.mid; top += (i ? "L" : "M") + X(i).toFixed(1) + "," + Y(hi).toFixed(1); bot = "L" + X(i).toFixed(1) + "," + Y(lo).toFixed(1) + bot; });
        s += '<path d="' + top + bot + 'Z" fill="var(--accent-soft)" stroke="none"/>';
        var line = function (arr, col, w, dash) { var d = ""; arr.forEach(function (v, i) { d += (i ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1); }); return '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + w + '"' + (dash ? ' stroke-dasharray="4,3"' : "") + ' stroke-linejoin="round"/>'; };
        s += line(ma, "var(--warn)", 1.5, true);
        s += line(pts.map(function (p) { return p.mid; }), "var(--accent)", 2.2, false);
        var step = Math.max(1, Math.ceil(n / 6));
        var lbl = function (iso) { return range > 365 ? iso.slice(2, 7).replace("-", "/") : iso.slice(5).replace("-", "/"); };
        for (var i = 0; i < n; i += step) s += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 6) + '" font-size="10" fill="var(--txt-3)" text-anchor="middle">' + lbl(pts[i].date) + "</text>";
        s += '<line id="mkG" y1="' + pt + '" y2="' + (H - pb) + '" stroke="var(--line-3)" stroke-dasharray="3,3" style="display:none"/></svg><div class="mk-tip" id="mkTip"></div>';
        box.innerHTML = s;
        bindTip(box.querySelector("svg"), W, function (sx) {
            var i = Math.max(0, Math.min(n - 1, Math.round((sx - pl) / ((W - pl - pr) / Math.max(1, n - 1))))), p = pts[i];
            return { x: X(i), html: "<b>" + p.date + "</b><br>中價 " + f1(p.mid) + "<br>上 " + f1(p.high) + " ／ 下 " + f1(p.low) + "<br>7日均 " + f1(ma[i]) + "<br>量 " + fInt(p.volume) + " kg" };
        });
    }
    // 季節對照：今年／去年／前年，以「今天」為 0，前後各 60 天疊在同一張圖（各年先做 7 點移動平均去雜訊）
    function drawSeason() {
        var box = $("mkChart"), h = hist || [], SPAN = 60;
        var cols = ["var(--accent)", "var(--warn)", "var(--txt-3)"], names = ["今年", "去年", "前年"];
        var series = [];
        for (var y = 0; y <= 2; y++) {
            var base = dayMs(yearsAgo(D.date, y)), raw = [];
            h.forEach(function (p) { var off = Math.round((dayMs(p.date) - base) / 86400000); if (off >= -SPAN - 6 && off <= (y === 0 ? 0 : SPAN)) raw.push({ off: off, v: p.mid, date: p.date }); });
            var sm = raw.map(function (p, i) { var w = raw.slice(Math.max(0, i - 6), i + 1); return { off: p.off, date: p.date, v: w.reduce(function (s, x) { return s + x.v; }, 0) / w.length }; }).filter(function (p) { return p.off >= -SPAN; });
            if (sm.length >= 2) series.push({ y: y, pts: sm });
        }
        legend(series.map(function (sr) { return [cols[sr.y], names[sr.y]]; }));
        if (series.length < 2) { box.innerHTML = '<div class="mk-empty">還沒有往年同期的資料可以疊圖。系統每天會自動往回補歷史（目標兩年），補到去年這個時候就看得到。</div>'; return; }
        var vals = []; series.forEach(function (sr) { sr.pts.forEach(function (p) { vals.push(p.v); }); });
        var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), padv = (mx - mn) * 0.08 || 1; mn -= padv; mx += padv;
        var W = Math.max(300, box.clientWidth || 520), H = 220, pl = 40, pr = 8, pt = 10, pb = 22;
        var X = function (off) { return pl + (W - pl - pr) * (off + SPAN) / (2 * SPAN); };
        var Y = function (v) { return pt + (H - pb - pt) * (1 - (v - mn) / (mx - mn)); };
        var s = '<svg viewBox="0 0 ' + W + " " + H + '" height="' + H + '">';
        for (var k = 0; k <= 3; k++) { var gv = mn + (mx - mn) * k / 3, gy = Y(gv); s += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '" stroke="var(--line)"/><text x="' + (pl - 5) + '" y="' + (gy + 3).toFixed(1) + '" font-size="10" fill="var(--txt-3)" text-anchor="end">' + gv.toFixed(0) + "</text>"; }
        s += '<line x1="' + X(0) + '" x2="' + X(0) + '" y1="' + pt + '" y2="' + (H - pb) + '" stroke="var(--line-3)"/><text x="' + (X(0) + 4) + '" y="' + (pt + 10) + '" font-size="10" fill="var(--txt-3)">今天</text>';
        [-60, -30, 30, 60].forEach(function (o) { s += '<text x="' + X(o).toFixed(1) + '" y="' + (H - 6) + '" font-size="10" fill="var(--txt-3)" text-anchor="middle">' + new Date(dayMs(D.date) + o * 86400000).toISOString().slice(5, 10).replace("-", "/") + "</text>"; });
        series.slice().reverse().forEach(function (sr) {
            var d = ""; sr.pts.forEach(function (p, i) { d += (i ? "L" : "M") + X(p.off).toFixed(1) + "," + Y(p.v).toFixed(1); });
            s += '<path d="' + d + '" fill="none" stroke="' + cols[sr.y] + '" stroke-width="' + (sr.y === 0 ? 2.4 : 1.6) + '"' + (sr.y === 2 ? ' stroke-dasharray="4,3"' : "") + ' stroke-linejoin="round"/>';
        });
        s += '<line id="mkG" y1="' + pt + '" y2="' + (H - pb) + '" stroke="var(--line-3)" stroke-dasharray="3,3" style="display:none"/></svg><div class="mk-tip" id="mkTip"></div>';
        box.innerHTML = s;
        bindTip(box.querySelector("svg"), W, function (sx) {
            var off = Math.round((sx - pl) / (W - pl - pr) * 2 * SPAN - SPAN);
            off = Math.max(-SPAN, Math.min(SPAN, off));
            var html = "<b>" + new Date(dayMs(D.date) + off * 86400000).toISOString().slice(5, 10).replace("-", "/") + "（" + (off === 0 ? "今天" : (off > 0 ? "+" : "") + off + " 天") + "）</b>";
            series.forEach(function (sr) {
                var b = null, bd = 4; sr.pts.forEach(function (p) { var d = Math.abs(p.off - off); if (d < bd) { bd = d; b = p; } });
                html += '<br><span style="color:' + cols[sr.y] + '">' + names[sr.y] + "</span> " + (b ? f1(b.v) : "—");
            });
            return { x: X(off), html: html };
        });
    }

    // ── 對照我們的貨品（面板內）──
    function renderOurs() {
        var it = cur, box = $("mkOurs");
        if (!it || !box) return;
        var list = maps[it.name] || [];
        var rows = list.map(function (m) {
            return '<div class="mk-om"><div><b>' + esc(m.name) + '</b><div class="c">' + esc(m.code) + " ・ " + esc(m.spec) + " " + esc(m.unit) + "</div></div>"
                + "<div>庫存 <b>" + fQty(m.qty) + "</b> " + esc(m.unit) + "</div>"
                + "<div>" + (m.kg ? "每" + esc(m.unit || "單位") + " " + fQty(m.kg) + " kg ・ 北農折合 <b>" + fInt(it.mid * m.kg) + "</b> 元/" + esc(m.unit || "單位") : '<span class="mk-flat">沒填每單位公斤，不換算</span>') + "</div>"
                + '<button type="button" class="mk-x" data-unmap="' + esc(m.code) + '" title="取消對照">取消</button></div>';
        }).join("");
        box.innerHTML = "<h3>我們的貨品</h3>" + (rows || '<div class="mk-flat" style="font-size:13px;margin-bottom:6px">還沒對照。對照後這個品項會出現在「只看我們有賣的」、並顯示庫存與每箱折合價。</div>')
            + '<input id="mkOq" type="search" class="sf-input" placeholder="搜尋我們的品名或料號，點選加入對照…" autocomplete="off"><div id="mkOr"></div><div id="mkOmsg" class="mk-omsg"></div>';
        var qt2 = null;
        $("mkOq").addEventListener("input", function () { var v = this.value.trim(); clearTimeout(qt2); qt2 = setTimeout(function () { search(v); }, 200); });
        if (!list.length) search("");
    }
    function search(q) {
        var it = cur;
        if (!it) return;
        fetch("/admin/logistics/market/erp-search?" + (q ? "q=" + encodeURIComponent(q) : "crop=" + encodeURIComponent(it.name)), { credentials: "same-origin" })
            .then(function (r) { return r.json(); })
            .then(function (j) {
                if (cur !== it) return;
                if (!j.ok) { $("mkOmsg").textContent = j.error || "搜尋失敗"; return; }
                var mine = {}; (maps[it.name] || []).forEach(function (m) { mine[m.code] = 1; });
                var res = (j.items || []).filter(function (x) { return !mine[x.code]; });
                $("mkOr").innerHTML = res.length ? (q ? "" : '<div class="c" style="margin:6px 0 2px">建議：</div>') + res.slice(0, 12).map(function (x) {
                    return '<div class="mk-or"><div><b>' + esc(x.name) + '</b><div class="c">' + esc(x.code) + " ・ " + esc(x.spec) + " " + esc(x.unit) + (x.mappedTo ? " ・ 目前對到「" + esc(x.mappedTo) + "」" : "") + "</div></div>"
                        + '<input class="sf-input" data-kg="' + esc(x.code) + '" value="' + (x.kg != null ? x.kg : "") + '" placeholder="每' + esc(x.unit || "單位") + '幾kg" inputmode="decimal">'
                        + '<button type="button" class="btn btn-primary" data-map="' + esc(x.code) + '">' + (x.mappedTo ? "改對到這裡" : "對照") + "</button></div>";
                }).join("") : (q ? '<div class="mk-flat" style="font-size:13px">找不到「' + esc(q) + "」，換個關鍵字（例如只打前兩個字）。</div>" : "");
            })
            .catch(function (e) { $("mkOmsg").textContent = "搜尋失敗：" + (e.message || e) + "。請重新整理再試。"; });
    }
    function afterMapChange(crop, list) {
        if (list.length) maps[crop] = list; else delete maps[crop];
        renderOurs(); renderSummary(); renderList();
    }

    // ── 事件 ──
    function toggleStar(name) {
        var on = !watch[name];
        var paint = function (v) {
            if (v) watch[name] = 1; else delete watch[name];
            document.querySelectorAll("[data-star]").forEach(function (b) { if (b.getAttribute("data-star") === name) b.classList.toggle("on", v); });
            if (state.watchOnly || state.ours) renderList();
        };
        paint(on);
        post("/admin/logistics/market/watch", { crop: name, on: on }).then(function (j) {
            if (!j.ok) { paint(!on); window.alert(j.error || "關注設定失敗，請重新整理再試。"); }
        }).catch(function () { paint(!on); window.alert("連線失敗，關注沒有存到。請確認網路後再點一次。"); });
    }
    document.addEventListener("click", function (e) {
        var st = e.target.closest("[data-star]");
        if (st) { e.stopPropagation(); toggleStar(st.getAttribute("data-star")); return; }
        var fl = e.target.closest("[data-flt]");
        if (fl) { var v = fl.getAttribute("data-flt"); state.flt = state.flt === v ? "all" : v; state.limit = 80; renderSummary(); renderList(); return; }
        var rg = e.target.closest("[data-r]");
        if (rg && cur) { var rv = rg.getAttribute("data-r"); range = rv === "season" ? "season" : Number(rv); document.querySelectorAll("#mkRange [data-r]").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-r") === rv); }); if (hist) drawChart(); return; }
        var mp = e.target.closest("[data-map]");
        if (mp && cur) {
            var code = mp.getAttribute("data-map"), kgEl = document.querySelector('[data-kg="' + code.replace(/"/g, "") + '"]'), crop = cur.name;
            mp.disabled = true;
            post("/admin/logistics/market/map", { crop: crop, code: code, kg: kgEl ? kgEl.value : "" }).then(function (j) {
                mp.disabled = false;
                if (!j.ok) { $("mkOmsg").textContent = j.error || "儲存失敗"; return; }
                // 同一料號原本對到別的品名 → 那邊要拿掉
                Object.keys(maps).forEach(function (k) { if (k !== crop) { maps[k] = maps[k].filter(function (m) { return m.code !== code; }); if (!maps[k].length) delete maps[k]; } });
                afterMapChange(crop, j.mappings || []);
            }).catch(function () { mp.disabled = false; $("mkOmsg").textContent = "連線失敗，沒有存到。請確認網路後再按一次。"; });
            return;
        }
        var um = e.target.closest("[data-unmap]");
        if (um && cur) {
            var crop2 = cur.name;
            um.disabled = true;
            post("/admin/logistics/market/map/delete", { code: um.getAttribute("data-unmap") }).then(function (j) {
                um.disabled = false;
                if (!j.ok) { $("mkOmsg").textContent = j.error || "刪除失敗"; return; }
                afterMapChange(crop2, j.mappings || []);
            }).catch(function () { um.disabled = false; $("mkOmsg").textContent = "連線失敗，沒有刪到。請確認網路後再按一次。"; });
            return;
        }
        if (e.target.closest(".mk-drawer")) return;
        var row = e.target.closest(".mk-row[data-n], .mk-mv[data-n]");
        if (row) openDrawer(row.getAttribute("data-n"));
    });
    $("mkMask").onclick = closeDrawer;
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && cur) closeDrawer(); });
    window.addEventListener("resize", function () { if (cur && hist) drawChart(); });
    var qt = null;
    $("mkQ").addEventListener("input", function () { var v = this.value; clearTimeout(qt); qt = setTimeout(function () { state.q = v.trim(); state.limit = 80; renderList(); }, 120); });
    $("mkSort").addEventListener("change", function () { state.sort = this.value; renderList(); });
    $("mkWatchOnly").addEventListener("change", function () { state.watchOnly = this.checked; state.limit = 80; renderList(); });
    var oursEl = $("mkOurs0");
    oursEl.checked = state.ours;
    oursEl.addEventListener("change", function () { state.ours = this.checked; try { localStorage.setItem(OKEY, this.checked ? "1" : "0"); } catch (_) { /* 記不住就只在本頁有效 */ } state.limit = 80; renderSummary(); renderList(); });
    renderSummary();
    renderList();
}
