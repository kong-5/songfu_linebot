"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFreezerFridgeRoutes = registerFreezerFridgeRoutes;

// 環境衛生管理域（冷凍/冷藏庫月曆、倉別主檔 CRUD、每日溫度記錄填報）路由：
// 自 index.js 拆出（拆檔批次 7），純搬移、行為不變。

const express_1 = { default: require("express") };
const id_js_1 = require("../lib/id.js");
const { SF_ICONS, sfInlineIcon, escapeHtml, escapeAttr, escJsStr } = require("./_shared.js");

function registerFreezerFridgeRoutes(router, ctx) {
    const { db, notionPage, getTaipeiCalendarDateYYYYMMDD } = ctx;
    function parseFridgeEntriesJson(entriesJson) {
        if (!entriesJson)
            return [];
        try {
            return typeof entriesJson === "string" ? JSON.parse(entriesJson) : entriesJson;
        }
        catch (_) {
            return [];
        }
    }
    // ---------- 環境衛生管理 ----------
    router.get("/freezer-fridge", async (req, res) => {
        const warehouses = await db.prepare("SELECT id, name, sort_order, compliant_temp, power_compliant, light_compliant, heat_compliant FROM freezer_fridge_warehouses ORDER BY sort_order, name").all();
        const month = req.query.month?.trim() || new Date().toISOString().slice(0, 7);
        const [y, m] = month.split("-").map(Number);
        const nextMonthFirst = m === 12 ? (y + 1) + "-01-01" : y + "-" + String(m + 1).padStart(2, "0") + "-01";
        const records = await db.prepare("SELECT date, filler_name, confirmed_at, anomaly FROM freezer_fridge_daily WHERE date >= ? AND date < ? ORDER BY date").all(month + "-01", nextMonthFirst);
        const recordByDate = {};
        records.forEach((r) => { recordByDate[r.date] = r; });
        const firstDay = new Date(y, m - 1, 1);
        const daysInMonth = new Date(y, m, 0).getDate();
        const calRows = [];
        let week = [];
        const startPad = firstDay.getDay();
        for (let i = 0; i < startPad; i++)
            week.push("");
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = month + "-" + String(d).padStart(2, "0");
            const rec = recordByDate[dateStr];
            week.push(rec ? `<a href="/admin/freezer-fridge/daily?date=${dateStr}" class="cal-day filled">${d}</a>` : `<a href="/admin/freezer-fridge/daily?date=${dateStr}" class="cal-day">${d}</a>`);
            if (week.length === 7) {
                calRows.push(week);
                week = [];
            }
        }
        if (week.length)
            calRows.push(week);
        const calHtml = "<table class=\"freezer-cal\"><thead><tr><th>日</th><th>一</th><th>二</th><th>三</th><th>四</th><th>五</th><th>六</th></tr></thead><tbody>" + calRows.map((row) => "<tr>" + row.map((cell) => "<td>" + (cell || "") + "</td>").join("") + "</tr>").join("") + "</tbody></table>";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 庫存管理 / 冷凍庫冷藏庫檢查表</div>
        <h1 class="notion-page-title">冷凍庫冷藏庫檢查表</h1>
        <p class="notion-hint" style="margin-bottom:16px;">每日填寫各庫房溫度、電源、電燈、電熱；請先至「庫房管理」新增庫房。</p>
        <p style="margin-bottom:16px;"><a href="/admin/freezer-fridge/warehouses" class="btn">庫房管理</a>（共 ${warehouses.length} 個庫房）</p>
        <div class="notion-card">
          <h2>${month} 月曆</h2>
          <form method="get" action="/admin/freezer-fridge" style="margin-bottom:12px;">
            <input type="month" name="month" value="${escapeAttr(month)}"> <button type="submit" class="btn">切換月份</button>
          </form>
          ${calHtml}
          <p class="notion-hint" style="margin-top:12px;">點選日期填寫當日檢查表。</p>
        </div>
        <div class="notion-card">
          <h2>當月填表紀錄</h2>
          ${records.length ? "<table><thead><tr><th>日期</th><th>填表人</th><th>狀態</th><th>操作</th></tr></thead><tbody>" + records.map((r) => `<tr><td>${r.date}</td><td>${escapeHtml(r.filler_name || "")}</td><td>${r.confirmed_at ? "已確認" : "已填"}${r.anomaly ? "、異常" : ""}</td><td><a href="/admin/freezer-fridge/daily?date=${r.date}">編輯</a></td></tr>`).join("") + "</tbody></table>" : "<p>本月尚無填表紀錄</p>"}
        </div>
      `;
        res.type("text/html").send(notionPage("冷凍庫冷藏庫檢查表", body + "\n<style>.freezer-cal td,.freezer-cal th{border:1px solid var(--notion-border);padding:8px;min-width:40px;}.freezer-cal .cal-day{display:block;text-align:center;text-decoration:none;color:var(--notion-accent);}.freezer-cal .cal-day.filled{font-weight:600;}</style>", "env", res));
    });
    router.get("/freezer-fridge/warehouses", async (req, res) => {
        const rows = await db.prepare("SELECT id, name, sort_order, compliant_temp, power_compliant, light_compliant, heat_compliant FROM freezer_fridge_warehouses ORDER BY sort_order, name").all();
        const msg = req.query.ok ? "<p class=\"notion-msg ok\">已儲存。</p>" : req.query.err ? "<p class=\"notion-msg err\">" + escapeHtml(String(req.query.err)) + "</p>" : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/freezer-fridge">冷凍庫冷藏庫檢查表</a> / 庫房管理</div>
        <h1 class="notion-page-title">冷凍／冷藏庫房設定</h1>
        ${msg}
        <p style="margin-bottom:16px;"><a href="/admin/freezer-fridge/warehouses/new" class="btn btn-primary">＋ 新增庫房</a></p>
        <div class="notion-card">
          <table>
            <thead><tr><th>順序</th><th>庫房名稱</th><th>合規溫度</th><th>電源</th><th>電燈</th><th>電熱</th><th>操作</th></tr></thead>
            <tbody>
              ${rows.length ? rows.map((r) => `<tr><td>${r.sort_order}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.compliant_temp || "")}</td><td>${r.power_compliant}</td><td>${r.light_compliant}</td><td>${r.heat_compliant}</td><td><a href="/admin/freezer-fridge/warehouses/${encodeURIComponent(r.id)}/edit">編輯</a> | <a href="/admin/freezer-fridge/warehouses/${encodeURIComponent(r.id)}/delete">刪除</a></td></tr>`).join("") : "<tr><td colspan=\"7\">尚無庫房</td></tr>"}
            </tbody>
          </table>
        </div>
      `;
        res.type("text/html").send(notionPage("冷凍冷藏庫房管理", body, "env", res));
    });
    router.get("/freezer-fridge/warehouses/new", async (_req, res) => {
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/freezer-fridge">冷凍庫冷藏庫檢查表</a> / <a href="/admin/freezer-fridge/warehouses">庫房管理</a> / 新增</div>
        <h1 class="notion-page-title">新增庫房</h1>
        <div class="notion-card">
          <form method="post" action="/admin/freezer-fridge/warehouses/new">
            <label>庫房名稱 <input type="text" name="name" required placeholder="例：9號冷凍庫"></label>
            <label>合規溫度 <input type="text" name="compliant_temp" placeholder="例：−18°C 以下 或 2~7"></label>
            <label>電源合規 <select name="power_compliant"><option value="on">正常為開</option><option value="off">正常為關</option></select></label>
            <label>電燈合規 <select name="light_compliant"><option value="off">應關閉</option><option value="on">應開啟</option></select></label>
            <label>電熱合規 <select name="heat_compliant"><option value="off">符合為關</option><option value="on">符合為開</option></select></label>
            <label>順序 <input type="number" name="sort_order" value="0"></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">新增</button> <a href="/admin/freezer-fridge/warehouses" class="btn">取消</a></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("新增庫房", body, "env", res));
    });
    router.post("/freezer-fridge/warehouses/new", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const name = (req.body.name || "").trim();
        const compliantTemp = (req.body.compliant_temp || "").trim();
        const powerCompliant = (req.body.power_compliant || "on").trim();
        const lightCompliant = (req.body.light_compliant || "off").trim();
        const heatCompliant = (req.body.heat_compliant || "off").trim();
        const sortOrder = parseInt(req.body.sort_order, 10) || 0;
        if (!name) {
            res.redirect("/admin/freezer-fridge/warehouses/new?err=name");
            return;
        }
        const id = (0, id_js_1.newId)("ffwh");
        await db.prepare("INSERT INTO freezer_fridge_warehouses (id, name, sort_order, compliant_temp, power_compliant, light_compliant, heat_compliant) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, name, sortOrder, compliantTemp, powerCompliant, lightCompliant, heatCompliant);
        res.redirect("/admin/freezer-fridge/warehouses?ok=1");
    });
    router.get("/freezer-fridge/warehouses/:id/edit", async (req, res) => {
        const row = await db.prepare("SELECT * FROM freezer_fridge_warehouses WHERE id = ?").get(req.params.id);
        if (!row) {
            res.redirect("/admin/freezer-fridge/warehouses?err=notfound");
            return;
        }
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/freezer-fridge">冷凍庫冷藏庫檢查表</a> / <a href="/admin/freezer-fridge/warehouses">庫房管理</a> / 編輯</div>
        <h1 class="notion-page-title">編輯庫房</h1>
        <div class="notion-card">
          <form method="post" action="/admin/freezer-fridge/warehouses/${encodeURIComponent(row.id)}/edit">
            <label>庫房名稱 <input type="text" name="name" value="${escapeAttr(row.name)}" required></label>
            <label>合規溫度 <input type="text" name="compliant_temp" value="${escapeAttr(row.compliant_temp || "")}"></label>
            <label>電源合規 <select name="power_compliant"><option value="on" ${row.power_compliant === "on" ? "selected" : ""}>正常為開</option><option value="off" ${row.power_compliant === "off" ? "selected" : ""}>正常為關</option></select></label>
            <label>電燈合規 <select name="light_compliant"><option value="off" ${row.light_compliant === "off" ? "selected" : ""}>應關閉</option><option value="on" ${row.light_compliant === "on" ? "selected" : ""}>應開啟</option></select></label>
            <label>電熱合規 <select name="heat_compliant"><option value="off" ${row.heat_compliant === "off" ? "selected" : ""}>符合為關</option><option value="on" ${row.heat_compliant === "on" ? "selected" : ""}>符合為開</option></select></label>
            <label>順序 <input type="number" name="sort_order" value="${row.sort_order}"></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">儲存</button> <a href="/admin/freezer-fridge/warehouses" class="btn">取消</a></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("編輯庫房", body, "env", res));
    });
    router.post("/freezer-fridge/warehouses/:id/edit", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const id = req.params.id;
        const name = (req.body.name || "").trim();
        const compliantTemp = (req.body.compliant_temp || "").trim();
        const powerCompliant = (req.body.power_compliant || "on").trim();
        const lightCompliant = (req.body.light_compliant || "off").trim();
        const heatCompliant = (req.body.heat_compliant || "off").trim();
        const sortOrder = parseInt(req.body.sort_order, 10) || 0;
        const row = await db.prepare("SELECT id FROM freezer_fridge_warehouses WHERE id = ?").get(id);
        if (!row || !name) {
            res.redirect("/admin/freezer-fridge/warehouses?err=name");
            return;
        }
        await db.prepare("UPDATE freezer_fridge_warehouses SET name = ?, sort_order = ?, compliant_temp = ?, power_compliant = ?, light_compliant = ?, heat_compliant = ? WHERE id = ?").run(name, sortOrder, compliantTemp, powerCompliant, lightCompliant, heatCompliant, id);
        res.redirect("/admin/freezer-fridge/warehouses?ok=1");
    });
    router.get("/freezer-fridge/warehouses/:id/delete", async (req, res) => {
        const row = await db.prepare("SELECT id, name FROM freezer_fridge_warehouses WHERE id = ?").get(req.params.id);
        if (!row) {
            res.redirect("/admin/freezer-fridge/warehouses?err=notfound");
            return;
        }
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/freezer-fridge">冷凍庫冷藏庫檢查表</a> / <a href="/admin/freezer-fridge/warehouses">庫房管理</a> / 確認刪除</div>
        <h1 class="notion-page-title">確認刪除</h1>
        <div class="notion-card"><p>確定要刪除「${escapeHtml(row.name)}」？<br><form method="post" action="/admin/freezer-fridge/warehouses/${encodeURIComponent(row.id)}/delete" style="display:inline;margin-top:12px;"><button type="submit" class="btn">確定刪除</button></form> <a href="/admin/freezer-fridge/warehouses" class="btn">取消</a></p></div>
      `;
        res.type("text/html").send(notionPage("確認刪除", body, "env", res));
    });
    router.post("/freezer-fridge/warehouses/:id/delete", async (req, res) => {
        await db.prepare("DELETE FROM freezer_fridge_warehouses WHERE id = ?").run(req.params.id);
        res.redirect("/admin/freezer-fridge/warehouses?ok=del");
    });
    router.get("/freezer-fridge/daily", async (req, res) => {
        const date = req.query.date?.trim() || new Date().toISOString().slice(0, 10);
        const warehouses = await db.prepare("SELECT id, name, sort_order, compliant_temp, power_compliant, light_compliant, heat_compliant FROM freezer_fridge_warehouses ORDER BY sort_order, name").all();
        const row = await db.prepare("SELECT * FROM freezer_fridge_daily WHERE date = ?").get(date);
        const entries = row ? parseFridgeEntriesJson(row.entries_json) : [];
        const entryByWh = {};
        entries.forEach((e) => { entryByWh[e.warehouseId] = e; });
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/freezer-fridge">冷凍庫冷藏庫檢查表</a> / 每日填報</div>
        <h1 class="notion-page-title">${date} 冷凍冷藏庫房檢查</h1>
        ${warehouses.length === 0 ? "<p class=\"notion-msg err\">請先至庫房管理新增庫房。</p>" : `
        <div class="notion-card">
          <form method="post" action="/admin/freezer-fridge/daily/save">
            <input type="hidden" name="date" value="${escapeAttr(date)}">
            <label>填表人 <input type="text" name="filler_name" value="${escapeAttr(row?.filler_name || "")}"></label>
            <table>
              <thead><tr><th>庫房</th><th>合規溫度</th><th>溫度</th><th>電源</th><th>電燈</th><th>電熱</th></tr></thead>
              <tbody>
                ${warehouses.map((w) => {
            const e = entryByWh[w.id] || { warehouseId: w.id, temp: "", powerOk: true, lightOff: true, heatOk: true };
            return `<tr>
              <td>${escapeHtml(w.name)}</td>
              <td>${escapeHtml(w.compliant_temp || "")}</td>
              <td><input type="text" name="temp_${escapeAttr(w.id)}" value="${escapeAttr(e.temp || "")}" placeholder="例：-18"></td>
              <td><select name="power_${escapeAttr(w.id)}"><option value="ok" ${e.powerOk ? "selected" : ""}>正常</option><option value="ng" ${!e.powerOk ? "selected" : ""}>異常</option></select></td>
              <td><select name="light_${escapeAttr(w.id)}"><option value="off" ${e.lightOff ? "selected" : ""}>關閉</option><option value="on" ${!e.lightOff ? "selected" : ""}>開啟</option></select></td>
              <td><select name="heat_${escapeAttr(w.id)}"><option value="ok" ${e.heatOk ? "selected" : ""}>符合</option><option value="ng" ${!e.heatOk ? "selected" : ""}>不符合</option></select></td>
            </tr>`;
        }).join("")}
              </tbody>
            </table>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">儲存</button> <a href="/admin/freezer-fridge?month=${encodeURIComponent(date.slice(0, 7))}" class="btn">返回月曆</a></p>
          </form>
        </div>
        `}
      `;
        res.type("text/html").send(notionPage(date + " 檢查表", body, "env", res));
    });
    router.post("/freezer-fridge/daily/save", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const date = (req.body.date || "").trim();
        const fillerName = (req.body.filler_name || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            res.redirect("/admin/freezer-fridge/daily?date=" + encodeURIComponent(date || new Date().toISOString().slice(0, 10)) + "&err=date");
            return;
        }
        const warehouses = await db.prepare("SELECT id FROM freezer_fridge_warehouses").all();
        const entries = warehouses.map((w) => {
            const temp = (req.body["temp_" + w.id] || "").trim();
            const power = req.body["power_" + w.id];
            const light = req.body["light_" + w.id];
            const heat = req.body["heat_" + w.id];
            return {
                warehouseId: w.id,
                temp,
                powerOk: power === "ok",
                lightOff: light === "off",
                heatOk: heat === "ok",
            };
        });
        const entriesJson = JSON.stringify(entries);
        const existing = await db.prepare("SELECT date FROM freezer_fridge_daily WHERE date = ?").get(date);
        if (existing) {
            await db.prepare("UPDATE freezer_fridge_daily SET entries_json = ?, filler_name = ? WHERE date = ?").run(entriesJson, fillerName || "—", date);
        }
        else {
            await db.prepare("INSERT INTO freezer_fridge_daily (date, entries_json, filler_name) VALUES (?, ?, ?)").run(date, entriesJson, fillerName || "—");
        }
        res.redirect("/admin/freezer-fridge/daily?date=" + encodeURIComponent(date) + "&ok=1");
    });
}
