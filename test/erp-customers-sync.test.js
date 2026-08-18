"use strict";
/**
 * Smoke test：凌越客戶主檔同步（erp_customers）。
 * 對應「隨庫存推送同步客戶主檔到雲端＋後台總表/編輯頁帶入」這條功能：
 *   1. 機器端點 POST /admin/lingyue-writeback/customers-push 的金鑰閘門（無金鑰擋、正確金鑰放行）
 *   2. 按公司(icpno) DELETE+INSERT 覆蓋：重推同公司會換掉舊快照，其他公司不受影響
 *   3. 快照時間/筆數寫進 app_settings
 *   4. 後台「客戶管理 → 凌越客戶主檔」總表可開並列出資料、與網站客戶比對
 *   5. 編輯客戶頁（hq_cust_code＝凌越 CT_NO）會帶出「凌越主檔資料（自動同步，唯讀）」卡
 *   6. 新增客戶頁支援 query 預填（凌越客戶主檔頁「建立客戶」帶過來）
 *
 * 跑法：npm test（node --test test/）。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-erpcust-"));
const SECRET = "test-secret-erpcust";
const WKEY = "test-writeback-key-erpcust";
process.env.DB_PATH = path.join(TMP, "erpcust.db");
process.env.ADMIN_SESSION_SECRET = SECRET;
process.env.LINGYUE_WRITEBACK_KEY = WKEY;
delete process.env.DATABASE_URL;

const express = require("express");
const { initDb, getDb } = require("../dist/db/index.js");
const { createAdminRouter } = require("../dist/admin/index.js");
const { newId } = require("../dist/lib/id.js");

function signSession(username) {
    const exp = Date.now() + 60 * 60 * 1000;
    const payload = Buffer.from(JSON.stringify({ u: username, exp })).toString("base64url");
    const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
    return payload + "." + sig;
}
let server, baseUrl, db;

test.before(async () => {
    await initDb(process.env.DB_PATH);
    db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)")
        .run("admin_users", JSON.stringify([{ username: "opsc", name: "客戶主檔經理", passwordHash: "x:y", title: "經理", status: "active" }]));
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});
test.after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

function pushCustomers(payload, key) {
    return fetch(baseUrl + "/admin/lingyue-writeback/customers-push", {
        method: "POST",
        redirect: "manual",
        headers: Object.assign({ "Content-Type": "application/json" }, key ? { "X-Writeback-Key": key } : {}),
        body: JSON.stringify(payload),
    });
}
async function get(p) {
    const res = await fetch(baseUrl + p, {
        redirect: "manual",
        headers: { cookie: "sf_admin_session=" + signSession("opsc") },
    });
    return { status: res.status, text: await res.text() };
}

test("customers-push 金鑰閘門：無金鑰擋下、錯誤金鑰擋下", async () => {
    const noKey = await pushCustomers({ icpno: "00", customers: [] }, null);
    assert.ok(noKey.status === 401 || noKey.status === 403, "無金鑰應被擋，實得 " + noKey.status);
    const bad = await pushCustomers({ icpno: "00", customers: [] }, "wrong-key");
    assert.ok(bad.status === 401 || bad.status === 403, "錯誤金鑰應被擋，實得 " + bad.status);
});

test("customers-push：正確金鑰寫入 erp_customers＋快照 meta", async () => {
    const res = await pushCustomers({
        icpno: "00",
        snapshot_at: "2026-07-11T09:00:00.000Z",
        customers: [
            { ctno: "C001", name: "松富客戶甲", addr1: "台東市中華路一段1號", tel1: "089-111111", unino: "12345678", fkfs: "月結", sales: "業務A", raw: { CT_NO: "C001", CT_MEMO: "備註保留" } },
            { ctno: "C002", name: "松富客戶乙", addr1: "台東市新生路2號", tel1: "089-222222", stop: "1" },
            { ctno: "", name: "沒有編號的略過" },
        ],
    }, WKEY);
    assert.equal(res.status, 200, "帶正確金鑰應 200");
    const body = JSON.parse(await res.text());
    assert.equal(body.ok, true);
    assert.equal(body.count, 2, "空 ctno 的那筆要被略過，只寫 2 筆");

    const rows = (await db.prepare("SELECT ctno, name, addr1, raw_json, stop FROM erp_customers WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = '00' ORDER BY ctno").all()) || [];
    assert.equal(rows.length, 2);
    assert.equal(rows[0].ctno, "C001");
    assert.equal(rows[0].addr1, "台東市中華路一段1號");
    assert.ok(rows[0].raw_json && JSON.parse(rows[0].raw_json).CT_MEMO === "備註保留", "raw 整筆原始欄位要保留");
    assert.equal(rows[1].stop, "1", "停用旗標要帶上（不過濾）");

    const snap = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("erp_customers_snapshot_at_00");
    assert.equal(String(snap?.value || ""), "2026-07-11T09:00:00.000Z", "快照時間要記入 app_settings");
    const cnt = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("erp_customers_count_00");
    assert.equal(String(cnt?.value || ""), "2");
});

test("customers-push：按公司覆蓋，其他公司互不影響", async () => {
    // 先推松揚(02) 一筆
    await pushCustomers({ icpno: "02", customers: [{ ctno: "S001", name: "松揚客戶" }] }, WKEY);
    // 重推松富(00) 只剩一筆 → 舊 C001/C002 被換掉
    const res = await pushCustomers({ icpno: "00", customers: [{ ctno: "C009", name: "覆蓋後客戶" }] }, WKEY);
    assert.equal(res.status, 200);

    const c00 = (await db.prepare("SELECT ctno FROM erp_customers WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = '00' ORDER BY ctno").all()) || [];
    assert.deepEqual(c00.map((r) => r.ctno), ["C009"], "松富只剩覆蓋後的那筆");
    const c02 = (await db.prepare("SELECT ctno FROM erp_customers WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = '02' ORDER BY ctno").all()) || [];
    assert.deepEqual(c02.map((r) => r.ctno), ["S001"], "松揚公司資料不受松富重推影響");
});

test("後台『凌越客戶主檔』總表可開並列出資料", async () => {
    const r = await get("/admin/customers/erp?icpno=00");
    assert.equal(r.status, 200);
    assert.ok(r.text.includes("凌越客戶主檔"), "頁面標題");
    assert.ok(r.text.includes("覆蓋後客戶"), "應列出當前松富客戶");
    // 未對應網站客戶 → 有「建立客戶」帶預填連結
    assert.ok(r.text.includes("/admin/customers/new?name="), "未對應應提供一鍵建立客戶連結");
});

test("編輯客戶頁：hq_cust_code 對到 CT_NO 時帶出凌越主檔資料卡", async () => {
    const id = newId("cust");
    await db.prepare("INSERT INTO customers (id, name, hq_cust_code) VALUES (?, ?, ?)").run(id, "網站對應客戶", "C009");
    const r = await get("/admin/customers/" + encodeURIComponent(id) + "/edit");
    assert.equal(r.status, 200);
    assert.ok(r.text.includes("凌越主檔資料（自動同步，唯讀）"), "應出現凌越資料卡");
    assert.ok(r.text.includes("覆蓋後客戶"), "卡片應帶出凌越客戶名稱");
});

test("新增客戶頁：支援 query 預填", async () => {
    const r = await get("/admin/customers/new?name=" + encodeURIComponent("新店家") + "&hq_cust_code=C123&contact=" + encodeURIComponent("0912-000000"));
    assert.equal(r.status, 200);
    assert.ok(r.text.includes('value="新店家"'), "名稱應預填");
    assert.ok(r.text.includes('value="C123"'), "凌越編號應預填");
    assert.ok(r.text.includes('value="0912-000000"'), "聯絡方式應預填");
    assert.ok(r.text.includes("已由凌越客戶主檔帶入"), "帶 hq_cust_code 時應顯示提示");
});
