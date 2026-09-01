"use strict";
/**
 * 讓 express router 的 async handler 不會「靜默 hang」或「打掛整個程序」。
 *
 * 背景：這個專案大量使用 async handler，但 express 4 不認識 promise——handler 內
 * 未捕捉的 rejection 在 Node 20 預設會直接終止整個程序（Cloud Run 重啟、所有進行中
 * 的請求一起死），或者請求永遠不回應。
 *
 * 作法：攔截 router 的動詞方法與 use，把每個 handler 包成
 * 「同步 throw → next(e)、回傳的 promise → .catch(next)」，讓錯誤交給
 * dist/index.js 的全域錯誤中介層（回制式 500 頁、不外洩內部細節）。
 *
 * 這段本來只寫在 dist/admin/index.js 裡（2026-07 加的），所以 admin 的裸 handler
 * 有安全網、但 dist/liff/index.js 與 dist/webhook/line.js 沒有——那兩處目前是靠
 * 每個 handler 自己寫 try/catch 撐著，日後有人加一個忘了 try 的 handler 就會 hang。
 * 2026-09-01 體檢抽成共用，三個 router 一起套。
 *
 * 注意：length >= 4 的錯誤中介層 (err, req, res, next) 不能包（包了會被當成一般
 * middleware，錯誤處理就失效）。同步 middleware 不回傳 promise，包了也透明無副作用。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapRouterAsync = wrapRouterAsync;

const VERBS = ["get", "post", "put", "delete", "patch", "all", "use"];

function wrapRouterAsync(router) {
    for (const m of VERBS) {
        if (typeof router[m] !== "function") continue;
        const orig = router[m].bind(router);
        router[m] = function (...args) {
            const wrapped = args.map((h) => (typeof h === "function" && h.length < 4)
                ? function (req, res, next) {
                    try {
                        const r = h(req, res, next);
                        if (r && typeof r.then === "function") r.catch(next);
                        return r;
                    }
                    catch (e) {
                        next(e);
                    }
                }
                : h);
            return orig(...wrapped);
        };
    }
    return router;
}
