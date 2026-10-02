import crypto from "crypto";

export const AUTH_COOKIE_NAME = "ztteam_session";

// Mật khẩu mặc định hoặc cấu hình qua biến môi trường
export function getAdminCredentials() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "ztteam2026@admin";
  return { username, password };
}

// Secret key dùng để hash token
const SECRET_KEY = process.env.AUTH_SECRET || "ztteam_pipeline_ultra_secure_secret_2026";

/** Tạo token session an toàn */
export function createSessionToken(username: string): string {
  const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 ngày
  const payload = `${username}:${expiry}`;
  const hmac = crypto.createHmac("sha256", SECRET_KEY).update(payload).digest("hex");
  return Buffer.from(`${payload}:${hmac}`).toString("base64");
}

/** Xác minh token session */
export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const [username, expiryStr, signature] = decoded.split(":");
    if (!username || !expiryStr || !signature) return false;

    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry) || Date.now() > expiry) return false;

    const payload = `${username}:${expiryStr}`;
    const expectedSig = crypto.createHmac("sha256", SECRET_KEY).update(payload).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
  } catch {
    return false;
  }
}
