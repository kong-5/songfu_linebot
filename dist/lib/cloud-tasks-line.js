"use strict";
/**
 * LINE Webhook → Cloud Tasks：將單一 LINE event 推入佇列，由 Worker HTTP 端點同步處理。
 * 需環境變數：GCP_PROJECT_ID（或 GOOGLE_CLOUD_PROJECT）、GCP_LOCATION、GCP_QUEUE_NAME、WORKER_URL
 * 必要：LINE_WORKER_SECRET（會以 X-Line-Worker-Secret 傳給 Worker；未設定時 Worker 端一律回 503 拒收）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.enqueueLineEventTask = enqueueLineEventTask;
exports.isLineCloudTasksEnabled = isLineCloudTasksEnabled;
const tasks_1 = require("@google-cloud/tasks");
function getProjectId() {
    return (process.env.GCP_PROJECT_ID ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCLOUD_PROJECT ||
        "").trim();
}
function isLineCloudTasksEnabled() {
    return String(process.env.LINE_USE_CLOUD_TASKS || "").trim() === "1";
}
async function enqueueLineEventTask(event) {
    const workerUrl = String(process.env.WORKER_URL || "").trim();
    const project = getProjectId();
    const location = String(process.env.GCP_LOCATION || "asia-east1").trim();
    const queueName = String(process.env.GCP_QUEUE_NAME || "").trim();
    if (!workerUrl)
        throw new Error("WORKER_URL is required when LINE_USE_CLOUD_TASKS=1");
    if (!project)
        throw new Error("GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT is required");
    if (!queueName)
        throw new Error("GCP_QUEUE_NAME is required");
    const client = new tasks_1.CloudTasksClient();
    const parent = client.queuePath(project, location, queueName);
    const body = Buffer.from(JSON.stringify({ event }), "utf8").toString("base64");
    const headers = { "Content-Type": "application/json" };
    const secret = String(process.env.LINE_WORKER_SECRET || "").trim();
    if (secret) {
        headers["X-Line-Worker-Secret"] = secret;
    }
    else {
        // [security] Worker 端未帶 secret 一律回 503 拒收；這裡明確警告，避免佇列任務靜默全數失敗
        console.error("[cloud-tasks] LINE_WORKER_SECRET 未設定：任務仍會入佇列，但 Worker 將拒收（503）並重試到失敗。請設定 LINE_WORKER_SECRET 後重新部署。");
    }
    const task = {
        httpRequest: {
            httpMethod: "POST",
            url: workerUrl,
            headers,
            body,
        },
    };
    await client.createTask({ parent, task });
}
