import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

import { getBrowserExecutablePath, HEADLESS_BROWSER_FLAGS } from "@/lib/browser-detector";

const execAsync = promisify(exec);

/** Render Hook Card to PNG using Headless Edge Browser */
async function ztteam_renderCardHtmlToPng(
  hookText: string,
  width: number,
  height: number,
  outPngPath: string,
  badgeText = "BREAKING NEWS",
  fontSizeOverride?: number
): Promise<boolean> {
  const browserPath = getBrowserExecutablePath();
  if (!browserPath) return false;

  const tempHtmlPath = outPngPath.replace(/\.png$/, ".html");
  const words = hookText.trim().split(/\s+/);
  
  // Highlight lead, numbers, uppercase acronyms, cliffhanger
  const formattedWords = words.map((w, idx) => {
    const isFirstFew = idx < 2;
    const isLastFew = idx >= words.length - 8 && (w.includes("...") || w.includes("(") || w.includes("Click") || w.includes("link") || w.includes("story"));
    const isHighlight = isFirstFew || isLastFew || /[A-Z]{3,}|\d+|[%$!]/.test(w);
    if (isHighlight) {
      return `<span style="color: #facc15;">${w}</span>`;
    }
    return w;
  });

  const formattedContent = formattedWords.join(" ");

  // Dynamic font size based on user override OR word count with strict frame boundary containment
  let fontSize = 42;
  let lineHeight = 1.42;

  const usableHeight = height - 130;
  const chars = Math.max(80, hookText.length);
  const calculatedMax = Math.floor(Math.sqrt((usableHeight * 926) / (chars * 0.79)));
  const hardMax = height > 600 ? 54 : 42;
  const safeMax = Math.max(24, Math.min(hardMax, calculatedMax));

  if (fontSizeOverride && Number(fontSizeOverride) > 0) {
    fontSize = Math.min(Number(fontSizeOverride), safeMax);
    if (fontSize >= 50) {
      lineHeight = 1.30;
    } else if (fontSize >= 44) {
      lineHeight = 1.34;
    } else if (fontSize >= 38) {
      lineHeight = 1.38;
    } else {
      lineHeight = 1.42;
    }
  } else {
    if (words.length <= 20) {
      fontSize = Math.min(50, safeMax);
      lineHeight = 1.45;
    } else if (words.length <= 35) {
      fontSize = Math.min(44, safeMax);
      lineHeight = 1.42;
    } else {
      fontSize = Math.min(38, safeMax);
      lineHeight = 1.38;
    }
  }

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: ${width}px;
    height: ${height}px;
    background-color: #1e293b;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    display: flex;
    flex-direction: column;
  }
  .accent-bar {
    width: 100%;
    height: 16px;
    background-color: #ef4444;
    flex-shrink: 0;
  }
  .container {
    padding: 30px 42px 30px 42px;
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    max-height: calc(100% - 16px);
  }
  .badge {
    color: #ef4444;
    font-size: 38px;
    font-weight: 900;
    letter-spacing: 2px;
    margin-bottom: 16px;
    text-transform: uppercase;
    flex-shrink: 0;
  }
  .content-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    overflow: hidden;
    max-height: 100%;
  }
  .content {
    display: block;
    width: 100%;
    color: #ffffff;
    font-size: ${fontSize}px;
    font-weight: 800;
    line-height: ${lineHeight};
    text-justify: auto;
    text-align-last: left;
    word-break: normal;
    hyphens: auto;
    overflow: hidden;
  }
</style>
</head>
<body>
  <div class="accent-bar"></div>
  <div class="container">
    <div class="badge">${badgeText}</div>
    <div class="content-wrapper">
      <div class="content">${formattedContent}</div>
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync(tempHtmlPath, htmlContent, "utf8");

  try {
    const fileUrl = `file:///${tempHtmlPath.replace(/\\/g, "/")}`;
    const cmd = `"${browserPath}" ${HEADLESS_BROWSER_FLAGS} --window-size=${width},${height} --screenshot="${outPngPath.replace(/\\/g, "/")}" "${fileUrl}"`;
    await execAsync(cmd);
    try { fs.unlinkSync(tempHtmlPath); } catch {}
    return fs.existsSync(outPngPath);
  } catch (err) {
    console.error("Headless render error:", err);
    try { fs.unlinkSync(tempHtmlPath); } catch {}
    return false;
  }
}

/** Tải hoặc chuẩn hoá đường dẫn file ảnh cục bộ */
async function ztteam_resolveImages(images: string[]): Promise<string[]> {
  const localPaths: string[] = [];
  const tempDir = path.join(process.cwd(), "public", "images", "temp");
  fs.mkdirSync(tempDir, { recursive: true });

  for (const imgUrl of images) {
    if (!imgUrl) continue;

    // 1. Data URI Base64
    if (imgUrl.startsWith("data:image/")) {
      try {
        const match = imgUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        const ext = `.${match?.[1] || "png"}`;
        const b64Data = match ? match[2] : imgUrl.replace(/^data:image\/\w+;base64,/, "");
        const buf = Buffer.from(b64Data, "base64");
        const tempPath = path.join(tempDir, `b64_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`);
        fs.writeFileSync(tempPath, buf);
        localPaths.push(tempPath);
      } catch (err) {
        console.warn("Could not parse base64 image:", err);
      }
      continue;
    }

    const cleanUrl = imgUrl.split("?")[0];

    // 2. Remote URL
    if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
      try {
        const res = await fetch(imgUrl, { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          const ext = path.extname(cleanUrl) || ".jpg";
          const tempPath = path.join(tempDir, `img_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`);
          fs.writeFileSync(tempPath, buf);
          localPaths.push(tempPath);
        }
      } catch (err) {
        console.warn("Could not download image:", imgUrl, err);
      }
    } else {
      // 3. Local file path in public
      const relPath = cleanUrl.startsWith("/") ? cleanUrl.substring(1) : cleanUrl;
      const absPath = path.join(process.cwd(), "public", relPath);
      if (fs.existsSync(absPath) && !localPaths.includes(absPath)) {
        localPaths.push(absPath);
      }
    }
  }

  return localPaths;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      images = [],
      hookText = "",
      aspectRatio = "9:16",
      badgeText = "BREAKING NEWS",
      fontSize
    } = body;

    if (!hookText.trim()) {
      return NextResponse.json({ success: false, error: "Vui lòng nhập nội dung Hook" }, { status: 400 });
    }

    const localImages = await ztteam_resolveImages(images);
    if (localImages.length === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy hình ảnh nào để tạo khung xem trước" }, { status: 400 });
    }

    const isVertical = aspectRatio === "9:16";
    const width = 1080;
    const height = isVertical ? 1920 : 1080;

    const outputDir = path.join(process.cwd(), "public", "images", "preview");
    fs.mkdirSync(outputDir, { recursive: true });

    const timestamp = Date.now();
    const fileName = `quick_preview_${timestamp}.png`;
    const outPngPath = path.join(outputDir, fileName);
    const webImageUrl = `/images/preview/${fileName}`;

    const cardW = 1010;
    const cardH = isVertical ? 870 : 500;
    const cardX = 35;
    const cardY = isVertical ? 1000 : 540;

    const cardPngPath = path.join(outputDir, `card_temp_${timestamp}.png`);
    const cardRendered = await ztteam_renderCardHtmlToPng(hookText, cardW, cardH, cardPngPath, badgeText, fontSize);

    if (!cardRendered) {
      return NextResponse.json({ success: false, error: "Không thể render thẻ Hook bằng trình duyệt" }, { status: 500 });
    }

    const slideFrameW = 1010;
    const slideFrameH = isVertical ? 960 : 500;
    const slideY = isVertical ? "(980-h)/2" : "(530-h)/2";

    const filterParts: string[] = [];
    filterParts.push(`color=c=0x0f172a:s=${width}x${height}:r=30[bg]`);
    filterParts.push(
      `[0:v]scale=${slideFrameW}:${slideFrameH}:force_original_aspect_ratio=decrease,pad=${slideFrameW}:${slideFrameH}:(ow-iw)/2:(oh-ih)/2:color=0x0f172a,setsar=1[v_slide]`
    );
    filterParts.push(`[bg][v_slide]overlay=x=(1080-w)/2:y=${slideY}[v1]`);

    const imgInput = localImages[0].replace(/\\/g, "/");
    const cardInput = cardPngPath.replace(/\\/g, "/");
    const inputArgs = [`-i "${imgInput}"`, `-i "${cardInput}"`];

    filterParts.push(`[v1][1:v]overlay=x=${cardX}:y=${cardY}[vout]`);

    const filterComplex = filterParts.join(";");
    const ffmpegBin = process.env.FFMPEG_PATH || (fs.existsSync("D:/ffmpeg/bin/ffmpeg.exe") ? "D:/ffmpeg/bin/ffmpeg.exe" : "ffmpeg");

    const cmd = `"${ffmpegBin}" -y ${inputArgs.join(" ")} -filter_complex "${filterComplex}" -map "[vout]" -vframes 1 "${outPngPath.replace(/\\/g, "/")}"`;
    await execAsync(cmd);

    try { fs.unlinkSync(cardPngPath); } catch {}

    return NextResponse.json({
      success: true,
      data: {
        imageUrl: webImageUrl,
        aspectRatio,
        hookText,
      },
    });
  } catch (error) {
    console.error("quick-preview error:", error);
    const message = error instanceof Error ? error.message : "Lỗi khi tạo ảnh xem trước";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const images = ["/images/image-1785038172554-9849.webp"];
  const hookText = "MISSING IN GRENADA — Officials Search For Elizabeth Waddell BREAKING NEWS: A critical investigation has intensified as detectives focus on her last known movements along the beach. Mystery deepens with shocking clues discovered... (Click link in caption to read full story!)";
  
  const fakeReq = new NextRequest(request.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images, hookText, aspectRatio: "9:16", badgeText: "BREAKING NEWS" }),
  });
  return POST(fakeReq);
}

