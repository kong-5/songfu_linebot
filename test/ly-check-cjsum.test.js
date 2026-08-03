// 冒煙測試：scripts/ly_check_cjsum.py（銷貨單 SD_QTY vs CJSUM 對帳）
// 真正的比對邏輯測試寫在 python 腳本自己的 --selftest 裡（那支要跑在內網 Windows，
// 這裡只負責在 CI/本機把它叫起來跑一次）。沒有 python3 的環境自動跳過，不擋 npm test。
const test = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const SCRIPT = path.join(__dirname, "..", "scripts", "ly_check_cjsum.py");

function pythonBin() {
  for (const bin of ["python3", "python"]) {
    const r = spawnSync(bin, ["-V"], { encoding: "utf8" });
    if (!r.error && r.status === 0) return bin;
  }
  return null;
}

test("ly_check_cjsum.py 存在且有 selftest 入口", () => {
  assert.ok(fs.existsSync(SCRIPT), "找不到 scripts/ly_check_cjsum.py");
  const src = fs.readFileSync(SCRIPT, "utf8");
  assert.ok(src.includes("--selftest"), "腳本要保留 --selftest（冒煙測試入口）");
  // 對帳的兩個欄位名是這支腳本的核心，改名要有意識
  assert.ok(src.includes('QTY_FIELD = "SD_QTY"'));
  assert.ok(src.includes('CJ_FIELD = "CJSUM"'));
});

test("ly_check_cjsum.py --selftest 通過（有 python 才跑）", () => {
  const bin = pythonBin();
  if (!bin) {
    console.log("  （這台沒有 python，跳過）");
    return;
  }
  const r = spawnSync(bin, [SCRIPT, "--selftest"], { encoding: "utf8" });
  assert.strictEqual(r.status, 0, `selftest 失敗：\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /selftest 通過/);
});
