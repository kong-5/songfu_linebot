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
.mk-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:14px;}
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
 */
function buildMarketBoardBody(o) {
    const { reqDate, dateStr, fellBack, snapSource, cat, msg, board, markets, rulesText, query, icons } = o;
    const catLabel = cat === "fruit" ? "水果" : cat === "all" ? "全部" : "蔬菜";
    const sourceTag = snapSource === "api" ? `<span class="mk-tag" style="background:var(--ok-soft);color:var(--ok);">即時 API</span>`
        : snapSource === "snapshot" ? `<span class="mk-tag" style="background:var(--warn-soft);color:var(--txt-2);">本地快照</span>` : "";
    const days = board.dates.length;
    const payload = JSON.stringify({
        date: dateStr,
        dates: board.dates,
        items: board.items,
        markets,
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
        <option value="code">依品號</option>
      </select>
      <label class="sf-switch-label"><input type="checkbox" id="mkWatchOnly"><span class="sf-switch"></span>只看關注</label>
    </div>
    <div class="notion-card mk-list" id="mkList"></div>
    <p class="mk-note">價格＝台北一／台北二「中價」以交易量加權合併，單位元／公斤。「30日位置」：最左＝近 30 個交易日最便宜、最右＝最貴。
      「相對低檔」＝位置在最低 20% 且比 30 日均價低 10% 以上；「相對高檔」反之。「走升／走跌」＝7 日均比 30 日均高／低 8% 以上。
      ☆ 關注品項只存在這台裝置。紅＝漲（進貨變貴）、綠＝跌。</p>
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
    var byName = {};
    items.forEach(function (it) { byName[it.name] = it; });
    var WKEY = "mkt_watch_v1";
    var watch = {};
    try { (JSON.parse(localStorage.getItem(WKEY) || "[]") || []).forEach(function (n) { watch[n] = 1; }); } catch (_) { /* 私密模式等讀不到就當空的 */ }
    function saveWatch() { try { localStorage.setItem(WKEY, JSON.stringify(Object.keys(watch))); } catch (_) { /* 存不了就只在本頁有效 */ } }
    var state = { q: "", sort: "vol", watchOnly: false, flt: "all", limit: 80 };
    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
    function f1(v) { return v == null ? "—" : Number(v).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
    function fInt(v) { return v == null ? "—" : Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 }); }
    function cls(p) { return p == null ? "mk-flat" : (p > 0.05 ? "mk-up" : (p < -0.05 ? "mk-dn" : "mk-flat")); }
    function chg(p) { if (p == null) return '<span class="mk-flat">—</span>'; return '<span class="' + cls(p) + '">' + (p > 0.05 ? "▲" : (p < -0.05 ? "▼" : "")) + (p > 0 ? "+" : "") + p.toFixed(1) + "%</span>"; }
    function tags(it) {
        var h = "";
        if (it.signal === "low") h += '<span class="mk-tag low">相對低檔</span>';
        else if (it.signal === "high") h += '<span class="mk-tag high">相對高檔</span>';
        if (it.trend === "up") h += '<span class="mk-tag tu">走升</span>';
        else if (it.trend === "down") h += '<span class="mk-tag td">走跌</span>';
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
        if (it.pos30 == null) return '<div class="mk-bar-l"><span>近30日價格持平</span></div>';
        return '<div class="mk-bar" title="近 ' + it.days + ' 個交易日：最低 ' + f1(it.min30) + '、最高 ' + f1(it.max30) + '"><i style="left:' + Math.max(3, Math.min(97, it.pos30)) + '%"></i></div>'
            + '<div class="mk-bar-l"><span>低 ' + f1(it.min30) + '</span>' + tags(it) + '<span>高 ' + f1(it.max30) + "</span></div>";
    }
    function rowHtml(it) {
        var on = watch[it.name] ? " on" : "";
        return '<div class="mk-row" data-n="' + esc(it.name) + '">'
            + '<button type="button" class="mk-star' + on + '" data-star="' + esc(it.name) + '" aria-label="關注">' + D.star + "</button>"
            + '<div class="mk-name"><div class="t">' + esc(it.name) + '</div><div class="c">' + esc(it.code || "") + "</div></div>"
            + '<div class="mk-spark">' + spark(it.spark) + "</div>"
            + '<div class="mk-price">' + f1(it.mid) + "<small>元/kg</small></div>"
            + '<div class="mk-chg">' + chg(it.dayPct) + "</div>"
            + '<div class="mk-pos">' + posBar(it) + "</div>"
            + '<div class="mk-vol">' + fInt(it.volume) + " kg" + (it.volPct != null ? '<small>量 ' + (it.volPct > 0 ? "+" : "") + it.volPct.toFixed(0) + "% vs 7日</small>" : "") + "</div>"
            + "</div>";
    }
    var HEAD = '<div class="mk-row mk-head"><span></span><span>品名</span><span>近30日走勢</span><span style="text-align:right">中價</span><span style="text-align:right">較前日</span><span>30日價位位置</span><span style="text-align:right" class="mk-vol">交易量</span></div>';
    function filtered() {
        var q = state.q.toLowerCase();
        var out = items.filter(function (it) {
            if (state.watchOnly && !watch[it.name]) return false;
            if (q && (it.name + " " + (it.code || "")).toLowerCase().indexOf(q) < 0) return false;
            if (state.flt === "up") return it.dayPct != null && it.dayPct > 0.05;
            if (state.flt === "dn") return it.dayPct != null && it.dayPct < -0.05;
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
            code: function (a, b) { return (a.code || "~").localeCompare(b.code || "~"); },
        }[state.sort];
        out.sort(function (a, b) { var w = (watch[b.name] ? 1 : 0) - (watch[a.name] ? 1 : 0); return w || cmp(a, b); });
        return out;
    }
    function renderList() {
        var list = filtered();
        var shown = list.slice(0, state.limit);
        var h = HEAD + (shown.length ? shown.map(rowHtml).join("") : '<div class="mk-empty">' + (state.watchOnly ? "還沒有關注品項：點品名左邊的 ☆ 加入" : "沒有符合的品項，換個關鍵字或篩選試試") + "</div>");
        if (list.length > shown.length) h += '<button type="button" class="mk-more" id="mkMore">顯示更多（還有 ' + (list.length - shown.length) + " 項）</button>";
        $("mkList").innerHTML = h;
        var more = $("mkMore");
        if (more) more.onclick = function () { state.limit += 150; renderList(); };
    }
    function renderSummary() {
        var c = { all: items.length, up: 0, dn: 0, low: 0, high: 0 };
        items.forEach(function (it) {
            if (it.dayPct != null && it.dayPct > 0.05) c.up++;
            if (it.dayPct != null && it.dayPct < -0.05) c.dn++;
            if (it.signal === "low") c.low++;
            if (it.signal === "high") c.high++;
        });
        var defs = [["up", "較前日上漲", "mk-up"], ["dn", "較前日下跌", "mk-dn"], ["low", "相對低檔（便宜）", "mk-dn"], ["high", "相對高檔（貴）", "mk-up"]];
        $("mkSum").innerHTML = defs.map(function (d) {
            return '<button type="button" data-flt="' + d[0] + '" class="' + (state.flt === d[0] ? "on" : "") + '"><span class="n ' + d[2] + '">' + c[d[0]] + '</span><span class="l">' + d[1] + "</span></button>";
        }).join("");
        // 漲跌榜只看有一定交易量的品項（小量品項一天翻倍是常態，沒參考價值）
        var big = items.filter(function (it) { return it.dayPct != null && (it.volume || 0) >= 1000; });
        var ups = big.slice().sort(function (a, b) { return b.dayPct - a.dayPct; }).filter(function (it) { return it.dayPct > 0.05; }).slice(0, 5);
        var dns = big.slice().sort(function (a, b) { return a.dayPct - b.dayPct; }).filter(function (it) { return it.dayPct < -0.05; }).slice(0, 5);
        var mv = function (list) { return list.length ? list.map(function (it) { return '<div class="mk-mv" data-n="' + esc(it.name) + '"><span>' + esc(it.name) + " <small style=\"color:var(--txt-3)\">" + f1(it.mid) + "</small></span>" + chg(it.dayPct) + "</div>"; }).join("") : '<div class="mk-flat" style="font-size:13px">無</div>'; };
        $("mkMovers").innerHTML = '<div class="notion-card"><h3>漲最多（量 ≥1 噸）</h3>' + mv(ups) + '</div><div class="notion-card"><h3>跌最多（量 ≥1 噸）</h3>' + mv(dns) + "</div>";
    }

    // ── 走勢面板 ──
    var cur = null, hist = null, range = 90;
    function closeDrawer() { document.body.classList.remove("mk-open"); $("mkDrawer").setAttribute("aria-hidden", "true"); cur = null; }
    function hintText(it) {
        if (it.days < 10 || it.vsAvg30 == null) return "歷史資料不足 10 個交易日，先看走勢圖就好（可到「多品項比較」頁回補歷史）。";
        var s = "今日 " + f1(it.mid) + " 元，比 30 日均價 " + f1(it.avg30) + (it.vsAvg30 >= 0 ? " 高 " : " 低 ") + Math.abs(it.vsAvg30).toFixed(0) + "%，在近 30 日區間的 " + (it.pos30 == null ? "—" : it.pos30 + "%") + " 位置";
        if (it.signal === "low") s += "（相對便宜）";
        else if (it.signal === "high") s += "（相對貴）";
        s += "。";
        if (it.trend === "up") s += "近一週均價比 30 日均高 " + it.trendPct.toFixed(0) + "%，正在走升。";
        else if (it.trend === "down") s += "近一週均價比 30 日均低 " + Math.abs(it.trendPct).toFixed(0) + "%，正在走跌。";
        else s += "近一週價格大致平穩。";
        if (it.signal === "low" && it.trend !== "down") s += " → 可考慮趁低多備。";
        else if (it.signal === "low") s += " → 還在跌，可分批進。";
        else if (it.signal === "high" && it.trend === "up") s += " → 還在漲，建議少量多次、先找替代品。";
        else if (it.signal === "high") s += " → 偏貴，非必要先少進。";
        return s;
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
            + "<div>" + tags(it) + "</div>"
            + '<div class="mk-hint">' + esc(hintText(it)) + "</div>"
            + '<div class="sf-seg" id="mkRange">' + [[30, "30日"], [90, "90日"], [180, "半年"], [365, "一年"]].map(function (r) { return '<button type="button" data-r="' + r[0] + '" class="' + (range === r[0] ? "active" : "") + '">' + r[1] + "</button>"; }).join("") + "</div>"
            + '<div class="mk-chart" id="mkChart"><div class="mk-empty">載入走勢中…</div></div>'
            + '<div class="mk-legend"><span><i style="background:var(--accent)"></i>中價</span><span><i style="background:var(--warn)"></i>7日均</span><span><i style="background:var(--accent-soft);height:8px"></i>上價～下價</span><span><i style="background:var(--line-2);height:8px"></i>交易量</span></div>'
            + '<div class="mk-stats" id="mkStats"></div>'
            + mkHtml;
        var end = D.date;
        var start = new Date(new Date(end + "T00:00:00Z").getTime() - 400 * 86400000).toISOString().slice(0, 10);
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
    function drawStats() {
        var it = cur, h = hist || [];
        var avgN = function (n) { var a = h.slice(-n).map(function (p) { return p.mid; }); return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : null; };
        var d = new Date(D.date + "T00:00:00Z").getTime() - 365 * 86400000, ly = null, best = 1e18;
        h.forEach(function (p) { var diff = Math.abs(new Date(p.date + "T00:00:00Z").getTime() - d); if (diff < best && diff <= 7 * 86400000) { best = diff; ly = p; } });
        var vs = function (v) { if (v == null || !(v > 0)) return ""; var p = (it.mid - v) / v * 100; return '<div class="s ' + cls(p) + '">今日' + (p >= 0 ? "高 " : "低 ") + Math.abs(p).toFixed(0) + "%</div>"; };
        var cells = [
            ["7日均", it.ma7], ["30日均", it.avg30], ["90日均", h.length >= 30 ? avgN(90) : null],
            ["30日最低", it.min30], ["30日最高", it.max30], ["去年同期" + (ly ? "（" + ly.date.slice(5) + "）" : ""), ly ? ly.mid : null],
        ];
        $("mkStats").innerHTML = cells.map(function (c) { return '<div><div class="l">' + esc(c[0]) + '</div><div class="v">' + f1(c[1]) + "</div>" + (c[0].indexOf("最") >= 0 ? "" : vs(c[1])) + "</div>"; }).join("");
    }
    function drawChart() {
        var box = $("mkChart"), h = hist || [];
        var cutoff = new Date(new Date(D.date + "T00:00:00Z").getTime() - range * 86400000).toISOString().slice(0, 10);
        var pts = h.filter(function (p) { return p.date > cutoff; });
        if (pts.length < 2) { box.innerHTML = '<div class="mk-empty">這段期間資料不足 2 天，換長一點的區間，或到「多品項比較」頁按「回補歷史」。</div>'; return; }
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
        for (var i = 0; i < n; i += step) s += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 6) + '" font-size="10" fill="var(--txt-3)" text-anchor="middle">' + pts[i].date.slice(5).replace("-", "/") + "</text>";
        s += '<line id="mkG" y1="' + pt + '" y2="' + (H - pb) + '" stroke="var(--line-3)" stroke-dasharray="3,3" style="display:none"/><circle id="mkDot" r="4" fill="var(--accent)" stroke="var(--notion-card,#fff)" stroke-width="2" style="display:none"/></svg><div class="mk-tip" id="mkTip"></div>';
        box.innerHTML = s;
        var svg = box.querySelector("svg"), g = $("mkG"), dot = $("mkDot"), tip = $("mkTip");
        function at(clientX) {
            var r = svg.getBoundingClientRect(), sx = (clientX - r.left) / r.width * W;
            var i = Math.round((sx - pl) / ((W - pl - pr) / Math.max(1, n - 1)));
            i = Math.max(0, Math.min(n - 1, i));
            var p = pts[i], x = X(i);
            g.setAttribute("x1", x); g.setAttribute("x2", x); g.style.display = "";
            dot.setAttribute("cx", x); dot.setAttribute("cy", Y(p.mid)); dot.style.display = "";
            tip.innerHTML = "<b>" + p.date + "</b><br>中價 " + f1(p.mid) + "<br>上 " + f1(p.high) + " ／ 下 " + f1(p.low) + "<br>7日均 " + f1(ma[i]) + "<br>量 " + fInt(p.volume) + " kg";
            tip.style.display = "block";
            var px = x / W * r.width;
            tip.style.left = (px > r.width / 2 ? px - tip.offsetWidth - 10 : px + 10) + "px";
        }
        function hide() { g.style.display = "none"; dot.style.display = "none"; tip.style.display = "none"; }
        svg.addEventListener("pointermove", function (e) { at(e.clientX); });
        svg.addEventListener("pointerdown", function (e) { at(e.clientX); });
        svg.addEventListener("pointerleave", hide);
    }

    // ── 事件 ──
    function toggleStar(name) {
        if (watch[name]) delete watch[name]; else watch[name] = 1;
        saveWatch();
        var on = !!watch[name];
        document.querySelectorAll('[data-star]').forEach(function (b) { if (b.getAttribute("data-star") === name) b.classList.toggle("on", on); });
        if (state.watchOnly) renderList();
    }
    document.addEventListener("click", function (e) {
        var st = e.target.closest("[data-star]");
        if (st) { e.stopPropagation(); toggleStar(st.getAttribute("data-star")); return; }
        var fl = e.target.closest("[data-flt]");
        if (fl) { var v = fl.getAttribute("data-flt"); state.flt = state.flt === v ? "all" : v; state.limit = 80; renderSummary(); renderList(); return; }
        var rg = e.target.closest("[data-r]");
        if (rg && cur) { range = Number(rg.getAttribute("data-r")); document.querySelectorAll("#mkRange [data-r]").forEach(function (b) { b.classList.toggle("active", Number(b.getAttribute("data-r")) === range); }); if (hist) drawChart(); return; }
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
    renderSummary();
    renderList();
}
