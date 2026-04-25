#!/usr/bin/env node
/**
 * Cloud Run 部署：讀取專案根目錄 .env，產生 env JSON，再 docker build / push / gcloud run deploy。
 *
 * 用法（在 songfu_linebot 目錄）：
 *   npm run deploy
 *
 * 選項：
 *   --keep-env     不覆寫 Cloud Run 環境變數，只更新映像（略過 --env-vars-file）
 *   DEPLOY_KEEP_ENV=1  同上
 *
 * 資料庫：若未設定 DATABASE_URL 但設了 INSTANCE + DB_PASS，會組出 Unix socket 用的
 * DATABASE_URL 並掛上 --add-cloudsql-instances（與舊版 deploy-with-cloudsql.sh 相同）。
 *
 * 注意：使用 --env-vars-file 時，Cloud Run 上該服務的「全部」環境變數會被檔案內容取代；
 * 請確保 .env 已含正式環境所需之所有鍵（金鑰勿 commit）。
 *
 * Secret Manager（推薦）：
 *   在 .env 設定 USE_SECRET_MANAGER=1，並將敏感變數只存於 GCP Secret，
 *   部署時會以 --set-secrets 注入，且不寫入 env JSON。
 *   選填 SECRET_MANAGER_KEYS=a,b,c（預設為下列五個鍵）。
 *   單鍵自訂秘密名稱：SM_SECRET_LINE_CHANNEL_ACCESS_TOKEN=my-secret:latest
 *   說明見 docs/secret-manager-and-line-rotate.md
 */

import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DEFAULT_REGION = "asia-east1";
const DEFAULT_REPO = "linebot";
const DEFAULT_IMAGE = "linebot";
const DEFAULT_SERVICE = "songfu-line-bot";

/** Cloud Run 禁止或不宜手動設定 */
const STRIP_FROM_CLOUD_RUN = new Set([
  "PORT",
  "USE_SECRET_MANAGER",
  "SECRET_MANAGER_KEYS",
]);

/** 環境變數名 → 預設 GCP Secret 資源名（版本用 :latest） */
const SECRET_MANAGER_MAP_DEFAULT = {
  LINE_CHANNEL_ACCESS_TOKEN: "songfu-line-channel-access-token",
  LINE_CHANNEL_SECRET: "songfu-line-channel-secret",
  GOOGLE_GEMINI_API_KEY: "songfu-line-gemini-api-key",
  GOOGLE_CLOUD_VISION_API_KEY: "songfu-line-vision-api-key",
  DATABASE_URL: "songfu-line-database-url",
};

/** 僅用於組 DATABASE_URL，不寫入 Cloud Run */
const STRIP_AFTER_CLOUDSQL_BUILD = new Set([
  "INSTANCE",
  "DB_PASS",
  "DB_NAME",
  "DB_USER",
]);

function encodePasswordForPgUrl(pass) {
  return String(pass)
    .replace(/%/g, "%25")
    .replace(/@/g, "%40")
    .replace(/#/g, "%23")
    .replace(/:/g, "%3A");
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: false,
    ...opts,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

function gcloudProjectId() {
  const r = spawnSync("gcloud", ["config", "get-value", "project"], {
    encoding: "utf8",
    shell: false,
  });
  return (r.stdout || "").trim() || null;
}

/**
 * 將 .env 內容轉成要給 Cloud Run 的扁平字串 map（值皆為字串）
 */
function buildEnvForCloudRun(parsed) {
  const out = { ...parsed };

  for (const k of STRIP_FROM_CLOUD_RUN) {
    delete out[k];
  }

  let addCloudsqlInstance = null;

  if (!out.DATABASE_URL?.trim() && out.INSTANCE?.trim() && out.DB_PASS) {
    const dbName = out.DB_NAME?.trim() || "songfu";
    const dbUser = out.DB_USER?.trim() || "postgres";
    const enc = encodePasswordForPgUrl(out.DB_PASS);
    const inst = out.INSTANCE.trim();
    out.DATABASE_URL = `postgresql://${dbUser}:${enc}@/${dbName}?host=/cloudsql/${inst}`;
    addCloudsqlInstance = inst;
  }

  for (const k of STRIP_AFTER_CLOUDSQL_BUILD) {
    delete out[k];
  }

  const stringMap = {};
  for (const [k, v] of Object.entries(out)) {
    if (v === undefined || v === null) continue;
    stringMap[k] = String(v);
  }
  for (const k of Object.keys(stringMap)) {
    if (k.startsWith("SM_SECRET_")) delete stringMap[k];
  }
  return { stringMap, addCloudsqlInstance };
}

function resolveSecretManagerKeys(merged) {
  const raw = merged.SECRET_MANAGER_KEYS?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return Object.keys(SECRET_MANAGER_MAP_DEFAULT);
}

function buildSecretBindings(secretEnvKeys, merged) {
  const pairs = [];
  for (const envKey of secretEnvKeys) {
    const override = merged[`SM_SECRET_${envKey}`]?.trim();
    let secretRef;
    if (override) {
      secretRef = override.includes(":") ? override : `${override}:latest`;
    } else if (SECRET_MANAGER_MAP_DEFAULT[envKey]) {
      secretRef = `${SECRET_MANAGER_MAP_DEFAULT[envKey]}:latest`;
    } else {
      console.error(
        `錯誤：SECRET_MANAGER_KEYS 含未知鍵「${envKey}」。請在 .env 設定 SM_SECRET_${envKey}=秘密名稱[:版本]`
      );
      process.exit(1);
    }
    pairs.push(`${envKey}=${secretRef}`);
  }
  return pairs.join(",");
}

function main() {
  const argv = process.argv.slice(2);
  const keepEnv =
    argv.includes("--keep-env") || process.env.DEPLOY_KEEP_ENV === "1";

  process.chdir(ROOT);

  if (!fs.existsSync(path.join(ROOT, "package.json"))) {
    console.error("錯誤：請在 songfu_linebot 目錄執行 npm run deploy");
    process.exit(1);
  }
  if (!fs.existsSync(path.join(ROOT, "Dockerfile"))) {
    console.error("錯誤：找不到 Dockerfile");
    process.exit(1);
  }
  if (!fs.existsSync(path.join(ROOT, "dist"))) {
    console.error("錯誤：找不到 dist/，請先產出編譯結果再部署。");
    process.exit(1);
  }

  const envPath = path.join(ROOT, ".env");
  let parsed = {};
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath);
    parsed = dotenv.parse(raw);
    console.log("已讀取 .env");
  } else if (!keepEnv) {
    console.error(
      "錯誤：找不到 .env。請在專案根目錄建立 .env，或使用 npm run deploy -- --keep-env 僅更新映像、保留雲端既有環境變數。"
    );
    process.exit(1);
  }

  const mergedForDeploy = { ...process.env, ...parsed };
  const useSecretManager =
    mergedForDeploy.USE_SECRET_MANAGER === "1" ||
    mergedForDeploy.USE_SECRET_MANAGER === "true";
  const projectId =
    mergedForDeploy.PROJECT_ID?.trim() || gcloudProjectId();
  const region = mergedForDeploy.REGION?.trim() || DEFAULT_REGION;
  const repo = mergedForDeploy.REPO?.trim() || DEFAULT_REPO;
  const imageName = mergedForDeploy.IMAGE?.trim() || DEFAULT_IMAGE;
  const service = mergedForDeploy.SERVICE?.trim() || DEFAULT_SERVICE;

  if (!projectId) {
    console.error("錯誤：請設定 PROJECT_ID（.env 或 gcloud config set project）");
    process.exit(1);
  }

  const imageRef = `${region}-docker.pkg.dev/${projectId}/${repo}/${imageName}:latest`;

  if (keepEnv && useSecretManager) {
    console.warn(
      "提醒：已同時指定 --keep-env 與 USE_SECRET_MANAGER；本次將不更新環境與 Secret 綁定，僅更新映像。"
    );
  }

  console.log("--- Cloud Run 部署（.env → --env-vars-file）---");
  console.log(`專案: ${projectId}  地區: ${region}  服務: ${service}`);
  console.log(`映像: ${imageRef}`);
  console.log("");

  let envFilePath = null;
  let addCloudsqlInstance = null;
  let secretBindings = null;

  if (!keepEnv) {
    const built = buildEnvForCloudRun(parsed);
    addCloudsqlInstance = built.addCloudsqlInstance;

    if (useSecretManager) {
      const secretKeys = resolveSecretManagerKeys(mergedForDeploy);
      for (const k of secretKeys) {
        delete built.stringMap[k];
      }
      secretBindings = buildSecretBindings(secretKeys, mergedForDeploy);
      console.log(
        `Secret Manager：${secretKeys.length} 個變數改由 --set-secrets 注入（已自 env JSON 移除）`
      );
    }

    envFilePath = path.join(
      os.tmpdir(),
      `songfu-cloud-run-env-${Date.now()}.json`
    );
    fs.writeFileSync(envFilePath, JSON.stringify(built.stringMap, null, 0), "utf8");
    console.log(
      `已寫入暫存環境檔（${Object.keys(built.stringMap).length} 個變數）`
    );
    if (addCloudsqlInstance) {
      console.log(`將掛載 Cloud SQL：${addCloudsqlInstance}`);
    }
  } else {
    console.log("已使用 --keep-env：不覆寫 Cloud Run 環境變數");
  }

  try {
    console.log("[1/3] 建置 Docker 映像（linux/amd64）...");
    run("docker", [
      "build",
      "--platform",
      "linux/amd64",
      "-f",
      path.join(ROOT, "Dockerfile"),
      "-t",
      imageRef,
      ROOT,
    ]);

    console.log("");
    console.log("[2/3] 推送映像...");
    run("docker", ["push", imageRef]);

    console.log("");
    console.log("[3/3] 部署到 Cloud Run...");
    const deployArgs = [
      "run",
      "deploy",
      service,
      "--image",
      imageRef,
      "--region",
      region,
      "--platform",
      "managed",
      "--allow-unauthenticated",
    ];
    if (envFilePath) {
      deployArgs.push("--env-vars-file", envFilePath);
    }
    if (secretBindings && !keepEnv) {
      deployArgs.push("--set-secrets", secretBindings);
    }
    if (addCloudsqlInstance) {
      deployArgs.push("--add-cloudsql-instances", addCloudsqlInstance);
    }
    run("gcloud", deployArgs);

    console.log("");
    console.log("--- 部署完成 ---");
  } finally {
    if (envFilePath && fs.existsSync(envFilePath)) {
      try {
        fs.unlinkSync(envFilePath);
      } catch {
        /* ignore */
      }
    }
  }
}

main();
