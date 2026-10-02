import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

import { getBrowserExecutablePath, HEADLESS_BROWSER_FLAGS } from "@/lib/browser-detector";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const execAsync = promisify(exec);

/** Chuẩn hoá và tải ảnh về file cục bộ để Edge render không bị lỗi CORS/timeout */
async function ztteam_resolveImages(images: string[]): Promise<string[]> {
  const localPaths: string[] = [];
  const tempDir = path.join(process.cwd(), "public", "images", "temp");
  fs.mkdirSync(tempDir, { recursive: true });

  for (const imgUrl of images) {
    if (!imgUrl || typeof imgUrl !== "string") continue;
    const cleanImgUrl = imgUrl.trim();

    // 1. Data URI Base64
    if (cleanImgUrl.startsWith("data:image/")) {
      try {
        const match = cleanImgUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        const ext = `.${match?.[1] || "png"}`;
        const b64Data = match ? match[2] : cleanImgUrl.replace(/^data:image\/\w+;base64,/, "");
        const buf = Buffer.from(b64Data, "base64");
        const tempPath = path.join(tempDir, `b64_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`);
        fs.writeFileSync(tempPath, buf);
        localPaths.push(tempPath);
      } catch (err) {
        console.warn("Could not parse base64 image:", err);
      }
      continue;
    }

    const cleanUrl = cleanImgUrl.split("?")[0];

    // 2. Remote URL (http / https)
    if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
      try {
        const headers: Record<string, string> = {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        };
        try {
          const u = new URL(cleanImgUrl);
          headers["Referer"] = `${u.origin}/`;
        } catch {}

        const res = await fetch(cleanImgUrl, {
          signal: AbortSignal.timeout(10000),
          headers,
        });

        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          const ext = path.extname(cleanUrl) || ".jpg";
          const tempPath = path.join(tempDir, `img_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`);
          fs.writeFileSync(tempPath, buf);
          localPaths.push(tempPath);
        } else {
          console.warn(`[resolveImages] Remote image fetch returned status ${res.status}:`, cleanImgUrl);
        }
      } catch (err) {
        console.warn("[resolveImages] Could not download image for collage:", cleanImgUrl, err);
      }
    } else {
      // 3. Local file path in public
      let relPath = cleanUrl;
      if (relPath.startsWith("/")) relPath = relPath.substring(1);

      if (path.isAbsolute(cleanImgUrl) && fs.existsSync(cleanImgUrl)) {
        if (!localPaths.includes(cleanImgUrl)) localPaths.push(cleanImgUrl);
      } else {
        const absPath = path.join(process.cwd(), "public", relPath);
        if (fs.existsSync(absPath) && !localPaths.includes(absPath)) {
          localPaths.push(absPath);
        }
      }
    }
  }

  return localPaths;
}

/** Format text with highlighted keywords for viral hook impact */
function ztteam_formatWords(
  text: string,
  customHighlights?: string[],
  highlightColor: string = "#facc15"
): string {
  const words = text.trim().split(/\s+/);

  // Nếu người dùng chỉ định danh sách từ khóa tô màu cụ thể
  if (Array.isArray(customHighlights) && customHighlights.length > 0) {
    if (customHighlights.includes("__NONE__")) {
      return text;
    }
    const cleanHighlights = customHighlights.map(h => h.trim().toLowerCase()).filter(Boolean);
    return words.map((w) => {
      const cleanW = w.replace(/^[^\w\u00C0-\u024F\u1E00-\u1EFF]+|[^\w\u00C0-\u024F\u1E00-\u1EFF]+$/g, "").toLowerCase();
      if (cleanHighlights.includes(cleanW) || cleanHighlights.some(h => cleanW.includes(h) || h.includes(cleanW))) {
        return `<span style="color: ${highlightColor};">${w}</span>`;
      }
      return w;
    }).join(" ");
  }

  // Tự động nhận diện từ khóa nếu chưa chọn danh sách riêng
  return words.map((w, idx) => {
    const isFirstFew = idx < 2;
    const isLastFew = idx >= words.length - 8 && (w.includes("...") || w.includes("(") || w.includes("Click") || w.includes("link") || w.includes("story") || w.includes("details"));
    const isHighlight = isFirstFew || isLastFew || /[A-Z]{3,}|\d+|[%$!]/.test(w);
    if (isHighlight) {
      return `<span style="color: ${highlightColor};">${w}</span>`;
    }
    return w;
  }).join(" ");
}

/** Tạo HTML cho các bố cục ghép ảnh khác nhau */
function ztteam_buildCollageHtml(params: {
  width: number;
  height: number;
  imagePaths: string[];
  layout: string;
  hookText: string;
  badgeText: string;
  showText: boolean;
  gap: number;
  borderColor: string;
  markerType: string;
  markerX: number;
  markerY: number;
  markerSize: any;
  markerColor: string;
  arrowDirection: string;
  customHighlights?: string[];
  highlightColor?: string;
  showInsetCircle?: boolean;
  insetImageIndex?: number;
  insetImagePath?: string;
  insetImageUrl?: string;
  insetSize?: number;
  insetX?: number;
  insetY?: number;
  insetBorderColor?: string;
  insetBadge?: string;
}): string {
  const {
    width,
    height,
    imagePaths,
    layout,
    hookText,
    badgeText,
    showText,
    gap,
    borderColor,
    markerType = "none",
    markerX = 50,
    markerY = 40,
    markerSize = 160,
    markerColor = "#ef4444",
    arrowDirection = "bottom-left",
    customHighlights = [],
    highlightColor = "#facc15",
    showInsetCircle = false,
    insetImageIndex = 1,
    insetImagePath,
    insetImageUrl,
    insetSize = 34,
    insetX = 82,
    insetY = 75,
    insetBorderColor = "#ef4444",
    insetBadge = "ZOOM",
  } = params;

  // Chuyển đường dẫn ảnh sang dạng file:/// URL
  const imgUrls = imagePaths.map(p => `file:///${p.replace(/\\/g, "/")}`);
  const fallbackImg = imgUrls[0] || "";

  const formattedWords = hookText ? ztteam_formatWords(hookText, customHighlights, highlightColor) : "";

  let innerContentHtml = "";

  switch (layout) {
    case "card": {
      const wordsCount = hookText.trim() ? hookText.trim().split(/\s+/).length : 0;
      let cardFontSize = 40;
      if (wordsCount <= 14) {
        cardFontSize = height >= 1600 ? 56 : (height >= 1200 ? 48 : 42);
      } else if (wordsCount <= 25) {
        cardFontSize = height >= 1600 ? 46 : (height >= 1200 ? 40 : 34);
      } else {
        cardFontSize = height >= 1600 ? 38 : (height >= 1200 ? 32 : 28);
      }

      const cardHeight = showText ? Math.round(height * 0.32) : 0;
      const photoHeight = height - cardHeight;

      innerContentHtml = `
        <div style="width: 100%; height: ${photoHeight}px; position: relative; overflow: hidden; background: #020617;">
          <img src="${fallbackImg}" style="width: 100%; height: 100%; object-fit: cover; object-position: center;" />
        </div>
        ${showText ? `
        <div style="width: 100%; height: ${cardHeight}px; background-color: #1e293b; display: flex; flex-direction: column; box-sizing: border-box; position: relative;">
          <div style="width: 100%; height: 14px; background-color: #ef4444; flex-shrink: 0;"></div>
          <div style="padding: 24px 36px; display: flex; flex-direction: column; justify-content: space-between; flex: 1;">
            <div style="color: #ef4444; font-size: 30px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase;">
              ${badgeText || "BREAKING NEWS"}
            </div>
            <div style="color: #ffffff; font-size: ${cardFontSize}px; font-weight: 800; line-height: 1.38; text-align: left; margin-top: 10px;">
              ${formattedWords}
            </div>
          </div>
        </div>
        ` : ""}
      `;
      break;
    }

    case "split_h": {
      // Layout 2A: Split ngang (2 ảnh cạnh nhau trái/phải 50-50)
      const img1 = imgUrls[0] || fallbackImg;
      const img2 = imgUrls[1] || imgUrls[0] || fallbackImg;

      innerContentHtml = `
        <div style="display: flex; width: 100%; height: 100%; gap: ${gap}px; background: ${borderColor};">
          <div style="flex: 1; height: 100%; overflow: hidden; position: relative;">
            <img src="${img1}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
          <div style="flex: 1; height: 100%; overflow: hidden; position: relative;">
            <img src="${img2}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
        </div>
      `;
      break;
    }

    case "split_v": {
      // Layout 2B: Split dọc (2 ảnh trên/dưới 50-50)
      const img1 = imgUrls[0] || fallbackImg;
      const img2 = imgUrls[1] || imgUrls[0] || fallbackImg;

      innerContentHtml = `
        <div style="display: flex; flex-direction: column; width: 100%; height: 100%; gap: ${gap}px; background: ${borderColor};">
          <div style="flex: 1; width: 100%; overflow: hidden; position: relative;">
            <img src="${img1}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
          <div style="flex: 1; width: 100%; overflow: hidden; position: relative;">
            <img src="${img2}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
        </div>
      `;
      break;
    }

    case "grid3": {
      // Layout 3A: 1 ảnh lớn bên trái + 2 ảnh nhỏ bên phải xếp chồng
      const img1 = imgUrls[0] || fallbackImg;
      const img2 = imgUrls[1] || imgUrls[0] || fallbackImg;
      const img3 = imgUrls[2] || imgUrls[1] || imgUrls[0] || fallbackImg;

      innerContentHtml = `
        <div style="display: flex; width: 100%; height: 100%; gap: ${gap}px; background: ${borderColor};">
          <div style="flex: 1.25; height: 100%; overflow: hidden; position: relative;">
            <img src="${img1}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
          <div style="flex: 0.95; height: 100%; display: flex; flex-direction: column; gap: ${gap}px;">
            <div style="flex: 1; width: 100%; overflow: hidden; position: relative;">
              <img src="${img2}" style="width: 100%; height: 100%; object-fit: cover;" />
            </div>
            <div style="flex: 1; width: 100%; overflow: hidden; position: relative;">
              <img src="${img3}" style="width: 100%; height: 100%; object-fit: cover;" />
            </div>
          </div>
        </div>
      `;
      break;
    }

    case "grid3_top": {
      // Layout 3B: 1 ảnh lớn ở TRÊN (60%), 2 ảnh nhỏ ở DƯỚI (40%) chia đôi
      const img1 = imgUrls[0] || fallbackImg;
      const img2 = imgUrls[1] || imgUrls[0] || fallbackImg;
      const img3 = imgUrls[2] || imgUrls[1] || imgUrls[0] || fallbackImg;

      innerContentHtml = `
        <div style="display: flex; flex-direction: column; width: 100%; height: 100%; gap: ${gap}px; background: ${borderColor};">
          <div style="flex: 1.4; width: 100%; overflow: hidden; position: relative;">
            <img src="${img1}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
          <div style="flex: 1; width: 100%; display: flex; gap: ${gap}px;">
            <div style="flex: 1; height: 100%; overflow: hidden; position: relative;">
              <img src="${img2}" style="width: 100%; height: 100%; object-fit: cover;" />
            </div>
            <div style="flex: 1; height: 100%; overflow: hidden; position: relative;">
              <img src="${img3}" style="width: 100%; height: 100%; object-fit: cover;" />
            </div>
          </div>
        </div>
      `;
      break;
    }

    case "triptych_h": {
      // Layout 3C: 3 Cột Đứng song song (1/3 - 1/3 - 1/3)
      const img1 = imgUrls[0] || fallbackImg;
      const img2 = imgUrls[1] || imgUrls[0] || fallbackImg;
      const img3 = imgUrls[2] || imgUrls[1] || imgUrls[0] || fallbackImg;

      innerContentHtml = `
        <div style="display: flex; width: 100%; height: 100%; gap: ${gap}px; background: ${borderColor};">
          <div style="flex: 1; height: 100%; overflow: hidden; position: relative;">
            <img src="${img1}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
          <div style="flex: 1; height: 100%; overflow: hidden; position: relative;">
            <img src="${img2}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
          <div style="flex: 1; height: 100%; overflow: hidden; position: relative;">
            <img src="${img3}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
        </div>
      `;
      break;
    }

    case "grid4": {
      // Layout 4: 4 ảnh lưới 2x2
      const img1 = imgUrls[0] || fallbackImg;
      const img2 = imgUrls[1] || imgUrls[0] || fallbackImg;
      const img3 = imgUrls[2] || imgUrls[0] || fallbackImg;
      const img4 = imgUrls[3] || imgUrls[1] || imgUrls[0] || fallbackImg;

      innerContentHtml = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; width: 100%; height: 100%; gap: ${gap}px; background: ${borderColor};">
          <div style="overflow: hidden; width: 100%; height: 100%; position: relative;">
            <img src="${img1}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
          <div style="overflow: hidden; width: 100%; height: 100%; position: relative;">
            <img src="${img2}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
          <div style="overflow: hidden; width: 100%; height: 100%; position: relative;">
            <img src="${img3}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
          <div style="overflow: hidden; width: 100%; height: 100%; position: relative;">
            <img src="${img4}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
        </div>
      `;
      break;
    }

    case "grid1_3": {
      // Layout 5: 1 ảnh chính lớn bên trái + 3 ảnh nhỏ xếp dọc bên phải
      const img1 = imgUrls[0] || fallbackImg;
      const img2 = imgUrls[1] || imgUrls[0] || fallbackImg;
      const img3 = imgUrls[2] || imgUrls[1] || imgUrls[0] || fallbackImg;
      const img4 = imgUrls[3] || imgUrls[2] || imgUrls[1] || fallbackImg;

      innerContentHtml = `
        <div style="display: flex; width: 100%; height: 100%; gap: ${gap}px; background: ${borderColor};">
          <div style="flex: 1.6; height: 100%; overflow: hidden; position: relative;">
            <img src="${img1}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
          <div style="flex: 1; height: 100%; display: flex; flex-direction: column; gap: ${gap}px;">
            <div style="flex: 1; width: 100%; overflow: hidden; position: relative;">
              <img src="${img2}" style="width: 100%; height: 100%; object-fit: cover;" />
            </div>
            <div style="flex: 1; width: 100%; overflow: hidden; position: relative;">
              <img src="${img3}" style="width: 100%; height: 100%; object-fit: cover;" />
            </div>
            <div style="flex: 1; width: 100%; overflow: hidden; position: relative;">
              <img src="${img4}" style="width: 100%; height: 100%; object-fit: cover;" />
            </div>
          </div>
        </div>
      `;
      break;
    }

    case "pip_circle": {
      // 1 ảnh nền chính tràn khung (khung tròn Inset được render độc lập bên dưới để có thể tùy biến to nhỏ/vị trí)
      const img1 = imgUrls[0] || fallbackImg;
      innerContentHtml = `
        <div style="width: 100%; height: 100%; position: relative; overflow: hidden; background: #020617;">
          <img src="${img1}" style="width: 100%; height: 100%; object-fit: cover;" />
        </div>
      `;
      break;
    }

    case "poster":
    default: {
      // Layout 7: Poster Overlay (Ảnh tràn khung + Gradient tối chân trang + Badge + Tiêu đề)
      const fontSize = height >= 1600 ? 44 : 36;
      innerContentHtml = `
        <div style="width: 100%; height: 100%; position: relative; overflow: hidden; background: #020617;">
          <img src="${fallbackImg}" style="width: 100%; height: 100%; object-fit: cover;" />
          <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 40px 36px 36px 36px; background: linear-gradient(to top, rgba(15, 23, 42, 0.96) 0%, rgba(15, 23, 42, 0.85) 60%, transparent 100%); display: flex; flex-direction: column; gap: 14px;">
            ${badgeText ? `
            <div style="display: inline-block; background-color: #ef4444; color: #ffffff; padding: 6px 16px; border-radius: 6px; font-size: 24px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; align-self: flex-start; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);">
              ${badgeText}
            </div>
            ` : ""}
            <div style="color: #ffffff; font-size: ${fontSize}px; font-weight: 800; line-height: 1.36; text-shadow: 0 2px 8px rgba(0,0,0,0.8);">
              ${formattedWords}
            </div>
          </div>
        </div>
      `;
      break;
    }
  }

  // Visual Attention Marker: Vòng tròn đỏ & Mũi tên đỏ
  let markerHtml = "";
  if (markerType !== "none") {
    const posX = Math.round((Number(markerX) / 100) * width);
    const posY = Math.round((Number(markerY) / 100) * height);

    let diam = 160;
    if (typeof markerSize === "number" || (!isNaN(Number(markerSize)) && Number(markerSize) > 0)) {
      diam = Math.max(50, Math.min(450, Number(markerSize)));
    } else if (markerSize === "sm") {
      diam = 110;
    } else if (markerSize === "lg") {
      diam = 240;
    }
    const radius = Math.round(diam / 2);
    const arrowScale = Math.max(0.65, Math.min(1.8, Number((diam / 160).toFixed(2))));

    // 1. Vòng tròn đỏ rõ nét, dứt khoát, hoàn toàn không có vòng trắng bị lặp bên trong
    const circleSvg = `
      <svg width="${diam}" height="${diam}" viewBox="0 0 100 100" style="position: absolute; left: ${posX - radius}px; top: ${posY - radius}px; pointer-events: none; z-index: 45; filter: drop-shadow(0 0 14px ${markerColor}ee) drop-shadow(0 4px 10px rgba(0,0,0,0.95));">
        <circle cx="50" cy="50" r="44" fill="none" stroke="${markerColor}" stroke-width="7" />
      </svg>
    `;

    // 2. Mũi tên đỏ 3D viền trắng hướng vào vòng tròn
    let arrowDeg = 0;
    let arrowLeft = posX - radius - Math.round(110 * arrowScale);
    let arrowTop = posY + Math.round(radius * 0.35);

    switch (arrowDirection) {
      case "bottom-right":
        arrowDeg = -90;
        arrowLeft = posX + Math.round(radius * 0.45);
        arrowTop = posY + Math.round(radius * 0.35);
        break;
      case "top-left":
        arrowDeg = 90;
        arrowLeft = posX - radius - Math.round(110 * arrowScale);
        arrowTop = posY - radius - Math.round(85 * arrowScale);
        break;
      case "top-right":
        arrowDeg = 180;
        arrowLeft = posX + Math.round(radius * 0.45);
        arrowTop = posY - radius - Math.round(85 * arrowScale);
        break;
      case "left":
        arrowDeg = 45;
        arrowLeft = posX - radius - Math.round(135 * arrowScale);
        arrowTop = posY - Math.round(45 * arrowScale);
        break;
      case "bottom":
        arrowDeg = -45;
        arrowLeft = posX - Math.round(50 * arrowScale);
        arrowTop = posY + radius + 15;
        break;
      case "bottom-left":
      default:
        arrowDeg = 0;
        arrowLeft = posX - radius - Math.round(110 * arrowScale);
        arrowTop = posY + Math.round(radius * 0.35);
        break;
    }

    const arrowSvg = `
      <svg width="${Math.round(135 * arrowScale)}" height="${Math.round(135 * arrowScale)}" viewBox="0 0 120 120" style="position: absolute; left: ${arrowLeft}px; top: ${arrowTop}px; transform: rotate(${arrowDeg}deg); transform-origin: 80% 20%; pointer-events: none; z-index: 46; filter: drop-shadow(0 0 14px ${markerColor}cc) drop-shadow(0 5px 12px rgba(0,0,0,0.95));">
        <defs>
          <linearGradient id="viralArrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#991b1b" />
            <stop offset="50%" stop-color="${markerColor}" />
            <stop offset="100%" stop-color="#ff6b6b" />
          </linearGradient>
        </defs>
        <path d="M 15 95 Q 40 85 68 62 L 62 82 L 112 42 L 72 15 L 75 36 Q 36 60 15 95 Z" fill="url(#viralArrowGrad)" stroke="#ffffff" stroke-width="4.5" stroke-linejoin="round" />
      </svg>
    `;

    if (markerType === "circle") {
      markerHtml = circleSvg;
    } else if (markerType === "arrow") {
      markerHtml = arrowSvg;
    } else if (markerType === "circle_arrow") {
      markerHtml = `${circleSvg}\n${arrowSvg}`;
    }
  }

  // Floating Banner nếu là layout ảnh thuần nhưng người dùng bật chữ
  let floatingBannerHtml = "";
  if (showText && layout !== "card" && layout !== "poster" && hookText.trim()) {
    const fontSize = height >= 1400 ? 32 : 26;
    floatingBannerHtml = `
      <div style="position: absolute; bottom: 24px; left: 24px; right: 24px; background: rgba(15, 23, 42, 0.94); backdrop-filter: blur(10px); border: 2px solid rgba(239, 68, 68, 0.8); border-radius: 16px; padding: 20px 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.8); display: flex; flex-direction: column; gap: 8px; z-index: 30;">
        ${badgeText ? `
        <div style="color: #ef4444; font-size: 20px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase;">
          ${badgeText}
        </div>
        ` : ""}
        <div style="color: #ffffff; font-size: ${fontSize}px; font-weight: 800; line-height: 1.34;">
          ${formattedWords}
        </div>
      </div>
    `;
  }

  // Khung Tròn Inset (PiP Zoom / Detail Circle): Tùy biến kích thước, vị trí, có thể thêm vào bất kỳ khung chia ảnh nào
  let insetCircleHtml = "";
  if (showInsetCircle || layout === "pip_circle") {
    let selectedInsetImage = "";
    if (insetImagePath) {
      selectedInsetImage = `file:///${insetImagePath.replace(/\\/g, "/")}`;
    } else if (insetImageUrl && typeof insetImageUrl === "string" && insetImageUrl.trim()) {
      selectedInsetImage = insetImageUrl.trim();
    } else {
      selectedInsetImage = imgUrls[insetImageIndex] || imgUrls[1] || imgUrls[0] || fallbackImg;
    }
    const pipSizePct = Math.max(15, Math.min(60, Number(insetSize) || 34));
    const pipDiam = Math.round(Math.min(width, height) * (pipSizePct / 100));
    const pipRadius = Math.round(pipDiam / 2);
    const posX = Math.round((Number(insetX ?? 82) / 100) * width) - pipRadius;
    const posY = Math.round((Number(insetY ?? 75) / 100) * height) - pipRadius;
    const borderCol = insetBorderColor || "#ef4444";
    const badge = insetBadge !== undefined ? insetBadge : "ZOOM";

    insetCircleHtml = `
      <div style="position: absolute; left: ${posX}px; top: ${posY}px; width: ${pipDiam}px; height: ${pipDiam}px; border-radius: 50%; border: 7px solid ${borderCol}; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.85), 0 0 25px ${borderCol}bb; z-index: 35; background: #000000; pointer-events: none;">
        <img src="${selectedInsetImage}" style="width: 100%; height: 100%; object-fit: cover;" />
        ${badge ? `
        <div style="position: absolute; bottom: 8px; left: 0; right: 0; text-align: center;">
          <span style="background: ${borderCol}; color: #ffffff; font-size: ${Math.max(12, Math.round(pipDiam * 0.085))}px; font-weight: 900; padding: 2px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 2px 6px rgba(0,0,0,0.7);">
            ${badge}
          </span>
        </div>
        ` : ""}
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: ${width}px;
    height: ${height}px;
    background-color: ${borderColor || "#0f172a"};
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    position: relative;
    display: flex;
    flex-direction: column;
  }
</style>
</head>
<body>
  ${innerContentHtml}
  ${floatingBannerHtml}
  ${insetCircleHtml}
  ${markerHtml}
</body>
</html>`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      images = [],
      layout = "card",
      aspectRatio = "1:1",
      hookText = "",
      badgeText = "BREAKING NEWS",
      showText = true,
      gap = 6,
      borderColor = "#0f172a",
      title = "URL Collage Image",
      facebookCaption = "",
      markerType = "none",
      markerX = 50,
      markerY = 40,
      markerSize = 160,
      markerColor = "#ef4444",
      arrowDirection = "bottom-left",
      customHighlights = [],
      highlightColor = "#facc15",
      showInsetCircle = false,
      insetImageIndex = 1,
      insetImageUrl = "",
      insetSize = 34,
      insetX = 82,
      insetY = 75,
      insetBorderColor = "#ef4444",
      insetBadge = "ZOOM",
    } = body;

    const localImages = await ztteam_resolveImages(images);
    if (localImages.length === 0) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy hình ảnh nào để tạo ảnh ghép" },
        { status: 400 }
      );
    }

    // Tải và chuẩn hóa ảnh riêng cho Khung Tròn Inset (nếu có chỉ định ảnh cụ thể)
    let insetImagePath: string | undefined;
    if (insetImageUrl && typeof insetImageUrl === "string" && insetImageUrl.trim()) {
      const targetInsetUrl = insetImageUrl.trim();
      const matchIdx = images.findIndex((img) => img && typeof img === "string" && img.trim() === targetInsetUrl);
      if (matchIdx !== -1 && localImages[matchIdx]) {
        insetImagePath = localImages[matchIdx];
      } else {
        const resolvedInset = await ztteam_resolveImages([targetInsetUrl]);
        if (resolvedInset.length > 0) {
          insetImagePath = resolvedInset[0];
        }
      }
    }

    const browserPath = getBrowserExecutablePath();
    if (!browserPath) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy trình duyệt Edge hoặc Chrome trên máy để render ảnh" },
        { status: 500 }
      );
    }

    // Xác định kích thước ảnh theo tỷ lệ
    let width = 1080;
    let height = 1080;

    switch (aspectRatio) {
      case "4:5":
        width = 1080;
        height = 1350;
        break;
      case "9:16":
        width = 1080;
        height = 1920;
        break;
      case "16:9":
        width = 1200;
        height = 675;
        break;
      case "1:1":
      default:
        width = 1080;
        height = 1080;
        break;
    }

    const outputDir = path.join(process.cwd(), "public", "images", "collages");
    fs.mkdirSync(outputDir, { recursive: true });

    const timestamp = Date.now();
    const fileName = `collage_${timestamp}.png`;
    const outPngPath = path.join(outputDir, fileName);
    const tempHtmlPath = path.join(outputDir, `collage_temp_${timestamp}.html`);
    const webImageUrl = `/images/collages/${fileName}`;

    const htmlContent = ztteam_buildCollageHtml({
      width,
      height,
      imagePaths: localImages,
      layout,
      hookText,
      badgeText,
      showText,
      gap: Number(gap) || 0,
      borderColor: borderColor || "#0f172a",
      markerType,
      markerX: Number(markerX) || 50,
      markerY: Number(markerY) || 40,
      markerSize,
      markerColor: markerColor || "#ef4444",
      arrowDirection: arrowDirection || "bottom-left",
      customHighlights,
      highlightColor,
      showInsetCircle: Boolean(showInsetCircle),
      insetImageIndex: Number(insetImageIndex) || 0,
      insetImagePath,
      insetImageUrl: insetImageUrl ? insetImageUrl.trim() : undefined,
      insetSize: Number(insetSize) || 34,
      insetX: Number(insetX) || 82,
      insetY: Number(insetY) || 75,
      insetBorderColor: insetBorderColor || "#ef4444",
      insetBadge: insetBadge !== undefined ? insetBadge : "ZOOM",
    });

    fs.writeFileSync(tempHtmlPath, htmlContent, "utf8");

    try {
      const fileUrl = `file:///${tempHtmlPath.replace(/\\/g, "/")}`;
      const cmd = `"${browserPath}" ${HEADLESS_BROWSER_FLAGS} --window-size=${width},${height} --screenshot="${outPngPath.replace(/\\/g, "/")}" "${fileUrl}"`;
      await execAsync(cmd);
      try { fs.unlinkSync(tempHtmlPath); } catch {}
    } catch (err) {
      try { fs.unlinkSync(tempHtmlPath); } catch {}
      throw err;
    }

    if (!fs.existsSync(outPngPath)) {
      return NextResponse.json(
        { success: false, error: "Render ảnh thất bại hoặc không tạo được file PNG" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        imageUrl: webImageUrl,
        fileName,
        title,
        hookText,
        badgeText,
        layout,
        aspectRatio,
        imageCount: localImages.length,
        facebookCaption,
        markerType,
        markerX,
        markerY,
        showInsetCircle,
        insetImageUrl,
        insetX,
        insetY,
        insetSize,
        createdAt: new Date().toLocaleTimeString(),
      },
    });
  } catch (error) {
    console.error("url-image render error:", error);
    const message = error instanceof Error ? error.message : "Lỗi khi render ảnh ghép";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
