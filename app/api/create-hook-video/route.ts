import { NextRequest, NextResponse } from "next/server";
// Fresh build trigger: 2026-09-30 T17:34:50
import {
  ztteam_getArticleById,
  ztteam_updateVideoInfo,
  ztteam_updateStatus,
  type ZTTeamArticle,
} from "@/lib/database";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

import { getBrowserExecutablePath, HEADLESS_BROWSER_FLAGS } from "@/lib/browser-detector";

const execAsync = promisify(exec);

/** Render Hook Card to PNG using Headless Browser for 100% pixel-perfect typography & justification */
async function ztteam_renderCardHtmlToPng(
  hookText: string,
  width: number,
  height: number,
  outPngPath: string
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

  // Dynamic font size based on word count to fill the card nicely
  let fontSize = 42;
  let lineHeight = 1.42;
  if (words.length <= 20) {
    fontSize = 50;
    lineHeight = 1.45;
  } else if (words.length <= 35) {
    fontSize = 44;
    lineHeight = 1.42;
  } else {
    fontSize = 38;
    lineHeight = 1.38;
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
  }
</style>
</head>
<body>
  <div class="accent-bar"></div>
  <div class="container">
    <div class="badge">BREAKING NEWS</div>
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

/** Wrap text into lines based on max chars per line */
function ztteam_wrapText(text: string, maxCharsPerLine = 45): string[] {
  const clean = text.trim().replace(/[\r\n]+/g, " ");
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.slice(0, 14); // Max 14 lines
}

/** Căn đều 2 bên (Justify) bằng cách phân bổ khoảng trắng giữa các từ */
function ztteam_justifyLine(line: string, targetLen = 45): string {
  const words = line.trim().split(/\s+/);
  if (words.length <= 1) return line;
  let diff = targetLen - line.length;
  // Chỉ giãn dòng khi thiếu từ 1 đến 6 ký tự (không giãn dòng cụt cuối cùng)
  if (diff <= 0 || diff > 6) return line;
  let idx = 0;
  while (diff > 0) {
    words[idx % (words.length - 1)] += " ";
    diff--;
    idx++;
  }
  return words.join(" ");
}

/** Truncate text to max 50 words (~50 words) to keep hook punchy with large text */
function ztteam_limitWords(text: string, maxWords = 50): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  const truncated = words.slice(0, maxWords).join(" ").replace(/[\.\s]+$/, "");
  return `${truncated}... (Click link in caption to read full story!)`;
}

/** Trích xuất tất cả ảnh từ bài viết (Main images + HTML images) */
function ztteam_extractArticleImages(article: ZTTeamArticle): string[] {
  const rawUrls: string[] = [];

  // Ảnh chính & ảnh AI
  if (article.image_new) rawUrls.push(article.image_new.split("?")[0]);
  if (article.image_original && !rawUrls.includes(article.image_original.split("?")[0])) {
    rawUrls.push(article.image_original.split("?")[0]);
  }

  // Quét ảnh từ HTML content
  const htmlContents = [article.content_new, article.content_html, article.content_original];
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;

  for (const html of htmlContents) {
    if (!html) continue;
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      const src = match[1].split("?")[0];
      if (src && !src.startsWith("data:") && !rawUrls.includes(src)) {
        rawUrls.push(src);
      }
    }
  }

  return rawUrls;
}

/** Tải/xác thực danh sách ảnh thành file cục bộ trên máy */
async function ztteam_prepareLocalImages(imageUrls: string[]): Promise<string[]> {
  const localPaths: string[] = [];

  for (const imgUrl of imageUrls) {
    let cleanUrl = imgUrl.trim();
    if (!cleanUrl) continue;

    if (cleanUrl.startsWith("/")) {
      const absPath = path.join(process.cwd(), "public", cleanUrl);
      if (fs.existsSync(absPath) && !localPaths.includes(absPath)) {
        localPaths.push(absPath);
      }
    } else if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
      try {
        const resp = await fetch(cleanUrl);
        if (resp.ok) {
          const buf = Buffer.from(await resp.arrayBuffer());
          const ext = cleanUrl.toLowerCase().includes(".png") ? "png" : "jpg";
          const tempName = `temp_${Date.now()}_${Math.floor(Math.random() * 10000)}.${ext}`;
          const tempPath = path.join(process.cwd(), "public", "images", tempName);
          fs.mkdirSync(path.dirname(tempPath), { recursive: true });
          fs.writeFileSync(tempPath, buf);
          localPaths.push(tempPath);
        }
      } catch {}
    } else {
      const absPath = path.join(process.cwd(), "public", cleanUrl);
      if (fs.existsSync(absPath) && !localPaths.includes(absPath)) {
        localPaths.push(absPath);
      }
    }
  }

  return localPaths;
}

/** Sanitize string cho FFmpeg drawtext */
function ztteam_escapeFFmpegText(str: string): string {
  return str
    .replace(/\\/g, "/")
    .replace(/'/g, "")
    .replace(/:/g, "\\:")
    .replace(/%/g, "\\%");
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "56";
  const hookText = searchParams.get("hookText") || undefined;
  const duration = searchParams.get("duration") ? Number(searchParams.get("duration")) : 5;
  const aspectRatio = (searchParams.get("aspectRatio") as "9:16" | "1:1") || "9:16";

  const fakeReq = new NextRequest("http://localhost:3000/api/create-hook-video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, hookText, duration, aspectRatio }),
  });
  return POST(fakeReq);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { id, hookText: customHookText, duration = 8, aspectRatio = "9:16" } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Thiếu Article ID" },
        { status: 400 },
      );
    }

    const article = ztteam_getArticleById(id);
    if (!article) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy bài viết" },
        { status: 404 },
      );
    }

    // 1. Trích xuất và chuẩn bị danh sách ảnh cho slideshow
    const rawImageUrls = ztteam_extractArticleImages(article);
    const localImages = await ztteam_prepareLocalImages(rawImageUrls);

    if (localImages.length === 0) {
      return NextResponse.json(
        { success: false, error: "Bài viết chưa có hình ảnh để làm slide video" },
        { status: 400 },
      );
    }

    // 2. Xác định nội dung Câu Hook (~30 từ)
    let hookText = customHookText?.trim();
    if (!hookText) {
      if (article.hook_text) {
        hookText = article.hook_text;
      } else {
        const parts: string[] = [];
        if (article.large_title && article.small_title) {
          parts.push(`${article.large_title} — ${article.small_title}`);
        } else if (article.large_title) {
          parts.push(article.large_title);
        } else if (article.title_new) {
          parts.push(article.title_new);
        }

        if (article.script) {
          const sentences = article.script.split(/(?<=[.!?])\s+/);
          parts.push(sentences.slice(0, 2).join(" "));
        } else if (article.content_original) {
          const cleanContent = article.content_original.replace(/<[^>]+>/g, " ");
          const sentences = cleanContent.split(/(?<=[.!?])\s+/);
          parts.push(sentences.slice(0, 2).join(" "));
        }

        hookText = parts.join(" ") || article.title_original || "BREAKING NEWS";
      }
    }

    // Giới hạn tối đa 50 từ để chữ to rõ nổi bật
    hookText = ztteam_limitWords(hookText, 50);

    // Tự động tính toán font size & spacing dựa trên 50 từ
    const isVertical = aspectRatio === "9:16";
    const width = 1080;
    const height = isVertical ? 1920 : 1080;

    // Line wrapping cho Hook Text (45 ký tự/dòng để kéo căng toàn bộ bề ngang khung card 1010px)
    const maxCharsPerLine = isVertical ? 45 : 42;
    const rawLines = ztteam_wrapText(hookText, maxCharsPerLine);
    const lines = rawLines.map((l, i) =>
      i === rawLines.length - 1 ? l : ztteam_justifyLine(l, maxCharsPerLine)
    );

    let fontSize = 42;
    let lineHeight = 58;
    if (lines.length <= 5) {
      fontSize = 46;
      lineHeight = 64;
    } else if (lines.length <= 8) {
      fontSize = 42;
      lineHeight = 58;
    } else {
      fontSize = 38;
      lineHeight = 52;
    }

    // Font path resolution (Windows standard font)
    const fontFile = "C:/Windows/Fonts/arialbd.ttf";
    const cleanFont = fontFile.replace(/\\/g, "/").replace(":", "\\:");

    // Thư mục lưu video
    const outputDir = path.join(process.cwd(), "public", "videos", "hook");
    fs.mkdirSync(outputDir, { recursive: true });

    const timestamp = Date.now();
    const fileName = `hook_${id}_${timestamp}.mp4`;
    const outMp4Path = path.join(outputDir, fileName);
    const webVideoUrl = `/videos/hook/${fileName}`;

    // Xây dựng FFmpeg Filter Graph
    const filterParts: string[] = [];
    const inputs: string[] = [];

    // Background Canvas
    filterParts.push(`color=c=0x0f172a:s=${width}x${height}:r=30[bg]`);

    // Input images setup
    // Limit max 5 images for slideshow to prevent bloated commands
    const slideImages = localImages.slice(0, 5);
    const numImg = slideImages.length;
    const slideFrameW = 1010;
    const slideFrameH = isVertical ? 960 : 500;

    for (const img of slideImages) {
      const cleanP = img.replace(/\\/g, "/");
      inputs.push(`-loop 1 -t ${duration} -i "${cleanP}"`);
    }

    if (numImg === 1) {
      // Single image frame
      filterParts.push(
        `[1:v]scale=${slideFrameW}:${slideFrameH}:force_original_aspect_ratio=decrease,pad=${slideFrameW}:${slideFrameH}:(ow-iw)/2:(oh-ih)/2:color=0x0f172a,setsar=1[v_slide]`
      );
    } else {
      // Multiple images slideshow with slideleft / xfade transitions
      for (let i = 0; i < numImg; i++) {
        filterParts.push(
          `[${i + 1}:v]scale=${slideFrameW}:${slideFrameH}:force_original_aspect_ratio=decrease,pad=${slideFrameW}:${slideFrameH}:(ow-iw)/2:(oh-ih)/2:color=0x0f172a,setsar=1[v_img${i}]`
        );
      }

      // Chain xfade transitions
      const step = duration / numImg;
      let prevStream = "v_img0";

      for (let i = 1; i < numImg; i++) {
        const nextStream = i === numImg - 1 ? "v_slide" : `v_xf${i}`;
        const offset = (step * i - 0.4).toFixed(2);
        filterParts.push(
          `[${prevStream}][v_img${i}]xfade=transition=slideleft:duration=0.5:offset=${offset}[${nextStream}]`
        );
        prevStream = nextStream;
      }
    }

    const cardW = 1010;
    const cardH = isVertical ? 870 : 500;
    const cardX = 35;
    const cardY = isVertical ? 1000 : 540;

    const cardPngPath = path.join(outputDir, `card_${id}_${timestamp}.png`);
    const cardRendered = await ztteam_renderCardHtmlToPng(hookText, cardW, cardH, cardPngPath);

    let audioInputIdx = numImg + 1;

    if (cardRendered) {
      inputs.push(`-loop 1 -t ${duration} -i "${cardPngPath.replace(/\\/g, "/")}"`);
      const cardInputIdx = numImg + 1;
      audioInputIdx = numImg + 2;

      const slideY = isVertical ? "(980-h)/2" : "(530-h)/2";
      filterParts.push(`[bg][v_slide]overlay=x=(1080-w)/2:y=${slideY}[v1]`);
      filterParts.push(`[v1][${cardInputIdx}:v]overlay=x=${cardX}:y=${cardY}[vout]`);
    } else if (isVertical) {
      // Overlay Top Slideshow
      filterParts.push(`[bg][v_slide]overlay=x=(1080-w)/2:y=(980-h)/2[v1]`);

      filterParts.push(`[v1]drawbox=x=${cardX}:y=${cardY}:w=${cardW}:h=${cardH}:color=0x1e293b@0.96:t=fill[v2]`);
      filterParts.push(`[v2]drawbox=x=${cardX}:y=${cardY}:w=${cardW}:h=16:color=0xef4444:t=fill[v3]`);
      
      filterParts.push(
        `[v3]drawtext=text='BREAKING NEWS':fontfile='${cleanFont}':fontsize=42:fontcolor=0xef4444:x=55:y=${cardY + 38}[v4]`
      );

      const totalTextHeight = lines.length * lineHeight;
      const usableH = cardH - 120;
      const verticalPadding = Math.max(10, Math.floor((usableH - totalTextHeight) / 2));
      let currentV = "v4";
      let textY = cardY + 105 + verticalPadding;

      for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        const nextV = idx === lines.length - 1 ? "vout" : `vt${idx}`;
        const escaped = ztteam_escapeFFmpegText(line);
        const isHighlight = idx === 0 || idx === lines.length - 1 || /[A-Z]{3,}|\d+|[%$!]/g.test(line);
        const color = isHighlight ? "0xfacc15" : "white";
        filterParts.push(
          `[${currentV}]drawtext=text='${escaped}':fontfile='${cleanFont}':fontsize=${fontSize}:fontcolor=${color}:x=55:y=${textY}[${nextV}]`
        );
        currentV = nextV;
        textY += lineHeight;
      }
    } else {
      // Square layout (1:1)
      filterParts.push(`[bg][v_slide]overlay=x=(1080-w)/2:y=(530-h)/2[v1]`);

      filterParts.push(`[v1]drawbox=x=35:y=${cardY}:w=1010:h=${cardH}:color=0x1e293b@0.96:t=fill[v2]`);
      filterParts.push(`[v2]drawbox=x=35:y=${cardY}:w=1010:h=14:color=0xef4444:t=fill[v3]`);
      filterParts.push(
        `[v3]drawtext=text='BREAKING NEWS':fontfile='${cleanFont}':fontsize=36:fontcolor=0xef4444:x=55:y=${cardY + 35}[v4]`
      );

      const totalTextHeight = lines.length * lineHeight;
      const usableH = cardH - 100;
      const verticalPadding = Math.max(10, Math.floor((usableH - totalTextHeight) / 2));
      let currentV = "v4";
      let textY = cardY + 85 + verticalPadding;

      for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        const nextV = idx === lines.length - 1 ? "vout" : `vt${idx}`;
        const escaped = ztteam_escapeFFmpegText(line);
        const isHighlight = idx === 0 || idx === lines.length - 1 || /[A-Z]{3,}|\d+|[%$!]/g.test(line);
        const color = isHighlight ? "0xfacc15" : "white";
        filterParts.push(
          `[${currentV}]drawtext=text='${escaped}':fontfile='${cleanFont}':fontsize=${fontSize}:fontcolor=${color}:x=55:y=${textY}[${nextV}]`
        );
        currentV = nextV;
        textY += lineHeight;
      }
    }

    const filterComplex = filterParts.join(";");

    // Exec FFmpeg: Ưu tiên FFMPEG_PATH -> D:/ffmpeg/bin/ffmpeg.exe (Local cũ) -> ffmpeg toàn cục
    const ffmpegBin = process.env.FFMPEG_PATH || (fs.existsSync("D:/ffmpeg/bin/ffmpeg.exe")
      ? "D:/ffmpeg/bin/ffmpeg.exe"
      : "ffmpeg");

    const cmd = `"${ffmpegBin}" -y -f lavfi -i color=c=0x0f172a:s=${width}x${height}:r=30 ${inputs.join(
      " "
    )} -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -filter_complex "${filterComplex}" -map "[vout]" -map ${audioInputIdx}:a -t ${duration} -c:v libx264 -pix_fmt yuv420p -c:a aac "${outMp4Path}"`;

    await execAsync(cmd);
    try { if (cardRendered) fs.unlinkSync(cardPngPath); } catch {}

    // Update SQLite database
    ztteam_updateVideoInfo(id, {
      video_path: webVideoUrl,
      hook_text: hookText,
      video_type: "hook",
    });
    ztteam_updateStatus(id, "approved");

    return NextResponse.json({
      success: true,
      data: {
        videoPath: webVideoUrl,
        hookText,
        duration,
        aspectRatio,
        imageCount: slideImages.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Có lỗi khi tạo video hook";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
