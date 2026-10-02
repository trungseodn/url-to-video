import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { ztteam_ensurePresetMusicFiles } from "@/lib/music-catalog";

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
      duration = 6,
      aspectRatio = "9:16",
      badgeText = "BREAKING NEWS",
      title = "Quick Hook Video",
      facebookCaption = "",
      musicId = "news-breaking-alert",
      musicVolume = 80,
      customMusicUrl = "",
      fontSize,
    } = body;

    if (!hookText.trim()) {
      return NextResponse.json({ success: false, error: "Vui lòng nhập nội dung Hook" }, { status: 400 });
    }

    const localImages = await ztteam_resolveImages(images);
    if (localImages.length === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy hình ảnh nào để tạo video" }, { status: 400 });
    }

    // Resolve Background Music Path
    let bgmPath: string | null = null;
    if (musicId && musicId !== "none") {
      if (customMusicUrl) {
        const rel = customMusicUrl.startsWith("/") ? customMusicUrl.substring(1) : customMusicUrl;
        const abs = path.join(process.cwd(), "public", rel);
        if (fs.existsSync(abs)) bgmPath = abs;
      }

      if (!bgmPath) {
        const candidateWav = path.join(process.cwd(), "public", "music", `${musicId}.wav`);
        const candidateMp3 = path.join(process.cwd(), "public", "music", `${musicId}.mp3`);
        if (fs.existsSync(candidateWav)) {
          bgmPath = candidateWav;
        } else if (fs.existsSync(candidateMp3)) {
          bgmPath = candidateMp3;
        } else {
          try {
            ztteam_ensurePresetMusicFiles();
            if (fs.existsSync(candidateWav)) bgmPath = candidateWav;
          } catch {}
        }
      }
    }

    const isVertical = aspectRatio === "9:16";
    const width = 1080;
    const height = isVertical ? 1920 : 1080;

    const outputDir = path.join(process.cwd(), "public", "videos", "quick-hook");
    fs.mkdirSync(outputDir, { recursive: true });

    const timestamp = Date.now();
    const fileName = `quick_hook_${timestamp}.mp4`;
    const outMp4Path = path.join(outputDir, fileName);
    const webVideoUrl = `/videos/quick-hook/${fileName}`;

    // Xây dựng Filter Graph FFmpeg
    const filterParts: string[] = [];
    const inputs: string[] = [];

    // Limit max 5 images for slideshow
    const slideImages = localImages.slice(0, 5);
    const numImg = slideImages.length;
    const slideFrameW = 1010;
    const slideFrameH = isVertical ? 960 : 500;

    for (const img of slideImages) {
      const cleanP = img.replace(/\\/g, "/");
      inputs.push(`-loop 1 -t ${duration} -i "${cleanP}"`);
    }

    if (numImg === 1) {
      filterParts.push(
        `[1:v]scale=${slideFrameW}:${slideFrameH}:force_original_aspect_ratio=decrease,pad=${slideFrameW}:${slideFrameH}:(ow-iw)/2:(oh-ih)/2:color=0x0f172a,setsar=1[v_slide]`
      );
    } else {
      for (let i = 0; i < numImg; i++) {
        filterParts.push(
          `[${i + 1}:v]scale=${slideFrameW}:${slideFrameH}:force_original_aspect_ratio=decrease,pad=${slideFrameW}:${slideFrameH}:(ow-iw)/2:(oh-ih)/2:color=0x0f172a,setsar=1[v_img${i}]`
        );
      }

      const step = duration / numImg;
      let prevStream = "v_img0";

      for (let i = 1; i < numImg; i++) {
        const nextStream = i === numImg - 1 ? "v_slide" : `v_xf${i}`;
        const offset = Math.max(0.1, Number((step * i - 0.4).toFixed(2)));
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

    const cardPngPath = path.join(outputDir, `card_temp_${timestamp}.png`);
    const cardRendered = await ztteam_renderCardHtmlToPng(hookText, cardW, cardH, cardPngPath, badgeText, fontSize);

    if (!cardRendered) {
      return NextResponse.json({ success: false, error: "Không thể render thẻ Hook bằng Edge headless" }, { status: 500 });
    }

    let nextInputIdx = numImg + 1;

    // 1. Card Input
    inputs.push(`-loop 1 -t ${duration} -i "${cardPngPath.replace(/\\/g, "/")}"`);
    const cardInputIdx = nextInputIdx++;

    const slideY = isVertical ? "(980-h)/2" : "(530-h)/2";
    filterParts.push(`[0:v][v_slide]overlay=x=(1080-w)/2:y=${slideY}[v1]`);

    // 2. Overlay Card
    filterParts.push(`[v1][${cardInputIdx}:v]overlay=x=${cardX}:y=${cardY}[vout]`);

    // 3. Audio Input
    const audioInputIdx = nextInputIdx++;
    let audioFilterMap = `${audioInputIdx}:a`;

    if (bgmPath && fs.existsSync(bgmPath)) {
      const cleanBgm = bgmPath.replace(/\\/g, "/");
      inputs.push(`-stream_loop -1 -i "${cleanBgm}"`);
      const vol = Math.max(0.05, Math.min(1.0, (Number(musicVolume) || 80) / 100));
      const fadeStart = Math.max(0.2, Number((duration - 1).toFixed(2)));
      filterParts.push(
        `[${audioInputIdx}:a]volume=${vol}:precision=fixed,afade=t=out:st=${fadeStart}:d=1,asetpts=PTS-STARTPTS[aout]`
      );
      audioFilterMap = `"[aout]"`;
    } else {
      inputs.push(`-f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100`);
    }

    const filterComplex = filterParts.join(";");
    const ffmpegBin = process.env.FFMPEG_PATH || (fs.existsSync("D:/ffmpeg/bin/ffmpeg.exe") ? "D:/ffmpeg/bin/ffmpeg.exe" : "ffmpeg");

    const cmd = `"${ffmpegBin}" -y -f lavfi -i color=c=0x0f172a:s=${width}x${height}:r=30 ${inputs.join(
      " "
    )} -filter_complex "${filterComplex}" -map "[vout]" -map ${audioFilterMap} -t ${duration} -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 192k "${outMp4Path.replace(/\\/g, "/")}"`;

    await execAsync(cmd);
    try { fs.unlinkSync(cardPngPath); } catch {}

    return NextResponse.json({
      success: true,
      data: {
        videoUrl: webVideoUrl,
        fileName,
        title,
        hookText,
        duration,
        aspectRatio,
        imageCount: slideImages.length,
        facebookCaption,
        musicId: musicId || "none",
      },
    });
  } catch (error) {
    console.error("quick-render error:", error);
    const message = error instanceof Error ? `${error.message}\n${error.stack}` : "Lỗi khi render video";
    return NextResponse.json({ success: false, error: message }, { status: 200 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const images = [
    "/images/image-1785038172554-9849.webp",
    "/images/image-1785038172557-1043.webp"
  ];
  const hookText = "MISSING IN GRENADA — Officials Search For Elizabeth Waddell BREAKING NEWS: A critical investigation has intensified as detectives focus on her last known movements along the beach. Mystery deepens with shocking clues discovered... (Click link in caption to read full story!)";
  
  const fakeReq = new NextRequest(request.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      images,
      hookText,
      duration: 4,
      aspectRatio: "9:16",
      badgeText: "BREAKING NEWS",
      title: "Test Hook Video"
    }),
  });
  return POST(fakeReq);
}

