"use strict";
/**
 * 驗證 LINE LIFF/Login 發的 ID Token。
 * 文件：https://developers.line.biz/en/reference/line-login/#verify-id-token
 * 回傳：{ ok, sub, name, picture, error }
 *   sub = LINE userId（U 開頭）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyLineIdToken = verifyLineIdToken;

async function verifyLineIdToken(idToken, channelId) {
    if (!idToken || typeof idToken !== "string") {
        return { ok: false, error: "missing idToken" };
    }
    const cid = String(channelId || process.env.LINE_LOGIN_CHANNEL_ID || "").trim();
    if (!cid) {
        return { ok: false, error: "未設定 LINE_LOGIN_CHANNEL_ID（LIFF/LINE Login channel ID）" };
    }
    try {
        const body = new URLSearchParams();
        body.set("id_token", idToken);
        body.set("client_id", cid);
        const resp = await fetch("https://api.line.me/oauth2/v2.1/verify", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
        });
        const j = await resp.json().catch(() => null);
        if (!resp.ok) {
            return { ok: false, error: `verify HTTP ${resp.status}: ${j?.error_description || j?.error || ""}` };
        }
        if (!j || !j.sub) {
            return { ok: false, error: "verify 回傳缺少 sub" };
        }
        // aud 應為 channel id（容錯：LINE 可能回 string 或 array）
        const aud = Array.isArray(j.aud) ? j.aud : [j.aud];
        if (!aud.includes(cid)) {
            return { ok: false, error: "aud 與 channel id 不符" };
        }
        return {
            ok: true,
            sub: String(j.sub),
            name: j.name ? String(j.name) : null,
            picture: j.picture ? String(j.picture) : null,
            email: j.email ? String(j.email) : null,
        };
    } catch (e) {
        return { ok: false, error: String(e?.message || e).slice(0, 200) };
    }
}
