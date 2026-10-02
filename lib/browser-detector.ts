import fs from "fs";

/**
 * Danh sách đường dẫn trình duyệt Chromium/Edge hỗ trợ cả Windows Local và Linux VPS / Docker
 */
const CANDIDATE_PATHS = [
  // 1. Biến môi trường tuỳ chỉnh (nếu đặt trên VPS/Docker)
  process.env.CHROME_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,

  // 2. Windows Local Paths (Ưu tiên đầu danh sách để giữ nguyên 100% cho máy local)
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",

  // 3. Linux VPS / Docker Paths
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/microsoft-edge",
  "/snap/bin/chromium",
];

export function getBrowserExecutablePath(): string | undefined {
  return CANDIDATE_PATHS.filter((p): p is string => Boolean(p && typeof p === "string")).find((p) =>
    fs.existsSync(p)
  );
}

/**
 * Các cờ headless chuẩn tối ưu tương thích cả Windows và Linux VPS (không GPU, root trong Docker)
 */
export const HEADLESS_BROWSER_FLAGS = [
  "--headless",
  "--disable-gpu",
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-software-rasterizer",
  "--hide-scrollbars",
  "--force-device-scale-factor=1",
  "--disable-cache",
  "--disk-cache-size=0",
  "--media-cache-size=0",
].join(" ");
