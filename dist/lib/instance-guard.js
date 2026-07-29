"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

// 單實例守衛（instance-guard）：偵測「同時有兩個以上實例在跑」並告警。
//
// 為什麼需要：本系統多處刻意採單實例設計——LINE 收單狀態機（collectingByGroup 記憶體 session）、
// ops-notify 去重 Map、登入節流 Map 都在記憶體，Cloud Run **max-instances=1 是不變式**。
// 這個不變式過去只存在 Console 設定裡，誰誤改成 2 都不會有任何徵兆：收單 session 被拆到兩個實例
// → 同一群組的多則訊息各記各的、結單漏品項；告警去重失效 → 群組被洗版。
// cloudbuild 現已明確帶 --max-instances=1（部署層防呆），這裡是執行期的第二道：真的變多實例時會叫。
//
// 做法：每個 process 開機產生一組 instance id，定期寫心跳到 app_instance_heartbeat；
// 若看見「別的 instance id」心跳仍新鮮（預設 3 分鐘內）＝同時有多個實例 → notifyOps 告警。
// 心跳表順帶清掉 1 天前的舊列（避免無限成長）。

const crypto = require("crypto");
const { notifyOps } = require("./ops-notify.js");

/** 心跳視為「新鮮」的秒數：超過這個時間沒更新的實例視為已結束（Cloud Run 縮容不留痕） */
const FRESH_SEC = 180;
/** 心跳間隔：5 分鐘（比 FRESH_SEC 長＝舊實例縮容後不會被誤判成還活著） */
const HEARTBEAT_MS = 5 * 60 * 1000;
/** 同一個 process 最多多久告警一次（notifyOps 本身也有 10 分鐘去重，這裡再壓一層） */
const ALERT_GATE_MS = 30 * 60 * 1000;
/** 心跳保留：超過 1 天的舊列直接刪 */
const PRUNE_SEC = 24 * 60 * 60;

// 每個 process 一組 id；帶上 Cloud Run 的 revision 方便一眼看出是不是「新舊版本並存」
const REVISION = String(process.env.K_REVISION || "").trim();
const INSTANCE_ID = crypto.randomUUID();

let lastAlertAt = 0;
let timer = null;

function getInstanceId() {
    return INSTANCE_ID;
}

function isoNow() {
    return new Date().toISOString();
}
function isoSecondsAgo(sec) {
    return new Date(Date.now() - sec * 1000).toISOString();
}

/**
 * 寫入/更新本實例心跳。永不 throw（守衛壞掉不可影響主服務）。
 */
async function heartbeat(db) {
    try {
        const now = isoNow();
        await db.prepare("INSERT INTO app_instance_heartbeat (instance_id, revision, first_seen, last_seen) VALUES (?, ?, ?, ?) " +
            "ON CONFLICT (instance_id) DO UPDATE SET last_seen = EXCLUDED.last_seen, revision = EXCLUDED.revision").run(INSTANCE_ID, REVISION, now, now);
        return true;
    }
    catch (e) {
        console.error("[instance-guard] 心跳寫入失敗（略過）:", e?.message || e);
        return false;
    }
}

/**
 * 偵測是否有其他實例的心跳仍新鮮。
 * @returns {Promise<{instanceId:string, others:Array<{instance_id:string,revision:string,last_seen:string}>, multi:boolean}>}
 */
async function detectMultiInstance(db, opts) {
    const freshSec = Number(opts?.freshSec) > 0 ? Number(opts.freshSec) : FRESH_SEC;
    try {
        // ISO 字串可直接字典序比大小（同為 UTC、等長格式），毋須各家 DB 的時間函式
        const rows = await db.prepare("SELECT instance_id, revision, last_seen FROM app_instance_heartbeat WHERE instance_id <> ? AND last_seen >= ? ORDER BY last_seen DESC")
            .all(INSTANCE_ID, isoSecondsAgo(freshSec));
        const others = Array.isArray(rows) ? rows : [];
        return { instanceId: INSTANCE_ID, others, multi: others.length > 0 };
    }
    catch (e) {
        console.error("[instance-guard] 偵測失敗（視為單實例）:", e?.message || e);
        return { instanceId: INSTANCE_ID, others: [], multi: false };
    }
}

/** 清掉過期心跳列（避免長期執行無限成長）。永不 throw。 */
async function pruneHeartbeats(db) {
    try {
        await db.prepare("DELETE FROM app_instance_heartbeat WHERE last_seen < ?").run(isoSecondsAgo(PRUNE_SEC));
    }
    catch (_) { /* 清理失敗不影響主流程 */ }
}

/**
 * 一輪檢查：寫心跳 → 偵測 → 需要時告警。永不 throw。
 * @returns {Promise<{multi:boolean, others:number, alerted:boolean}>}
 */
async function checkOnce(db, opts) {
    await heartbeat(db);
    const r = await detectMultiInstance(db, opts);
    if (!r.multi)
        return { multi: false, others: 0, alerted: false };
    const now = Date.now();
    const force = opts?.force === true;
    if (!force && now - lastAlertAt < ALERT_GATE_MS)
        return { multi: true, others: r.others.length, alerted: false };
    lastAlertAt = now;
    const revs = [...new Set(r.others.map((o) => String(o.revision || "?")).concat(REVISION || "?"))].join("、");
    // 錯誤訊息要能照著修（開發守則 4）：講清楚後果與確切的修正動作
    const msg = `偵測到同時有 ${r.others.length + 1} 個服務實例在跑（版本：${revs}）。\n` +
        `本系統的 LINE 收單狀態機／告警去重／登入節流都在記憶體，設計上要求 max-instances=1；` +
        `多實例會造成「同群組多則訊息各記各的、結單漏品項」與告警洗版。\n` +
        `請到 Cloud Run（服務 songfu-line-bot，asia-east1）→ 修訂版本 → 容量，把「執行個體數量上限」改回 1。\n` +
        `（若這是部署切換的短暫重疊，數分鐘後會自動消失、可忽略。）`;
    await notifyOps(db, msg);
    console.warn("[instance-guard] ⚠ 偵測到多實例：本實例 %s，其他 %d 個", INSTANCE_ID, r.others.length);
    return { multi: true, others: r.others.length, alerted: true };
}

/**
 * 啟動守衛：開機立刻檢查一次，之後每 5 分鐘一次。timer 已 unref（不阻止 process 結束）。
 * 重複呼叫只會啟動一次。
 */
function startInstanceGuard(db) {
    if (timer)
        return timer;
    // 開機這一次最重要：第二個實例一啟動就會看到第一個實例的新鮮心跳並告警
    checkOnce(db).catch(() => { });
    pruneHeartbeats(db).catch(() => { });
    timer = setInterval(() => {
        checkOnce(db).catch(() => { });
        pruneHeartbeats(db).catch(() => { });
    }, HEARTBEAT_MS);
    if (typeof timer.unref === "function")
        timer.unref();
    return timer;
}

/** 測試用：停掉背景 timer。 */
function stopInstanceGuard() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    lastAlertAt = 0;
}

exports.getInstanceId = getInstanceId;
exports.heartbeat = heartbeat;
exports.detectMultiInstance = detectMultiInstance;
exports.pruneHeartbeats = pruneHeartbeats;
exports.checkOnce = checkOnce;
exports.startInstanceGuard = startInstanceGuard;
exports.stopInstanceGuard = stopInstanceGuard;
exports.FRESH_SEC = FRESH_SEC;
