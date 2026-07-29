"use strict";
/**
 * Smoke test：單實例守衛（盤查 §五 F2）。
 * max-instances=1 是本系統的不變式（收單 session／告警去重／登入節流都在記憶體），
 * 過去只存在 Cloud Run Console，誤改零徵兆。這裡驗執行期偵測真的會叫。
 *
 * 跑法：npm test。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-iguard-"));
process.env.DB_PATH = path.join(TMP, "ig.db");
delete process.env.DATABASE_URL;

const { initDb, getDb } = require("../dist/db/index.js");
const guard = require("../dist/lib/instance-guard.js");

let db;
test.before(async () => {
    await initDb(process.env.DB_PATH);
    db = getDb(process.env.DB_PATH);
});
test.after(() => { guard.stopInstanceGuard(); });

test("心跳可重複寫入（同 instance 走 ON CONFLICT 更新，不會重複列）", async () => {
    assert.equal(await guard.heartbeat(db), true);
    assert.equal(await guard.heartbeat(db), true);
    const row = await db.prepare("SELECT COUNT(*) AS n FROM app_instance_heartbeat WHERE instance_id = ?").get(guard.getInstanceId());
    assert.equal(Number(row.n), 1, "同一實例只應有一列");
});

test("只有自己在跑時：不算多實例", async () => {
    const r = await guard.detectMultiInstance(db);
    assert.equal(r.multi, false, "單實例不應告警");
    assert.equal(r.others.length, 0);
});

test("出現另一個實例的新鮮心跳 → 判定多實例", async () => {
    const now = new Date().toISOString();
    await db.prepare("INSERT INTO app_instance_heartbeat (instance_id, revision, first_seen, last_seen) VALUES (?, ?, ?, ?)")
        .run("other-instance-1", "rev-abc", now, now);
    const r = await guard.detectMultiInstance(db);
    assert.equal(r.multi, true, "另一實例心跳新鮮 → 應判定多實例");
    assert.equal(r.others.length, 1);
    assert.equal(r.others[0].instance_id, "other-instance-1");
});

test("已結束的舊實例（心跳過期）不算多實例——縮容後不誤報", async () => {
    const stale = new Date(Date.now() - 3600 * 1000).toISOString(); // 1 小時前
    await db.prepare("UPDATE app_instance_heartbeat SET last_seen = ? WHERE instance_id = ?").run(stale, "other-instance-1");
    const r = await guard.detectMultiInstance(db);
    assert.equal(r.multi, false, "過期心跳應視為已結束的實例");
});

test("checkOnce 偵測到多實例會走告警路徑（無告警群組時 notifyOps 靜默 no-op、不 throw）", async () => {
    const now = new Date().toISOString();
    await db.prepare("UPDATE app_instance_heartbeat SET last_seen = ? WHERE instance_id = ?").run(now, "other-instance-1");
    const r = await guard.checkOnce(db, { force: true });
    assert.equal(r.multi, true);
    assert.equal(r.alerted, true, "應觸發告警流程");
});

test("pruneHeartbeats 清掉一天前的舊列", async () => {
    const old = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
    await db.prepare("INSERT INTO app_instance_heartbeat (instance_id, revision, first_seen, last_seen) VALUES (?, ?, ?, ?)")
        .run("ancient", "rev-old", old, old);
    await guard.pruneHeartbeats(db);
    const row = await db.prepare("SELECT COUNT(*) AS n FROM app_instance_heartbeat WHERE instance_id = ?").get("ancient");
    assert.equal(Number(row.n), 0, "三天前的心跳應被清掉");
});
