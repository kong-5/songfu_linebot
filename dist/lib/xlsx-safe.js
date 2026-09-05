"use strict";
/**
 * xlsx 解析防護（2026-09-01 體檢）
 * ==================================================================
 * 專案用的 `xlsx@0.18.5` 是 SheetJS 在 npm registry 上的最後一版（作者已把發布搬到
 * cdn.sheetjs.com，npm 這個套件名停更），所以同時中兩個已知漏洞：
 *   - CVE-2023-30533  prototype pollution（修在 0.19.3）
 *   - CVE-2024-22363  ReDoS（修在 0.20.2）
 * 兩者都要「解析攻擊者控制的檔案」才會觸發。
 *
 * 實際觸發面只有一處：dist/admin/index.js 的 parseRequestToSheet() 讀使用者上傳的
 * 檔案（5MB 上限、且在 admin 認證之後）。所以這不是未認證 RCE，風險已經被登入擋掉一層。
 * 但 prototype pollution 是 process-wide 的——同一個 process 還在跑 LINE webhook，
 * 一個被釣魚的行政帳號就能污染全域物件。
 *
 * 這裡的作法（精準、不影響正常檔案）：
 *   解析前記下 Object.prototype 的自有屬性，解析後比對；多出來的一律刪掉並丟錯。
 *
 * 為什麼不直接 Object.freeze(Object.prototype)：這是單一 process、同時在服務 LINE
 * webhook 與後台，凍結全域原型會波及所有並行請求，代價比這個漏洞本身還高。
 *
 * 為什麼不換 exceljs：讀取入口只有一個、寫出有四處，整包換掉的改動面與回歸風險
 * 遠大於這層防護。真的要根治是把 xlsx 換成 cdn.sheetjs.com 的 0.20.x，但那會讓
 * npm ci 依賴非 npm registry，Cloud Build 環境要一起調整——留給日後另案處理。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.readWorkbookSafe = readWorkbookSafe;

const XLSX = require("xlsx");

function protoKeys() {
    return new Set(Object.getOwnPropertyNames(Object.prototype));
}

/**
 * 等同 XLSX.read(buffer, {type:"buffer"})，但會偵測並清除解析過程造成的原型污染。
 * @throws 偵測到污染時丟錯（呼叫端應視為「這個檔案有問題」而非系統故障）
 */
function readWorkbookSafe(buffer) {
    const before = protoKeys();
    let wb;
    try {
        wb = XLSX.read(buffer, { type: "buffer" });
    } finally {
        const after = protoKeys();
        const added = [...after].filter((k) => !before.has(k));
        if (added.length) {
            for (const k of added) {
                try { delete Object.prototype[k]; } catch (_) { /* 刪不掉也要往下報錯 */ }
            }
            console.error("[xlsx-safe] ⚠ 偵測到上傳檔案造成原型污染，已清除:", added);
            // eslint-disable-next-line no-unsafe-finally
            throw new Error("這個 Excel 檔含有異常內容（可能是被動過手腳的檔案），已拒絕匯入。請改用另存新檔後的乾淨檔案再試一次。");
        }
    }
    return wb;
}
