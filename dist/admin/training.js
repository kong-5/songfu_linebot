"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTrainingRoutes = registerTrainingRoutes;

// 教育訓練（TTQS / PDDRO）後台模組。
// 依 Notion「TTQS」頁的系統設計：整套教育訓練走 PDDRO（Plan→Design→Do→Review→Outcome），
// 課程設計走 ADDIE，並保留使命願景價值觀、短中長期目標、滿意度調查、成效評估。
// 多公司（icpno）：00 松富、01 龍港、02 松揚、03 松成，沿用 lib/erp-companies.js。
// 資料表見 dist/db/index.js（training_*）。所有頁面走既有 Notion 風格元件與 notionPage 版型。

const express = require("express");

function registerTrainingRoutes(router, ctx) {
    const { db, notionPage, escapeHtml, escapeAttr, newId, erp, loadAdminUsers, logDataChange } = ctx;
    const urlenc = express.urlencoded({ extended: true, limit: "256kb" });
    // 刪除一律走 POST（GET 刪除會被瀏覽器預載/連結預覽誤觸）＋刪前寫稽核軌跡（守則 #3）
    const delBtn = (action, confirmMsg) =>
        `<form method="post" action="${action}" style="display:inline;margin:0;" onsubmit="return confirm('${confirmMsg}')"><button type="submit" class="sf-btn sm danger">刪除</button></form>`;
    const auditDelete = async (req, entityType, entityId, summary, before) => {
        try {
            if (typeof logDataChange === "function")
                await logDataChange(req, { entityType, entityId, action: "delete", summary, meta: { before } });
        } catch (_) { /* 稽核失敗不擋刪除流程（logDataChange 內部已吞錯，此為雙保險） */ }
    };

    // ---- 小工具 ----
    const nowIso = () => new Date().toISOString();
    const icpOf = (req) => erp.normIcpno(req.query.c || req.body?.c || "00");
    const actorOf = (req) => (req.adminUsername || req.adminProfile?.name || "").trim();
    const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
    const intOr = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
    const esc = (s) => escapeHtml(s == null ? "" : String(s));
    const att = (s) => escapeAttr(s == null ? "" : String(s));
    const CATS = ["訓練", "教育"];           // 訓練=眼前問題(內部)、教育=觀念改變(外部)
    const SRC = ["內部", "外部"];
    const PHASES = [
        { k: "P", label: "Plan 計畫" },
        { k: "D1", label: "Design 設計" },
        { k: "D2", label: "Do 執行" },
        { k: "R", label: "Review 查核" },
        { k: "O", label: "Outcome 成果" },
    ];
    const phaseLabel = (k) => (PHASES.find((p) => p.k === k) || { label: k }).label;
    const rocYearNow = () => String(new Date().getFullYear() - 1911);

    // 公司切換（sf-seg）
    function companySeg(activeIcp, base, extra) {
        const codes = Object.keys(erp.ERP_COMPANY_NAMES);
        const btns = codes.map((c) => {
            const q = new URLSearchParams(Object.assign({ c }, extra || {})).toString();
            return `<a href="${base}?${q}" class="${c === activeIcp ? "active" : ""}">${esc(erp.erpCompanyName(c))}</a>`;
        }).join("");
        return `<div class="sf-seg" style="flex-wrap:wrap;">${btns}</div>`;
    }

    // 教育訓練子分頁
    function subTabs(active, icp) {
        const tabs = [
            ["dash", "/admin/training", "儀表板"],
            ["plans", "/admin/training/plans", "年度計畫"],
            ["courses", "/admin/training/courses", "課程紀錄"],
            ["employees", "/admin/training/employees", "員工名冊"],
            ["system", "/admin/training/system", "TTQS 系統文件"],
        ];
        return `<div class="sf-seg" style="flex-wrap:wrap;margin-bottom:14px;">${tabs.map(([k, href, label]) =>
            `<a href="${href}?c=${icp}" class="${k === active ? "active" : ""}">${esc(label)}</a>`).join("")}</div>`;
    }

    function msgBar(req) {
        const ok = req.query.ok, err = req.query.err;
        if (ok) return `<p class="notion-msg ok">${esc(String(ok) === "1" ? "已儲存。" : ok)}</p>`;
        if (err) return `<p class="notion-msg err">${esc(String(err))}</p>`;
        return "";
    }

    function page(res, title, activeKey, subKey, icp, inner) {
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/training?c=${icp}">教育訓練</a>${title ? " / " + esc(title) : ""}</div>
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:2px 0 12px;">
          <h1 class="notion-page-title" style="margin:0;">教育訓練</h1>
          ${companySeg(icp, subKey === "dash" ? "/admin/training" : "/admin/training", {})}
        </div>
        ${subTabs(subKey, icp)}
        ${inner}`;
        res.type("text/html").send(notionPage("教育訓練 － " + (title || "儀表板"), body, activeKey, res));
    }

    // 分數星等顯示
    const scoreBadge = (avg, n) => {
        if (!n) return `<span class="sf-pill">尚無</span>`;
        const v = avg.toFixed(1);
        const cls = avg >= 4 ? "ok" : avg >= 3 ? "info" : "bad";
        return `<span class="sf-pill ${cls}">${v} / 5</span> <span style="color:var(--txt-3);font-size:12px;">(${n} 份)</span>`;
    };

    // 讀某公司員工（active 優先）
    async function employeesOf(icp) {
        return await db.prepare("SELECT * FROM training_employee WHERE icpno = ? ORDER BY status, sort_order, name").all(icp);
    }

    // ============================================================
    //  儀表板
    // ============================================================
    router.get("/training", async (req, res) => {
        const icp = icpOf(req);
        const year = String(req.query.year || rocYearNow()).trim();
        const plan = await db.prepare("SELECT * FROM training_plan WHERE icpno = ? AND year = ? ORDER BY created_at DESC LIMIT 1").get(icp, year);
        let items = [];
        if (plan) items = await db.prepare("SELECT * FROM training_plan_item WHERE plan_id = ? ORDER BY sort_order, month").all(plan.id);
        const doneItems = items.filter((i) => i.status === "done").length;
        // 本年度課程（依日期字串前綴 民國轉西元）
        const gYear = String(parseInt(year, 10) + 1911);
        const courses = await db.prepare("SELECT * FROM training_course WHERE icpno = ? AND (course_date LIKE ? OR course_date LIKE ?) ORDER BY course_date DESC")
            .all(icp, gYear + "-%", year + "-%");
        const courseIds = courses.map((c) => c.id);
        let totalHours = 0, trainedNames = new Set(), surveyRows = [];
        for (const c of courses) totalHours += Number(c.hours || 0);
        if (courseIds.length) {
            const ph = courseIds.map(() => "?").join(",");
            const atts = await db.prepare(`SELECT course_id, name, hours FROM training_attendance WHERE course_id IN (${ph}) AND signed = 1`).all(...courseIds);
            atts.forEach((a) => { if (a.name) trainedNames.add(a.name); });
            surveyRows = await db.prepare(`SELECT overall_score FROM training_survey WHERE course_id IN (${ph}) AND overall_score IS NOT NULL`).all(...courseIds);
        }
        const svgN = surveyRows.length;
        const svgAvg = svgN ? surveyRows.reduce((s, r) => s + Number(r.overall_score || 0), 0) / svgN : 0;
        const empCount = (await db.prepare("SELECT COUNT(*) c FROM training_employee WHERE icpno = ? AND status = 'active'").get(icp)).c;

        const stat = (label, val, sub) => `
          <div class="notion-card" style="flex:1;min-width:150px;margin:0;">
            <div style="color:var(--txt-3);font-size:12px;">${esc(label)}</div>
            <div style="font-size:26px;font-weight:700;line-height:1.2;margin-top:4px;">${val}</div>
            ${sub ? `<div style="color:var(--txt-3);font-size:12px;margin-top:2px;">${sub}</div>` : ""}
          </div>`;

        const recent = courses.slice(0, 8).map((c) =>
            `<tr><td class="mono" style="white-space:nowrap;">${esc(c.course_date || "—")}</td><td><a href="/admin/training/courses/${encodeURIComponent(c.id)}?c=${icp}">${esc(c.title)}</a></td><td>${esc(c.category || "")}</td><td>${esc(c.instructor || "")}</td><td style="text-align:right;">${c.hours != null ? esc(c.hours) : "—"}</td><td>${c.status === "done" ? '<span class="sf-pill ok">已辦</span>' : '<span class="sf-pill">規劃</span>'}</td></tr>`).join("");

        const yearForm = `<form method="get" action="/admin/training" style="display:inline-flex;gap:6px;align-items:center;">
            <input type="hidden" name="c" value="${icp}">
            <label style="margin:0;">年度(民國) <input type="text" name="year" value="${att(year)}" style="width:80px;"></label>
            <button type="submit" class="btn">查看</button></form>`;

        const inner = `
        ${msgBar(req)}
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
          ${stat("本年度計畫項目", `${doneItems}/${items.length}`, plan ? `完成率 ${items.length ? Math.round(doneItems / items.length * 100) : 0}%` : "尚未建立年度計畫")}
          ${stat("已辦課程", courses.filter((c) => c.status === "done").length, `共 ${courses.length} 場`)}
          ${stat("總受訓時數", totalHours.toFixed(1), "所有課程時數合計")}
          ${stat("受訓人次", trainedNames.size, `在職員工 ${empCount} 人`)}
          ${stat("整體滿意度", scoreBadge(svgAvg, svgN), "全年課程平均")}
        </div>
        <div class="notion-card">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
            <h2 style="margin:0;">${esc(erp.erpCompanyName(icp))}　${esc(year)} 年度　近期課程</h2>
            <span style="margin-left:auto;">${yearForm}</span>
            <a href="/admin/training/courses?c=${icp}" class="btn">課程紀錄 →</a>
            <a href="/admin/training/plans?c=${icp}" class="btn btn-primary">年度計畫 →</a>
          </div>
          <table>
            <thead><tr><th>日期</th><th>題目</th><th>類別</th><th>講師</th><th style="text-align:right;">時數</th><th>狀態</th></tr></thead>
            <tbody>${recent || `<tr><td colspan="6">本年度尚無課程紀錄。</td></tr>`}</tbody>
          </table>
        </div>
        <p style="color:var(--txt-3);font-size:12.5px;margin-top:14px;line-height:1.7;">
          TTQS/PDDRO：<b>P</b> 年度計畫、<b>D</b> 課程設計(ADDIE)與執行、<b>R</b> 簽到與滿意度查核、<b>O</b> 成效評估。
          系統層級的使命願景、短中長期目標與 PDDRO 查核記錄在「TTQS 系統文件」。
        </p>`;
        page(res, "", "tr-dash", "dash", icp, inner);
    });

    // ============================================================
    //  員工名冊
    // ============================================================
    router.get("/training/employees", async (req, res) => {
        const icp = icpOf(req);
        const editId = (req.query.edit || "").trim();
        const rows = await employeesOf(icp);
        const ed = editId ? rows.find((r) => r.id === editId) : null;
        const statusOpt = (v) => ["active", "left"].map((s) =>
            `<option value="${s}" ${v === s ? "selected" : ""}>${s === "active" ? "在職" : "離職"}</option>`).join("");
        const formCard = `
        <div class="notion-card" id="empForm" style="margin-bottom:16px;">
          <h2 style="margin-top:0;">${ed ? "編輯員工" : "新增員工"}</h2>
          <form method="post" action="/admin/training/employees/save">
            <input type="hidden" name="c" value="${icp}">
            <input type="hidden" name="id" value="${ed ? att(ed.id) : ""}">
            <div style="display:flex;gap:12px;flex-wrap:wrap;">
              <label style="flex:1;min-width:140px;">姓名 * <input type="text" name="name" required value="${ed ? att(ed.name) : ""}"></label>
              <label style="width:120px;">員工編號 <input type="text" name="emp_no" value="${ed ? att(ed.emp_no) : ""}"></label>
              <label style="width:140px;">部門 <input type="text" name="dept" value="${ed ? att(ed.dept) : ""}"></label>
              <label style="width:140px;">職稱 <input type="text" name="title" value="${ed ? att(ed.title) : ""}"></label>
              <label style="width:100px;">狀態 <select name="status">${statusOpt(ed ? ed.status : "active")}</select></label>
              <label style="width:90px;">排序 <input type="number" name="sort_order" value="${ed ? intOr(ed.sort_order, 0) : 0}"></label>
            </div>
            <label>備註 <input type="text" name="note" value="${ed ? att(ed.note) : ""}"></label>
            <p style="margin-top:14px;"><button type="submit" class="btn btn-primary">${ed ? "儲存" : "新增"}</button>
              ${ed ? `<a href="/admin/training/employees?c=${icp}" class="btn">取消</a>` : ""}</p>
          </form>
        </div>`;
        const body = rows.map((r) => `
          <tr style="${r.status === "left" ? "opacity:.55;" : ""}">
            <td>${esc(r.emp_no || "")}</td>
            <td><b>${esc(r.name)}</b></td>
            <td>${esc(r.dept || "")}</td>
            <td>${esc(r.title || "")}</td>
            <td>${r.status === "active" ? '<span class="sf-pill ok">在職</span>' : '<span class="sf-pill">離職</span>'}</td>
            <td>${esc(r.note || "")}</td>
            <td style="white-space:nowrap;"><a href="/admin/training/employees?c=${icp}&edit=${encodeURIComponent(r.id)}#empForm">編輯</a>
              | ${delBtn(`/admin/training/employees/${encodeURIComponent(r.id)}/delete?c=${icp}`, "確定刪除此員工？其歷史簽到紀錄仍保留。")}</td>
          </tr>`).join("");
        const inner = `
        ${msgBar(req)}
        ${formCard}
        <div class="notion-card">
          <h2 style="margin-top:0;">${esc(erp.erpCompanyName(icp))} 員工名冊（共 ${rows.length} 人）</h2>
          <table>
            <thead><tr><th>編號</th><th>姓名</th><th>部門</th><th>職稱</th><th>狀態</th><th>備註</th><th>操作</th></tr></thead>
            <tbody>${body || `<tr><td colspan="7">尚無員工，請於上方新增。課程簽到會用到此名冊。</td></tr>`}</tbody>
          </table>
        </div>`;
        page(res, "員工名冊", "tr-employees", "employees", icp, inner);
    });
    router.post("/training/employees/save", urlenc, async (req, res) => {
        const icp = icpOf(req);
        const name = (req.body.name || "").trim();
        if (!name) { res.redirect(`/admin/training/employees?c=${icp}&err=${encodeURIComponent("姓名必填")}`); return; }
        const id = (req.body.id || "").trim();
        const fields = {
            name,
            emp_no: (req.body.emp_no || "").trim() || null,
            dept: (req.body.dept || "").trim() || null,
            title: (req.body.title || "").trim() || null,
            status: req.body.status === "left" ? "left" : "active",
            note: (req.body.note || "").trim() || null,
            sort_order: intOr(req.body.sort_order, 0),
        };
        if (id) {
            await db.prepare("UPDATE training_employee SET name=?, emp_no=?, dept=?, title=?, status=?, note=?, sort_order=?, updated_at=? WHERE id=? AND icpno=?")
                .run(fields.name, fields.emp_no, fields.dept, fields.title, fields.status, fields.note, fields.sort_order, nowIso(), id, icp);
        } else {
            await db.prepare("INSERT INTO training_employee (id, icpno, name, emp_no, dept, title, status, note, sort_order, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
                .run(newId("temp"), icp, fields.name, fields.emp_no, fields.dept, fields.title, fields.status, fields.note, fields.sort_order, nowIso(), nowIso());
        }
        res.redirect(`/admin/training/employees?c=${icp}&ok=1`);
    });
    router.post("/training/employees/:id/delete", urlenc, async (req, res) => {
        const icp = icpOf(req);
        const before = await db.prepare("SELECT * FROM training_employee WHERE id = ?").get(req.params.id);
        await db.prepare("DELETE FROM training_employee WHERE id = ?").run(req.params.id);
        await auditDelete(req, "training_employee", req.params.id, `刪除員工 ${before?.name || req.params.id}`, before || null);
        res.redirect(`/admin/training/employees?c=${icp}&ok=${encodeURIComponent("已刪除")}`);
    });

    // ============================================================
    //  TTQS 系統文件（使命願景/短中長期目標/訓練政策）＋ PDDRO 查核
    // ============================================================
    router.get("/training/system", async (req, res) => {
        const icp = icpOf(req);
        const sys = (await db.prepare("SELECT * FROM training_system WHERE icpno = ?").get(icp)) || {};
        const checks = await db.prepare("SELECT * FROM training_pddro_check WHERE icpno = ? ORDER BY check_date DESC, created_at DESC").all(icp);
        const ta = (name, label, hint, rows) => `
          <label style="display:block;margin-bottom:12px;">${esc(label)}${hint ? ` <span style="color:var(--txt-3);font-weight:400;font-size:12px;">${esc(hint)}</span>` : ""}
            <textarea name="${name}" rows="${rows || 2}" style="width:100%;">${esc(sys[name] || "")}</textarea></label>`;
        const phaseOpt = PHASES.map((p) => `<option value="${p.k}">${esc(p.label)}</option>`).join("");
        const checkRows = checks.map((c) => `
          <tr>
            <td><span class="sf-pill">${esc(phaseLabel(c.phase))}</span></td>
            <td>${esc(c.item || "")}</td>
            <td>${esc(c.result || "")}</td>
            <td>${esc(c.evidence || "")}</td>
            <td>${c.status ? `<span class="sf-pill ${c.status === "符合" ? "ok" : c.status === "待改善" ? "bad" : "info"}">${esc(c.status)}</span>` : ""}</td>
            <td class="mono" style="white-space:nowrap;">${esc(c.check_date || "")}</td>
            <td>${esc(c.checked_by || "")}</td>
            <td>${delBtn(`/admin/training/system/pddro/${encodeURIComponent(c.id)}/delete?c=${icp}`, "刪除此查核記錄？")}</td>
          </tr>`).join("");
        const inner = `
        ${msgBar(req)}
        <div class="notion-card" style="margin-bottom:16px;">
          <h2 style="margin-top:0;">${esc(erp.erpCompanyName(icp))}　訓練品質系統（TTQS）</h2>
          <p style="color:var(--txt-3);font-size:12.5px;margin-top:0;">教育＝觀念改變（宜請外部講師）、訓練＝解決眼前問題（宜由內部主管擔任講師）。以下為系統層級文件，會用於年度計畫的方向依據。</p>
          <form method="post" action="/admin/training/system/save">
            <input type="hidden" name="c" value="${icp}">
            <div style="display:flex;gap:16px;flex-wrap:wrap;">
              <div style="flex:1;min-width:260px;">
                ${ta("mission", "使命", "我們為何存在", 2)}
                ${ta("vision", "願景", "想成為什麼", 2)}
                ${ta("core_values", "核心價值觀", "", 2)}
                ${ta("policy", "訓練政策", "公司對教育訓練的方針", 2)}
                ${ta("org_note", "訓練組織與權責", "誰負責規劃／執行／評估", 2)}
              </div>
              <div style="flex:1;min-width:260px;">
                ${ta("goal_short", "短期目標", "1 年內", 3)}
                ${ta("goal_mid", "中期目標", "2～3 年", 3)}
                ${ta("goal_long", "長期目標", "3 年以上", 3)}
              </div>
            </div>
            <p style="margin-top:6px;color:var(--txt-3);font-size:12px;">最後更新：${esc(sys.updated_at || "—")}${sys.updated_by ? "　" + esc(sys.updated_by) : ""}</p>
            <button type="submit" class="btn btn-primary">儲存系統文件</button>
          </form>
        </div>
        <div class="notion-card">
          <h2 style="margin-top:0;">PDDRO 查核記錄</h2>
          <p style="color:var(--txt-3);font-size:12.5px;margin-top:0;">每次執行以成果查核。P 計畫、D 設計、D 執行、R 查核、O 成果。</p>
          <form method="post" action="/admin/training/system/pddro/add" style="margin-bottom:14px;">
            <input type="hidden" name="c" value="${icp}">
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
              <label style="width:130px;">階段 <select name="phase">${phaseOpt}</select></label>
              <label style="flex:1;min-width:150px;">查核項目 <input type="text" name="item" placeholder="例：年度計畫是否對應目標"></label>
              <label style="flex:1;min-width:150px;">查核結果 <input type="text" name="result"></label>
              <label style="width:120px;">判定 <select name="status"><option value="">—</option><option value="符合">符合</option><option value="待改善">待改善</option><option value="不適用">不適用</option></select></label>
              <label style="width:150px;">查核日期 <input type="date" name="check_date"></label>
              <button type="submit" class="btn btn-primary">加入</button>
            </div>
            <label style="margin-top:8px;display:block;">佐證／成果 <input type="text" name="evidence" placeholder="連結、文件名或數據"></label>
          </form>
          <table>
            <thead><tr><th>階段</th><th>查核項目</th><th>結果</th><th>佐證/成果</th><th>判定</th><th>日期</th><th>查核人</th><th></th></tr></thead>
            <tbody>${checkRows || `<tr><td colspan="8">尚無查核記錄。</td></tr>`}</tbody>
          </table>
        </div>`;
        page(res, "TTQS 系統文件", "tr-system", "system", icp, inner);
    });
    router.post("/training/system/save", urlenc, async (req, res) => {
        const icp = icpOf(req);
        const b = req.body, g = (k) => (b[k] || "").trim() || null;
        const exists = await db.prepare("SELECT icpno FROM training_system WHERE icpno = ?").get(icp);
        const vals = [g("mission"), g("vision"), g("core_values"), g("policy"), g("org_note"), g("goal_short"), g("goal_mid"), g("goal_long"), actorOf(req), nowIso()];
        if (exists) {
            await db.prepare("UPDATE training_system SET mission=?, vision=?, core_values=?, policy=?, org_note=?, goal_short=?, goal_mid=?, goal_long=?, updated_by=?, updated_at=? WHERE icpno=?").run(...vals, icp);
        } else {
            await db.prepare("INSERT INTO training_system (mission, vision, core_values, policy, org_note, goal_short, goal_mid, goal_long, updated_by, updated_at, icpno) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(...vals, icp);
        }
        res.redirect(`/admin/training/system?c=${icp}&ok=1`);
    });
    router.post("/training/system/pddro/add", urlenc, async (req, res) => {
        const icp = icpOf(req);
        const phase = (req.body.phase || "P").trim();
        await db.prepare("INSERT INTO training_pddro_check (id, icpno, phase, item, result, evidence, status, checked_by, check_date, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
            .run(newId("pddro"), icp, phase, (req.body.item || "").trim() || null, (req.body.result || "").trim() || null, (req.body.evidence || "").trim() || null, (req.body.status || "").trim() || null, actorOf(req) || null, (req.body.check_date || "").trim() || null, nowIso());
        res.redirect(`/admin/training/system?c=${icp}&ok=1`);
    });
    router.post("/training/system/pddro/:id/delete", urlenc, async (req, res) => {
        const icp = icpOf(req);
        const before = await db.prepare("SELECT * FROM training_pddro_check WHERE id = ?").get(req.params.id);
        await db.prepare("DELETE FROM training_pddro_check WHERE id = ?").run(req.params.id);
        await auditDelete(req, "training_pddro_check", req.params.id, `刪除 PDDRO 查核記錄（${before?.item || req.params.id}）`, before || null);
        res.redirect(`/admin/training/system?c=${icp}&ok=${encodeURIComponent("已刪除")}`);
    });

    // ============================================================
    //  年度計畫
    // ============================================================
    router.get("/training/plans", async (req, res) => {
        const icp = icpOf(req);
        const plans = await db.prepare("SELECT * FROM training_plan WHERE icpno = ? ORDER BY year DESC, created_at DESC").all(icp);
        const counts = {};
        for (const p of plans) {
            const c = await db.prepare("SELECT COUNT(*) t, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) d FROM training_plan_item WHERE plan_id = ?").get(p.id);
            counts[p.id] = { t: c.t || 0, d: c.d || 0 };
        }
        const rows = plans.map((p) => {
            const c = counts[p.id];
            return `<tr>
              <td><b>${esc(p.year)}</b></td>
              <td><a href="/admin/training/plans/${encodeURIComponent(p.id)}?c=${icp}">${esc(p.title || (p.year + " 年度教育訓練計畫"))}</a></td>
              <td>${esc(p.goal || "")}</td>
              <td style="text-align:center;">${c.d}/${c.t}</td>
              <td style="white-space:nowrap;"><a href="/admin/training/plans/${encodeURIComponent(p.id)}?c=${icp}">明細</a>
                | ${delBtn(`/admin/training/plans/${encodeURIComponent(p.id)}/delete?c=${icp}`, "刪除此年度計畫及其所有排定項目？")}</td>
            </tr>`;
        }).join("");
        const inner = `
        ${msgBar(req)}
        <div class="notion-card" style="margin-bottom:16px;">
          <h2 style="margin-top:0;">新增年度計畫</h2>
          <form method="post" action="/admin/training/plans/save">
            <input type="hidden" name="c" value="${icp}">
            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
              <label style="width:120px;">年度(民國) * <input type="text" name="year" required value="${att(rocYearNow())}"></label>
              <label style="flex:1;min-width:200px;">計畫名稱 <input type="text" name="title" placeholder="例：115 年度教育訓練計畫"></label>
              <button type="submit" class="btn btn-primary">建立</button>
            </div>
            <label>本年度訓練目標 <input type="text" name="goal" placeholder="呼應短中長期目標"></label>
          </form>
        </div>
        <div class="notion-card">
          <h2 style="margin-top:0;">${esc(erp.erpCompanyName(icp))} 年度計畫</h2>
          <table>
            <thead><tr><th>年度</th><th>計畫名稱</th><th>目標</th><th style="text-align:center;">完成</th><th>操作</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="5">尚無年度計畫。</td></tr>`}</tbody>
          </table>
        </div>`;
        page(res, "年度計畫", "tr-plans", "plans", icp, inner);
    });
    router.post("/training/plans/save", urlenc, async (req, res) => {
        const icp = icpOf(req);
        const id = (req.body.id || "").trim();
        const year = (req.body.year || "").trim();
        if (!year) { res.redirect(`/admin/training/plans?c=${icp}&err=${encodeURIComponent("年度必填")}`); return; }
        const title = (req.body.title || "").trim() || null;
        const goal = (req.body.goal || "").trim() || null;
        const note = (req.body.note || "").trim() || null;
        if (id) {
            await db.prepare("UPDATE training_plan SET year=?, title=?, goal=?, note=?, updated_at=? WHERE id=? AND icpno=?").run(year, title, goal, note, nowIso(), id, icp);
            res.redirect(`/admin/training/plans/${encodeURIComponent(id)}?c=${icp}&ok=1`);
        } else {
            const nid = newId("tplan");
            await db.prepare("INSERT INTO training_plan (id, icpno, year, title, goal, note, status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
                .run(nid, icp, year, title, goal, note, "active", actorOf(req) || null, nowIso(), nowIso());
            res.redirect(`/admin/training/plans/${encodeURIComponent(nid)}?c=${icp}&ok=1`);
        }
    });
    router.post("/training/plans/:id/delete", urlenc, async (req, res) => {
        const icp = icpOf(req);
        const before = await db.prepare("SELECT * FROM training_plan WHERE id = ?").get(req.params.id);
        const items = await db.prepare("SELECT * FROM training_plan_item WHERE plan_id = ?").all(req.params.id);
        const doDel = async (h) => {
            await h.prepare("DELETE FROM training_plan_item WHERE plan_id = ?").run(req.params.id);
            await h.prepare("DELETE FROM training_plan WHERE id = ?").run(req.params.id);
        };
        if (typeof db.transaction === "function") await db.transaction(doDel); else await doDel(db);
        await auditDelete(req, "training_plan", req.params.id, `刪除年度計畫 ${before?.year || ""} ${before?.title || ""}（含 ${items.length} 個排定項目）`, { plan: before || null, items: items.slice(0, 100) });
        res.redirect(`/admin/training/plans?c=${icp}&ok=${encodeURIComponent("已刪除")}`);
    });
    router.get("/training/plans/:id", async (req, res) => {
        const icp = icpOf(req);
        const plan = await db.prepare("SELECT * FROM training_plan WHERE id = ?").get(req.params.id);
        if (!plan) { res.redirect(`/admin/training/plans?c=${icp}&err=${encodeURIComponent("找不到計畫")}`); return; }
        const editItemId = (req.query.item || "").trim();
        const items = await db.prepare("SELECT * FROM training_plan_item WHERE plan_id = ? ORDER BY sort_order, CAST(month AS INTEGER), month").all(plan.id);
        const ed = editItemId ? items.find((i) => i.id === editItemId) : null;
        const catOpt = (v) => CATS.map((c) => `<option value="${c}" ${v === c ? "selected" : ""}>${c}</option>`).join("");
        const srcOpt = (v) => `<option value="">—</option>` + SRC.map((c) => `<option value="${c}" ${v === c ? "selected" : ""}>${c}</option>`).join("");
        const itemRows = items.map((i) => `
          <tr>
            <td style="text-align:center;">${esc(i.month || "")}</td>
            <td><b>${esc(i.theme || "")}</b>${i.note ? `<div style="color:var(--txt-3);font-size:12px;">${esc(i.note)}</div>` : ""}</td>
            <td>${esc(i.category || "")}</td>
            <td>${esc(i.instructor || "")}${i.instructor_type ? `（${esc(i.instructor_type)}）` : ""}</td>
            <td>${esc(i.location || "")}</td>
            <td style="text-align:right;">${i.planned_hours != null ? esc(i.planned_hours) : ""}</td>
            <td>${i.status === "done" ? '<span class="sf-pill ok">已辦</span>' : i.status === "canceled" ? '<span class="sf-pill bad">取消</span>' : '<span class="sf-pill">未辦</span>'}</td>
            <td style="white-space:nowrap;">
              ${i.course_id ? `<a href="/admin/training/courses/${encodeURIComponent(i.course_id)}?c=${icp}">看課程</a>`
                : `<form method="post" action="/admin/training/plans/items/${encodeURIComponent(i.id)}/to-course" style="display:inline;"><input type="hidden" name="c" value="${icp}"><button type="submit" class="btn sm">轉為課程</button></form>`}
              | <a href="/admin/training/plans/${encodeURIComponent(plan.id)}?c=${icp}&item=${encodeURIComponent(i.id)}#itemForm">編輯</a>
              | ${delBtn(`/admin/training/plans/items/${encodeURIComponent(i.id)}/delete?c=${icp}&plan=${encodeURIComponent(plan.id)}`, "刪除此項目？")}
            </td>
          </tr>`).join("");
        const inner = `
        ${msgBar(req)}
        <div class="notion-card" style="margin-bottom:16px;">
          <h2 style="margin-top:0;">計畫資訊</h2>
          <form method="post" action="/admin/training/plans/save">
            <input type="hidden" name="c" value="${icp}"><input type="hidden" name="id" value="${att(plan.id)}">
            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
              <label style="width:120px;">年度(民國) <input type="text" name="year" value="${att(plan.year)}"></label>
              <label style="flex:1;min-width:200px;">計畫名稱 <input type="text" name="title" value="${att(plan.title)}"></label>
            </div>
            <label>本年度訓練目標 <input type="text" name="goal" value="${att(plan.goal)}"></label>
            <label>備註 <input type="text" name="note" value="${att(plan.note)}"></label>
            <p style="margin-top:12px;"><button type="submit" class="btn btn-primary">儲存</button></p>
          </form>
        </div>
        <div class="notion-card" id="itemForm" style="margin-bottom:16px;">
          <h2 style="margin-top:0;">${ed ? "編輯排定項目" : "新增排定項目"}</h2>
          <form method="post" action="/admin/training/plans/${encodeURIComponent(plan.id)}/items/save">
            <input type="hidden" name="c" value="${icp}"><input type="hidden" name="id" value="${ed ? att(ed.id) : ""}">
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
              <label style="width:90px;">月份 <input type="text" name="month" value="${ed ? att(ed.month) : ""}" placeholder="2"></label>
              <label style="flex:1;min-width:200px;">主題 * <input type="text" name="theme" required value="${ed ? att(ed.theme) : ""}"></label>
              <label style="width:100px;">類別 <select name="category">${catOpt(ed ? ed.category : "訓練")}</select></label>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-top:8px;">
              <label style="flex:1;min-width:140px;">講師 <input type="text" name="instructor" value="${ed ? att(ed.instructor) : ""}"></label>
              <label style="width:110px;">內外部 <select name="instructor_type">${srcOpt(ed ? ed.instructor_type : "")}</select></label>
              <label style="flex:1;min-width:140px;">地點 <input type="text" name="location" value="${ed ? att(ed.location) : "公司會議室"}"></label>
              <label style="width:110px;">預計時數 <input type="number" step="0.5" name="planned_hours" value="${ed && ed.planned_hours != null ? att(ed.planned_hours) : ""}"></label>
              <label style="width:120px;">狀態 <select name="status">
                <option value="planned" ${ed && ed.status === "planned" ? "selected" : ""}>未辦</option>
                <option value="done" ${ed && ed.status === "done" ? "selected" : ""}>已辦</option>
                <option value="canceled" ${ed && ed.status === "canceled" ? "selected" : ""}>取消</option>
              </select></label>
            </div>
            <label style="margin-top:8px;display:block;">備註 <input type="text" name="note" value="${ed ? att(ed.note) : ""}"></label>
            <p style="margin-top:12px;"><button type="submit" class="btn btn-primary">${ed ? "儲存" : "加入項目"}</button>
              ${ed ? `<a href="/admin/training/plans/${encodeURIComponent(plan.id)}?c=${icp}" class="btn">取消</a>` : ""}</p>
          </form>
        </div>
        <div class="notion-card">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
            <h2 style="margin:0;">${esc(plan.year)} 年度排定（${items.length} 項）</h2>
            <span style="margin-left:auto;"></span>
            <a href="/admin/training/plans/${encodeURIComponent(plan.id)}/print?c=${icp}" target="_blank" class="btn">列印計畫表</a>
            <a href="/admin/training/plans/${encodeURIComponent(plan.id)}/export.csv?c=${icp}" class="btn">CSV</a>
          </div>
          <table>
            <thead><tr><th>月</th><th>主題</th><th>類別</th><th>講師</th><th>地點</th><th style="text-align:right;">時數</th><th>狀態</th><th>操作</th></tr></thead>
            <tbody>${itemRows || `<tr><td colspan="8">尚無排定項目。</td></tr>`}</tbody>
          </table>
        </div>`;
        page(res, (plan.title || plan.year + " 年度計畫"), "tr-plans", "plans", icp, inner);
    });
    router.post("/training/plans/:id/items/save", urlenc, async (req, res) => {
        const icp = icpOf(req);
        const planId = req.params.id;
        const theme = (req.body.theme || "").trim();
        if (!theme) { res.redirect(`/admin/training/plans/${encodeURIComponent(planId)}?c=${icp}&err=${encodeURIComponent("主題必填")}`); return; }
        const id = (req.body.id || "").trim();
        const v = {
            month: (req.body.month || "").trim() || null,
            theme,
            category: CATS.includes(req.body.category) ? req.body.category : "訓練",
            instructor: (req.body.instructor || "").trim() || null,
            instructor_type: SRC.includes(req.body.instructor_type) ? req.body.instructor_type : null,
            location: (req.body.location || "").trim() || null,
            planned_hours: num(req.body.planned_hours),
            status: ["planned", "done", "canceled"].includes(req.body.status) ? req.body.status : "planned",
            note: (req.body.note || "").trim() || null,
        };
        if (id) {
            await db.prepare("UPDATE training_plan_item SET month=?, theme=?, category=?, instructor=?, instructor_type=?, location=?, planned_hours=?, status=?, note=? WHERE id=?")
                .run(v.month, v.theme, v.category, v.instructor, v.instructor_type, v.location, v.planned_hours, v.status, v.note, id);
        } else {
            const sortRow = await db.prepare("SELECT COALESCE(MAX(sort_order),0)+1 s FROM training_plan_item WHERE plan_id = ?").get(planId);
            await db.prepare("INSERT INTO training_plan_item (id, plan_id, month, theme, category, instructor, instructor_type, location, planned_hours, status, sort_order, note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
                .run(newId("tpi"), planId, v.month, v.theme, v.category, v.instructor, v.instructor_type, v.location, v.planned_hours, v.status, sortRow.s, v.note);
        }
        res.redirect(`/admin/training/plans/${encodeURIComponent(planId)}?c=${icp}&ok=1`);
    });
    router.post("/training/plans/items/:id/delete", urlenc, async (req, res) => {
        const icp = icpOf(req);
        const planId = (req.query.plan || "").trim();
        const before = await db.prepare("SELECT * FROM training_plan_item WHERE id = ?").get(req.params.id);
        await db.prepare("DELETE FROM training_plan_item WHERE id = ?").run(req.params.id);
        await auditDelete(req, "training_plan_item", req.params.id, `刪除計畫項目 ${before?.theme || req.params.id}`, before || null);
        res.redirect(`/admin/training/plans/${encodeURIComponent(planId)}?c=${icp}&ok=${encodeURIComponent("已刪除")}`);
    });
    router.post("/training/plans/items/:id/to-course", urlenc, async (req, res) => {
        const icp = icpOf(req);
        const item = await db.prepare("SELECT * FROM training_plan_item WHERE id = ?").get(req.params.id);
        if (!item) { res.redirect(`/admin/training/plans?c=${icp}&err=${encodeURIComponent("找不到項目")}`); return; }
        const plan = await db.prepare("SELECT * FROM training_plan WHERE id = ?").get(item.plan_id);
        const cid = newId("tcourse");
        await db.prepare("INSERT INTO training_course (id, icpno, plan_item_id, title, category, hours, instructor, instructor_type, location, status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .run(cid, plan ? plan.icpno : icp, item.id, item.theme || "未命名課程", item.category || null, item.planned_hours, item.instructor || null, item.instructor_type || null, item.location || null, "planned", actorOf(req) || null, nowIso(), nowIso());
        await db.prepare("UPDATE training_plan_item SET course_id = ? WHERE id = ?").run(cid, item.id);
        res.redirect(`/admin/training/courses/${encodeURIComponent(cid)}?c=${icp}&ok=${encodeURIComponent("已建立課程，請補齊日期與內容")}`);
    });

    // ============================================================
    //  課程紀錄 ＋ 簽到 ＋ 滿意度 ＋ 成效評估
    // ============================================================
    router.get("/training/courses", async (req, res) => {
        const icp = icpOf(req);
        const courses = await db.prepare("SELECT * FROM training_course WHERE icpno = ? ORDER BY (course_date IS NULL), course_date DESC, created_at DESC").all(icp);
        const catOpt = (v) => CATS.map((c) => `<option value="${c}" ${v === c ? "selected" : ""}>${c}</option>`).join("");
        const rows = courses.map((c) => `
          <tr>
            <td class="mono" style="white-space:nowrap;">${esc(c.course_date || "—")}</td>
            <td><a href="/admin/training/courses/${encodeURIComponent(c.id)}?c=${icp}"><b>${esc(c.title)}</b></a></td>
            <td>${esc(c.category || "")}</td>
            <td>${esc(c.instructor || "")}</td>
            <td style="text-align:right;">${c.hours != null ? esc(c.hours) : ""}</td>
            <td>${c.status === "done" ? '<span class="sf-pill ok">已辦</span>' : '<span class="sf-pill">規劃</span>'}</td>
            <td style="white-space:nowrap;"><a href="/admin/training/courses/${encodeURIComponent(c.id)}?c=${icp}">明細</a>
              | ${delBtn(`/admin/training/courses/${encodeURIComponent(c.id)}/delete?c=${icp}`, "刪除此課程及其簽到／滿意度／成效？")}</td>
          </tr>`).join("");
        const inner = `
        ${msgBar(req)}
        <div class="notion-card" style="margin-bottom:16px;">
          <h2 style="margin-top:0;">新增課程紀錄</h2>
          <form method="post" action="/admin/training/courses/save">
            <input type="hidden" name="c" value="${icp}">
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
              <label style="flex:1;min-width:200px;">題目 * <input type="text" name="title" required></label>
              <label style="width:150px;">日期 <input type="date" name="course_date"></label>
              <label style="width:100px;">類別 <select name="category">${catOpt("訓練")}</select></label>
              <label style="width:100px;">時數 <input type="number" step="0.5" name="hours"></label>
              <button type="submit" class="btn btn-primary">建立</button>
            </div>
            <label style="margin-top:8px;display:block;">講師 <input type="text" name="instructor" style="max-width:260px;"></label>
          </form>
        </div>
        <div class="notion-card">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
            <h2 style="margin:0;">${esc(erp.erpCompanyName(icp))} 課程紀錄</h2>
            <a href="/admin/training/courses/export.csv?c=${icp}" class="btn" style="margin-left:auto;">CSV 匯出</a>
          </div>
          <table>
            <thead><tr><th>日期</th><th>題目</th><th>類別</th><th>講師</th><th style="text-align:right;">時數</th><th>狀態</th><th>操作</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="7">尚無課程紀錄。可從年度計畫「轉為課程」或於上方新增。</td></tr>`}</tbody>
          </table>
        </div>`;
        page(res, "課程紀錄", "tr-courses", "courses", icp, inner);
    });
    router.post("/training/courses/save", urlenc, async (req, res) => {
        const icp = icpOf(req);
        const id = (req.body.id || "").trim();
        const title = (req.body.title || "").trim();
        if (!title) { res.redirect(`/admin/training/courses?c=${icp}&err=${encodeURIComponent("題目必填")}`); return; }
        const v = {
            title,
            category: CATS.includes(req.body.category) ? req.body.category : "訓練",
            course_date: (req.body.course_date || "").trim() || null,
            start_time: (req.body.start_time || "").trim() || null,
            end_time: (req.body.end_time || "").trim() || null,
            hours: num(req.body.hours),
            instructor: (req.body.instructor || "").trim() || null,
            instructor_type: SRC.includes(req.body.instructor_type) ? req.body.instructor_type : null,
            location: (req.body.location || "").trim() || null,
            target_audience: (req.body.target_audience || "").trim() || null,
            objective: (req.body.objective || "").trim() || null,
            summary: (req.body.summary || "").trim() || null,
            cost: num(req.body.cost),
            handler: (req.body.handler || "").trim() || null,
            confirmed_by: (req.body.confirmed_by || "").trim() || null,
            status: req.body.status === "done" ? "done" : "planned",
        };
        if (id) {
            await db.prepare(`UPDATE training_course SET title=?, category=?, course_date=?, start_time=?, end_time=?, hours=?, instructor=?, instructor_type=?, location=?, target_audience=?, objective=?, summary=?, cost=?, handler=?, confirmed_by=?, status=?, updated_at=? WHERE id=?`)
                .run(v.title, v.category, v.course_date, v.start_time, v.end_time, v.hours, v.instructor, v.instructor_type, v.location, v.target_audience, v.objective, v.summary, v.cost, v.handler, v.confirmed_by, v.status, nowIso(), id);
            // 同步計畫項目狀態
            if (v.status === "done") await db.prepare("UPDATE training_plan_item SET status='done' WHERE course_id = ?").run(id);
            res.redirect(`/admin/training/courses/${encodeURIComponent(id)}?c=${icp}&ok=1`);
        } else {
            const nid = newId("tcourse");
            await db.prepare(`INSERT INTO training_course (id, icpno, title, category, course_date, start_time, end_time, hours, instructor, instructor_type, location, target_audience, objective, summary, cost, handler, confirmed_by, status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
                .run(nid, icp, v.title, v.category, v.course_date, v.start_time, v.end_time, v.hours, v.instructor, v.instructor_type, v.location, v.target_audience, v.objective, v.summary, v.cost, v.handler, v.confirmed_by, v.status, actorOf(req) || null, nowIso(), nowIso());
            res.redirect(`/admin/training/courses/${encodeURIComponent(nid)}?c=${icp}&ok=1`);
        }
    });
    router.post("/training/courses/:id/delete", urlenc, async (req, res) => {
        const icp = icpOf(req);
        const cid = req.params.id;
        const before = await db.prepare("SELECT * FROM training_course WHERE id = ?").get(cid);
        const attN = (await db.prepare("SELECT COUNT(*) n FROM training_attendance WHERE course_id = ?").get(cid))?.n || 0;
        const svyN = (await db.prepare("SELECT COUNT(*) n FROM training_survey WHERE course_id = ?").get(cid))?.n || 0;
        const doDel = async (h) => {
            await h.prepare("DELETE FROM training_attendance WHERE course_id = ?").run(cid);
            await h.prepare("DELETE FROM training_survey WHERE course_id = ?").run(cid);
            await h.prepare("DELETE FROM training_outcome WHERE course_id = ?").run(cid);
            await h.prepare("UPDATE training_plan_item SET course_id = NULL WHERE course_id = ?").run(cid);
            await h.prepare("DELETE FROM training_course WHERE id = ?").run(cid);
        };
        if (typeof db.transaction === "function") await db.transaction(doDel); else await doDel(db);
        await auditDelete(req, "training_course", cid, `刪除課程 ${before?.title || cid}（連同簽到 ${attN} 筆、問卷 ${svyN} 份、成效評估）`, before || null);
        res.redirect(`/admin/training/courses?c=${icp}&ok=${encodeURIComponent("已刪除")}`);
    });
    // 課程紀錄 CSV（該公司全部）— 必須在 :id 之前註冊，否則會被 /training/courses/:id 攔截
    router.get("/training/courses/export.csv", async (req, res) => {
        const icp = icpOf(req);
        const courses = await db.prepare("SELECT * FROM training_course WHERE icpno = ? ORDER BY (course_date IS NULL), course_date DESC, created_at DESC").all(icp);
        const rows = [["日期", "題目", "類別", "講師", "內外部", "地點", "時數", "對象", "課程概要", "經辦者", "確認", "狀態", "簽到人數", "滿意度平均"]];
        for (const c of courses) {
            const cnt = (await db.prepare("SELECT COUNT(*) n FROM training_attendance WHERE course_id = ? AND signed = 1").get(c.id)).n || 0;
            const svg = await db.prepare("SELECT AVG(overall_score) a, COUNT(overall_score) n FROM training_survey WHERE course_id = ?").get(c.id);
            const avg = svg && svg.n ? Number(svg.a).toFixed(1) : "";
            rows.push([c.course_date, c.title, c.category, c.instructor, c.instructor_type, c.location, c.hours, c.target_audience, c.summary, c.handler, c.confirmed_by, c.status === "done" ? "已辦" : "規劃", cnt, avg]);
        }
        sendCsv(res, `${erp.erpCompanyName(icp)}_課程紀錄.csv`, rows);
    });
    router.get("/training/courses/:id", async (req, res) => {
        const icp = icpOf(req);
        const c = await db.prepare("SELECT * FROM training_course WHERE id = ?").get(req.params.id);
        if (!c) { res.redirect(`/admin/training/courses?c=${icp}&err=${encodeURIComponent("找不到課程")}`); return; }
        const cIcp = erp.normIcpno(c.icpno);
        const emps = await db.prepare("SELECT * FROM training_employee WHERE icpno = ? AND status = 'active' ORDER BY sort_order, name").all(cIcp);
        const atts = await db.prepare("SELECT * FROM training_attendance WHERE course_id = ? ORDER BY created_at").all(c.id);
        const attByEmp = {}; const adhoc = [];
        atts.forEach((a) => { if (a.employee_id) attByEmp[a.employee_id] = a; else adhoc.push(a); });
        const surveys = await db.prepare("SELECT * FROM training_survey WHERE course_id = ? ORDER BY created_at DESC").all(c.id);
        const outcome = (await db.prepare("SELECT * FROM training_outcome WHERE course_id = ?").get(c.id)) || {};
        // 滿意度平均
        const avgOf = (k) => { const xs = surveys.map((s) => Number(s[k])).filter((n) => Number.isFinite(n) && n > 0); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; };
        const nOverall = surveys.filter((s) => Number.isFinite(Number(s.overall_score)) && Number(s.overall_score) > 0).length;
        const catOpt = (v) => CATS.map((x) => `<option value="${x}" ${v === x ? "selected" : ""}>${x}</option>`).join("");
        const srcOpt = (v) => `<option value="">—</option>` + SRC.map((x) => `<option value="${x}" ${v === x ? "selected" : ""}>${x}</option>`).join("");
        const signedCount = atts.filter((a) => a.signed).length;

        const empChecks = emps.map((e) => {
            const a = attByEmp[e.id];
            return `<label style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:var(--hairline);border-radius:8px;margin:0 8px 8px 0;${a && a.signed ? "background:var(--accent-soft);border-color:var(--accent-line);" : ""}">
              <input type="checkbox" name="emp" value="${att(e.id)}" ${a && a.signed ? "checked" : ""}>
              <span>${esc(e.name)}${e.dept ? `<span style="color:var(--txt-3);font-size:12px;">・${esc(e.dept)}</span>` : ""}</span></label>`;
        }).join("");
        const adhocList = adhoc.length ? `<div style="margin-top:8px;color:var(--txt-3);font-size:12.5px;">名冊外簽到：${adhoc.map((a) => esc(a.name || "?")).join("、")}</div>` : "";
        const surveyRows = surveys.map((s) => `
          <tr>
            <td>${esc(s.respondent || "匿名")}</td>
            <td style="text-align:center;">${s.content_score || "—"}</td>
            <td style="text-align:center;">${s.instructor_score || "—"}</td>
            <td style="text-align:center;">${s.useful_score || "—"}</td>
            <td style="text-align:center;"><b>${s.overall_score || "—"}</b></td>
            <td>${esc(s.comment || "")}</td>
            <td>${delBtn(`/admin/training/courses/survey/${encodeURIComponent(s.id)}/delete?c=${icp}&course=${encodeURIComponent(c.id)}`, "刪除此份問卷？")}</td>
          </tr>`).join("");
        const scoreSel = (name) => `<select name="${name}"><option value="">—</option>${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${n}</option>`).join("")}</select>`;

        const inner = `
        ${msgBar(req)}
        <div class="notion-card" style="margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <h2 style="margin:0;">課程紀錄表</h2>
            ${c.status === "done" ? '<span class="sf-pill ok">已辦理</span>' : '<span class="sf-pill">規劃中</span>'}
            ${c.plan_item_id ? '<span class="sf-pill info">來自年度計畫</span>' : ""}
            <span style="margin-left:auto;"></span>
            <a href="/admin/training/courses/${encodeURIComponent(c.id)}/print?c=${icp}" target="_blank" class="btn">列印紀錄表</a>
            <a href="/admin/training/courses/${encodeURIComponent(c.id)}/sign-sheet?c=${icp}" target="_blank" class="btn">列印簽到表</a>
          </div>
          <form method="post" action="/admin/training/courses/save" style="margin-top:12px;">
            <input type="hidden" name="c" value="${icp}"><input type="hidden" name="id" value="${att(c.id)}">
            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
              <label style="flex:1;min-width:220px;">題目 * <input type="text" name="title" required value="${att(c.title)}"></label>
              <label style="width:100px;">類別 <select name="category">${catOpt(c.category)}</select></label>
              <label style="width:150px;">日期 <input type="date" name="course_date" value="${att(c.course_date)}"></label>
              <label style="width:110px;">開始 <input type="time" name="start_time" value="${att(c.start_time)}"></label>
              <label style="width:110px;">結束 <input type="time" name="end_time" value="${att(c.end_time)}"></label>
              <label style="width:100px;">時數 <input type="number" step="0.5" name="hours" value="${c.hours != null ? att(c.hours) : ""}"></label>
            </div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-top:8px;">
              <label style="flex:1;min-width:160px;">講師 <input type="text" name="instructor" value="${att(c.instructor)}"></label>
              <label style="width:120px;">內外部 <select name="instructor_type">${srcOpt(c.instructor_type)}</select></label>
              <label style="flex:1;min-width:160px;">地點 <input type="text" name="location" value="${att(c.location)}"></label>
              <label style="width:110px;">費用 <input type="number" step="1" name="cost" value="${c.cost != null ? att(c.cost) : ""}"></label>
              <label style="width:130px;">狀態 <select name="status"><option value="planned" ${c.status !== "done" ? "selected" : ""}>規劃中</option><option value="done" ${c.status === "done" ? "selected" : ""}>已辦理</option></select></label>
            </div>
            <label style="margin-top:8px;display:block;">預計對象（ADDIE：分析）<input type="text" name="target_audience" value="${att(c.target_audience)}"></label>
            <label style="margin-top:8px;display:block;">課程目標 <input type="text" name="objective" value="${att(c.objective)}"></label>
            <label style="margin-top:8px;display:block;">課程概要 <textarea name="summary" rows="3">${esc(c.summary)}</textarea></label>
            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-top:8px;">
              <label style="flex:1;min-width:160px;">經辦者 <input type="text" name="handler" value="${att(c.handler)}"></label>
              <label style="flex:1;min-width:160px;">確認（主管）<input type="text" name="confirmed_by" value="${att(c.confirmed_by)}"></label>
            </div>
            <p style="margin-top:14px;"><button type="submit" class="btn btn-primary">儲存課程</button>
              <a href="/admin/training/courses?c=${icp}" class="btn">回列表</a></p>
          </form>
        </div>

        <div class="notion-card" style="margin-bottom:16px;">
          <h2 style="margin-top:0;">簽到（參加人員）　<span style="color:var(--txt-3);font-size:13px;font-weight:400;">已簽到 ${signedCount} 人</span></h2>
          <p style="color:var(--txt-3);font-size:12.5px;margin-top:0;">勾選 ${esc(erp.erpCompanyName(cIcp))} 名冊中的參加人員，儲存即為本場簽到；未列名者可到「員工名冊」新增。</p>
          <form method="post" action="/admin/training/courses/${encodeURIComponent(c.id)}/attendance/save">
            <input type="hidden" name="c" value="${icp}">
            <div>${empChecks || `<span style="color:var(--txt-3);">此公司名冊尚無在職員工，請先到「員工名冊」建立。</span>`}</div>
            ${adhocList}
            <p style="margin-top:10px;"><button type="submit" class="btn btn-primary">儲存簽到</button></p>
          </form>
        </div>

        <div class="notion-card" style="margin-bottom:16px;">
          <h2 style="margin-top:0;">滿意度調查</h2>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
            <span class="sf-pill">課程內容 ${avgOf("content_score") ? avgOf("content_score").toFixed(1) : "—"}</span>
            <span class="sf-pill">講師 ${avgOf("instructor_score") ? avgOf("instructor_score").toFixed(1) : "—"}</span>
            <span class="sf-pill">實用性 ${avgOf("useful_score") ? avgOf("useful_score").toFixed(1) : "—"}</span>
            <span>整體：${scoreBadge(avgOf("overall_score"), nOverall)}</span>
          </div>
          <form method="post" action="/admin/training/courses/${encodeURIComponent(c.id)}/survey/add" style="margin-bottom:12px;">
            <input type="hidden" name="c" value="${icp}">
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
              <label style="width:150px;">填寫人 <input type="text" name="respondent" placeholder="可留空(匿名)"></label>
              <label style="width:110px;">課程內容 ${scoreSel("content_score")}</label>
              <label style="width:90px;">講師 ${scoreSel("instructor_score")}</label>
              <label style="width:100px;">實用性 ${scoreSel("useful_score")}</label>
              <label style="width:110px;">整體滿意 ${scoreSel("overall_score")}</label>
              <button type="submit" class="btn btn-primary">新增問卷</button>
            </div>
            <label style="margin-top:8px;display:block;">建議 <input type="text" name="comment"></label>
          </form>
          <table>
            <thead><tr><th>填寫人</th><th>內容</th><th>講師</th><th>實用</th><th>整體</th><th>建議</th><th></th></tr></thead>
            <tbody>${surveyRows || `<tr><td colspan="7">尚無問卷。</td></tr>`}</tbody>
          </table>
        </div>

        <div class="notion-card">
          <h2 style="margin-top:0;">成效評估（PDDRO：Review／Outcome）</h2>
          <p style="color:var(--txt-3);font-size:12.5px;margin-top:0;">四層次：反應（滿意度）、學習（測驗）、行為（工作應用）、成果（對組織效益）。</p>
          <form method="post" action="/admin/training/courses/${encodeURIComponent(c.id)}/outcome/save">
            <input type="hidden" name="c" value="${icp}">
            <div style="display:flex;gap:16px;flex-wrap:wrap;">
              <label style="flex:1;min-width:240px;">L1 反應 <textarea name="reaction" rows="2">${esc(outcome.reaction)}</textarea></label>
              <label style="flex:1;min-width:240px;">L2 學習（測驗/評量結果）<textarea name="learning" rows="2">${esc(outcome.learning)}</textarea></label>
            </div>
            <div style="display:flex;gap:16px;flex-wrap:wrap;">
              <label style="flex:1;min-width:240px;">L3 行為（工作應用）<textarea name="behavior" rows="2">${esc(outcome.behavior)}</textarea></label>
              <label style="flex:1;min-width:240px;">L4 成果（組織效益）<textarea name="result" rows="2">${esc(outcome.result)}</textarea></label>
            </div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
              <label style="flex:1;min-width:180px;">評估方式 <input type="text" name="eval_method" value="${att(outcome.eval_method)}"></label>
              <label style="width:150px;">成效評分 <input type="text" name="eval_score" value="${att(outcome.eval_score)}"></label>
              <label style="flex:1;min-width:180px;">佐證連結 <input type="text" name="evidence_url" value="${att(outcome.evidence_url)}"></label>
            </div>
            <label style="margin-top:8px;display:block;">綜合說明 <textarea name="effectiveness_note" rows="2">${esc(outcome.effectiveness_note)}</textarea></label>
            <p style="margin-top:6px;color:var(--txt-3);font-size:12px;">最後評估：${esc(outcome.evaluated_at || "—")}${outcome.evaluated_by ? "　" + esc(outcome.evaluated_by) : ""}</p>
            <button type="submit" class="btn btn-primary">儲存成效評估</button>
          </form>
        </div>`;
        page(res, c.title, "tr-courses", "courses", icp, inner);
    });
    router.post("/training/courses/:id/attendance/save", urlenc, async (req, res) => {
        const icp = icpOf(req);
        const cid = req.params.id;
        const c = await db.prepare("SELECT * FROM training_course WHERE id = ?").get(cid);
        if (!c) { res.redirect(`/admin/training/courses?c=${icp}&err=${encodeURIComponent("找不到課程")}`); return; }
        let picked = req.body.emp || [];
        if (!Array.isArray(picked)) picked = [picked];
        picked = picked.filter(Boolean);
        const courseHours = c.hours != null ? Number(c.hours) : null;
        const doSave = async (h) => {
            // 只重建「名冊內」簽到，保留名冊外(adhoc)紀錄
            await h.prepare("DELETE FROM training_attendance WHERE course_id = ? AND employee_id IS NOT NULL").run(cid);
            for (const eid of picked) {
                const e = await h.prepare("SELECT name, dept FROM training_employee WHERE id = ?").get(eid);
                await h.prepare("INSERT INTO training_attendance (id, course_id, employee_id, name, dept, signed, hours, created_at) VALUES (?,?,?,?,?,?,?,?)")
                    .run(newId("tatt"), cid, eid, e ? e.name : null, e ? e.dept : null, 1, courseHours, nowIso());
            }
        };
        if (typeof db.transaction === "function") await db.transaction(doSave); else await doSave(db);
        res.redirect(`/admin/training/courses/${encodeURIComponent(cid)}?c=${icp}&ok=${encodeURIComponent("已儲存簽到 " + picked.length + " 人")}`);
    });
    router.post("/training/courses/:id/survey/add", urlenc, async (req, res) => {
        const icp = icpOf(req);
        const cid = req.params.id;
        const sc = (k) => { const n = intOr(req.body[k], 0); return n >= 1 && n <= 5 ? n : null; };
        await db.prepare("INSERT INTO training_survey (id, course_id, respondent, content_score, instructor_score, useful_score, overall_score, comment, created_at) VALUES (?,?,?,?,?,?,?,?,?)")
            .run(newId("tsvy"), cid, (req.body.respondent || "").trim() || null, sc("content_score"), sc("instructor_score"), sc("useful_score"), sc("overall_score"), (req.body.comment || "").trim() || null, nowIso());
        res.redirect(`/admin/training/courses/${encodeURIComponent(cid)}?c=${icp}&ok=1`);
    });
    router.post("/training/courses/survey/:id/delete", urlenc, async (req, res) => {
        const icp = icpOf(req);
        const courseId = (req.query.course || "").trim();
        const before = await db.prepare("SELECT * FROM training_survey WHERE id = ?").get(req.params.id);
        await db.prepare("DELETE FROM training_survey WHERE id = ?").run(req.params.id);
        await auditDelete(req, "training_survey", req.params.id, `刪除滿意度問卷（${before?.respondent || "匿名"}）`, before || null);
        res.redirect(`/admin/training/courses/${encodeURIComponent(courseId)}?c=${icp}&ok=${encodeURIComponent("已刪除")}`);
    });
    router.post("/training/courses/:id/outcome/save", urlenc, async (req, res) => {
        const icp = icpOf(req);
        const cid = req.params.id;
        const b = req.body, g = (k) => (b[k] || "").trim() || null;
        const exists = await db.prepare("SELECT course_id FROM training_outcome WHERE course_id = ?").get(cid);
        const vals = [g("reaction"), g("learning"), g("behavior"), g("result"), g("eval_method"), g("eval_score"), g("effectiveness_note"), g("evidence_url"), actorOf(req) || null, nowIso(), nowIso()];
        if (exists) {
            await db.prepare("UPDATE training_outcome SET reaction=?, learning=?, behavior=?, result=?, eval_method=?, eval_score=?, effectiveness_note=?, evidence_url=?, evaluated_by=?, evaluated_at=?, updated_at=? WHERE course_id=?").run(...vals, cid);
        } else {
            await db.prepare("INSERT INTO training_outcome (reaction, learning, behavior, result, eval_method, eval_score, effectiveness_note, evidence_url, evaluated_by, evaluated_at, updated_at, course_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(...vals, cid);
        }
        res.redirect(`/admin/training/courses/${encodeURIComponent(cid)}?c=${icp}&ok=1`);
    });

    // ============================================================
    //  列印（對齊原紙本表單）＋ CSV 匯出
    // ============================================================
    // 乾淨可列印的獨立頁（不套後台 shell）；螢幕上方有「列印」鈕，列印時自動隱藏。
    function printShell(title, inner) {
        return `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>${esc(title)}</title>
        <style>
          *{box-sizing:border-box;}
          body{font-family:"Microsoft JhengHei","PingFang TC",ui-sans-serif,system-ui,"Noto Sans TC",sans-serif;color:#111;margin:0;padding:24px;background:#f4f4f4;}
          .sheet{max-width:800px;margin:0 auto;background:#fff;padding:32px 36px;box-shadow:0 2px 12px rgba(0,0,0,.1);}
          h1{text-align:center;font-size:20px;margin:0 0 4px;}
          h2{text-align:center;font-size:15px;font-weight:400;color:#333;margin:0 0 18px;}
          table{width:100%;border-collapse:collapse;margin:0 0 14px;}
          th,td{border:1px solid #333;padding:7px 9px;font-size:13.5px;vertical-align:top;line-height:1.5;}
          th{background:#f0f0f0;font-weight:600;white-space:nowrap;text-align:center;}
          .lbl{background:#f0f0f0;font-weight:600;white-space:nowrap;width:96px;text-align:center;}
          .sign-cell{height:44px;}
          .toolbar{max-width:800px;margin:0 auto 14px;text-align:right;}
          .toolbar button{font-size:14px;padding:8px 18px;border:1px solid #2383e2;background:#2383e2;color:#fff;border-radius:6px;cursor:pointer;}
          .muted{color:#666;font-size:12px;text-align:center;margin-top:10px;}
          @media print{ body{background:#fff;padding:0;} .sheet{box-shadow:none;max-width:none;padding:8px;} .toolbar{display:none;} }
        </style></head><body>
        <div class="toolbar"><button onclick="window.print()">列印 / 存成 PDF</button></div>
        <div class="sheet">${inner}</div>
        </body></html>`;
    }
    // CSV：Excel 相容（UTF-8 BOM），欄位含逗號/引號/換行時以引號包起並跳脫。
    function csvCell(v) { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
    function sendCsv(res, filename, rows) {
        const body = "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.send(body);
    }

    // 年度教育訓練計畫表（列印）
    router.get("/training/plans/:id/print", async (req, res) => {
        const icp = icpOf(req);
        const plan = await db.prepare("SELECT * FROM training_plan WHERE id = ?").get(req.params.id);
        if (!plan) { res.status(404).send("找不到計畫"); return; }
        const items = await db.prepare("SELECT * FROM training_plan_item WHERE plan_id = ? ORDER BY sort_order, CAST(month AS INTEGER), month").all(plan.id);
        const rowsHtml = items.length ? items.map((i) => `
          <tr>
            <td style="text-align:center;white-space:nowrap;">${esc(i.month || "")}</td>
            <td>${esc(i.theme || "")}</td>
            <td style="text-align:center;">${esc(i.category || "")}</td>
            <td>${esc(i.instructor || "")}${i.instructor_type ? `（${esc(i.instructor_type)}）` : ""}</td>
            <td style="text-align:center;">${esc(i.location || "")}</td>
            <td style="text-align:center;">${i.planned_hours != null ? esc(i.planned_hours) : ""}</td>
          </tr>`).join("") : `<tr><td colspan="6" style="text-align:center;color:#666;">（尚無排定項目）</td></tr>`;
        const inner = `
          <h1>${esc(erp.erpCompanyName(icp))}</h1>
          <h2>員工年度教育訓練計畫表　${esc(plan.year)} 年度${plan.title ? "　" + esc(plan.title) : ""}</h2>
          ${plan.goal ? `<table><tr><td class="lbl">年度目標</td><td>${esc(plan.goal)}</td></tr></table>` : ""}
          <table>
            <thead><tr><th style="width:64px;">月份</th><th>主題</th><th style="width:64px;">類別</th><th style="width:150px;">講師</th><th style="width:120px;">地點</th><th style="width:56px;">時數</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <table><tr><td class="lbl">承辦</td><td style="width:180px;"></td><td class="lbl">主管</td><td style="width:180px;"></td></tr></table>
          <p class="muted">列印日期：${esc(nowIso().slice(0, 10))}</p>`;
        res.type("text/html").send(printShell(`${plan.year}年度教育訓練計畫表`, inner));
    });
    // 年度計畫 CSV
    router.get("/training/plans/:id/export.csv", async (req, res) => {
        const plan = await db.prepare("SELECT * FROM training_plan WHERE id = ?").get(req.params.id);
        if (!plan) { res.status(404).send("找不到計畫"); return; }
        const items = await db.prepare("SELECT * FROM training_plan_item WHERE plan_id = ? ORDER BY sort_order, CAST(month AS INTEGER), month").all(plan.id);
        const statusZh = (s) => s === "done" ? "已辦" : s === "canceled" ? "取消" : "未辦";
        const rows = [["月份", "主題", "類別", "講師", "內外部", "地點", "預計時數", "狀態", "備註"]];
        for (const i of items) rows.push([i.month, i.theme, i.category, i.instructor, i.instructor_type, i.location, i.planned_hours, statusZh(i.status), i.note]);
        sendCsv(res, `${erp.erpCompanyName(icpOf(req))}_${plan.year}年度教育訓練計畫.csv`, rows);
    });

    // 課程紀錄表（列印，對齊原「員工教育訓練課程紀錄表」）
    router.get("/training/courses/:id/print", async (req, res) => {
        const c = await db.prepare("SELECT * FROM training_course WHERE id = ?").get(req.params.id);
        if (!c) { res.status(404).send("找不到課程"); return; }
        const cIcp = erp.normIcpno(c.icpno);
        const atts = await db.prepare("SELECT * FROM training_attendance WHERE course_id = ? AND signed = 1 ORDER BY created_at").all(c.id);
        const surveys = await db.prepare("SELECT overall_score FROM training_survey WHERE course_id = ? AND overall_score IS NOT NULL").all(c.id);
        const outcome = (await db.prepare("SELECT * FROM training_outcome WHERE course_id = ?").get(c.id)) || {};
        const svgN = surveys.length;
        const svgAvg = svgN ? (surveys.reduce((s, r) => s + Number(r.overall_score || 0), 0) / svgN).toFixed(1) : "";
        const timeStr = [c.start_time, c.end_time].filter(Boolean).join("～");
        const names = atts.map((a) => esc(a.name || "")).join("、");
        const inner = `
          <h1>${esc(erp.erpCompanyName(cIcp))}</h1>
          <h2>員工教育訓練課程紀錄表</h2>
          <table>
            <tr><td class="lbl">題目</td><td colspan="3">${esc(c.title)}</td></tr>
            <tr><td class="lbl">日期</td><td>${esc(c.course_date || "")}</td><td class="lbl">時間</td><td>${esc(timeStr)}${c.hours != null ? `（${esc(c.hours)} 小時）` : ""}</td></tr>
            <tr><td class="lbl">講師</td><td>${esc(c.instructor || "")}${c.instructor_type ? `（${esc(c.instructor_type)}）` : ""}</td><td class="lbl">地點</td><td>${esc(c.location || "")}</td></tr>
            <tr><td class="lbl">類別</td><td>${esc(c.category || "")}</td><td class="lbl">對象</td><td>${esc(c.target_audience || "")}</td></tr>
            ${c.objective ? `<tr><td class="lbl">課程目標</td><td colspan="3">${esc(c.objective)}</td></tr>` : ""}
            <tr><td class="lbl">課程概要</td><td colspan="3" style="height:90px;">${esc(c.summary || "").replace(/\n/g, "<br>")}</td></tr>
            <tr><td class="lbl">參加人員</td><td colspan="3">${names || "（見簽到表）"}${atts.length ? `　共 ${atts.length} 人` : ""}</td></tr>
            ${(outcome.reaction || outcome.learning || outcome.behavior || outcome.result || svgN) ? `<tr><td class="lbl">成效評估</td><td colspan="3">${[
              svgN ? `滿意度 ${svgAvg}/5（${svgN} 份）` : "",
              outcome.reaction ? `反應：${esc(outcome.reaction)}` : "",
              outcome.learning ? `學習：${esc(outcome.learning)}` : "",
              outcome.behavior ? `行為：${esc(outcome.behavior)}` : "",
              outcome.result ? `成果：${esc(outcome.result)}` : "",
            ].filter(Boolean).join("<br>")}</td></tr>` : ""}
            <tr><td class="lbl">經辦者</td><td>${esc(c.handler || "")}</td><td class="lbl">確認</td><td>${esc(c.confirmed_by || "")}</td></tr>
          </table>
          <p class="muted">列印日期：${esc(nowIso().slice(0, 10))}</p>`;
        res.type("text/html").send(printShell(`課程紀錄表-${c.title}`, inner));
    });
    // 簽到表（列印，含簽名欄）
    router.get("/training/courses/:id/sign-sheet", async (req, res) => {
        const c = await db.prepare("SELECT * FROM training_course WHERE id = ?").get(req.params.id);
        if (!c) { res.status(404).send("找不到課程"); return; }
        const cIcp = erp.normIcpno(c.icpno);
        // 已簽到者在前；其餘在職員工列出供現場補簽
        const signed = await db.prepare("SELECT employee_id, name, dept FROM training_attendance WHERE course_id = ? AND signed = 1 ORDER BY created_at").all(c.id);
        const signedIds = new Set(signed.filter((s) => s.employee_id).map((s) => s.employee_id));
        const roster = await db.prepare("SELECT id, name, dept FROM training_employee WHERE icpno = ? AND status = 'active' ORDER BY sort_order, name").all(cIcp);
        const extra = roster.filter((e) => !signedIds.has(e.id));
        const people = [...signed.map((s) => ({ name: s.name, dept: s.dept, pre: true })), ...extra.map((e) => ({ name: e.name, dept: e.dept, pre: false }))];
        const bodyRows = (people.length ? people : [{ name: "", dept: "" }]).map((p, i) => `
          <tr>
            <td style="text-align:center;width:40px;">${i + 1}</td>
            <td style="width:150px;">${esc(p.name || "")}</td>
            <td style="width:120px;">${esc(p.dept || "")}</td>
            <td class="sign-cell"></td>
          </tr>`).join("");
        // 額外空白列供臨時人員簽名
        const blanks = Array.from({ length: 5 }, (_, i) => `
          <tr><td style="text-align:center;">${people.length + i + 1}</td><td></td><td></td><td class="sign-cell"></td></tr>`).join("");
        const timeStr = [c.start_time, c.end_time].filter(Boolean).join("～");
        const inner = `
          <h1>${esc(erp.erpCompanyName(cIcp))}</h1>
          <h2>教育訓練簽到表</h2>
          <table>
            <tr><td class="lbl">題目</td><td colspan="3">${esc(c.title)}</td></tr>
            <tr><td class="lbl">日期</td><td>${esc(c.course_date || "")}</td><td class="lbl">時間</td><td>${esc(timeStr)}</td></tr>
            <tr><td class="lbl">講師</td><td>${esc(c.instructor || "")}</td><td class="lbl">地點</td><td>${esc(c.location || "")}</td></tr>
          </table>
          <table>
            <thead><tr><th style="width:40px;">#</th><th>姓名</th><th>部門</th><th>簽名</th></tr></thead>
            <tbody>${bodyRows}${blanks}</tbody>
          </table>
          <p class="muted">列印日期：${esc(nowIso().slice(0, 10))}　　（名冊 ${roster.length} 人；已預簽到 ${signed.length} 人）</p>`;
        res.type("text/html").send(printShell(`簽到表-${c.title}`, inner));
    });
}
