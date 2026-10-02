import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const FFMPEG_BIN = [
  process.env.FFMPEG_PATH,
  "D:/ffmpeg/bin/ffmpeg.exe",
  "C:/ffmpeg/bin/ffmpeg.exe",
  "ffmpeg"
].find((p) => {
  if (!p) return false;
  if (p === "ffmpeg") return true;
  return fs.existsSync(p);
}) || "ffmpeg";

interface Snowflake {
  x0: number;
  y0: number;
  radius: number;
  speedMultiplier: number; // 1 or 2 cycles per loop
  swayFreq: number; // 1, 2, or 3 cycles
  swayAmp: number;
  phase: number;
  brightness: number;
}

/** Tạo video hạt tuyết rơi chậm xoay vòng liền mạch (Seamless Loop) */
export async function ztteam_ensureSnowEffectVideo(): Promise<string> {
  const effectsDir = path.join(process.cwd(), "public", "effects");
  fs.mkdirSync(effectsDir, { recursive: true });

  const snowVideoPath = path.join(effectsDir, "snow_slow.mp4");

  // Nếu file đã tồn tại và hợp lệ (> 10KB), tái sử dụng ngay
  if (fs.existsSync(snowVideoPath) && fs.statSync(snowVideoPath).size > 10000) {
    return snowVideoPath;
  }

  const width = 540;
  const height = 960;
  const fps = 25;
  const durationSec = 6;
  const totalFrames = fps * durationSec; // 150 frames

  // Khởi tạo danh sách 160 bông tuyết với chiều sâu đa tầng
  const snowflakes: Snowflake[] = [];
  const flakeCount = 160;

  for (let i = 0; i < flakeCount; i++) {
    const layer = Math.random();
    let radius = 1.5;
    let brightness = 140;
    let speedMult = 1; // 1 full cycle through height in 6s

    if (layer < 0.5) {
      // Tầng xa: hạt nhỏ, mờ, rơi chậm
      radius = 1.2 + Math.random() * 1.0;
      brightness = 100 + Math.random() * 50;
      speedMult = 1;
    } else if (layer < 0.85) {
      // Tầng trung: hạt vừa, sáng rõ
      radius = 2.5 + Math.random() * 1.5;
      brightness = 180 + Math.random() * 50;
      speedMult = Math.random() > 0.4 ? 1 : 2;
    } else {
      // Tầng gần: hạt to, mịn màng, rơi lướt qua
      radius = 4.5 + Math.random() * 2.5;
      brightness = 220 + Math.random() * 35;
      speedMult = 2;
    }

    snowflakes.push({
      x0: Math.random() * width,
      y0: Math.random() * height,
      radius,
      speedMultiplier: speedMult,
      swayFreq: Math.floor(1 + Math.random() * 3), // 1 to 3 full sway cycles
      swayAmp: 10 + Math.random() * 25,
      phase: Math.random() * Math.PI * 2,
      brightness,
    });
  }

  // Khởi động tiến trình FFmpeg để nhận rawvideo stream RGB24 từ stdin
  return new Promise((resolve, reject) => {
    const ffmpegProc = spawn(
      FFMPEG_BIN,
      [
        "-y",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-s",
        `${width}x${height}`,
        "-r",
        String(fps),
        "-i",
        "-",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-preset",
        "ultrafast",
        "-crf",
        "18",
        snowVideoPath,
      ],
      { stdio: ["pipe", "ignore", "pipe"] }
    );

    ffmpegProc.on("error", (err) => {
      console.error("FFmpeg snow spawn error:", err);
      reject(err);
    });

    ffmpegProc.on("close", (code) => {
      if (code === 0 && fs.existsSync(snowVideoPath)) {
        resolve(snowVideoPath);
      } else {
        reject(new Error(`FFmpeg snow process exited with code ${code}`));
      }
    });

    const frameBytes = width * height * 3;
    const frameBuffer = Buffer.alloc(frameBytes);

    for (let f = 0; f < totalFrames; f++) {
      // Xóa nền đen hoàn toàn (RGB: 0, 0, 0)
      frameBuffer.fill(0);

      const progress = f / totalFrames; // 0 to 1

      for (const flake of snowflakes) {
        // Vị trí Y rơi thẳng xuống với điều kiện tuần hoàn toán học tuyệt đối (Seamless Wrap)
        const curY = (flake.y0 + flake.speedMultiplier * height * progress) % height;

        // Vị trí X đong đưa nhẹ theo gió (Sway) tuần hoàn 100%
        const curX =
          (flake.x0 +
            flake.swayAmp *
              Math.sin(2 * Math.PI * flake.swayFreq * progress + flake.phase) +
            width) %
          width;

        const r = flake.radius;
        const minX = Math.floor(curX - r);
        const maxX = Math.ceil(curX + r);
        const minY = Math.floor(curY - r);
        const maxY = Math.ceil(curY + r);

        for (let py = minY; py <= maxY; py++) {
          const wrapY = (py + height) % height;
          const dy = py - curY;

          for (let px = minX; px <= maxX; px++) {
            const wrapX = (px + width) % width;
            const dx = px - curX;

            const distSq = dx * dx + dy * dy;
            if (distSq <= r * r) {
              const u = Math.sqrt(distSq) / r;
              // Smooth cosine falloff
              const alpha = Math.cos((u * Math.PI) / 2);
              const val = Math.floor(flake.brightness * alpha);

              const pIdx = (wrapY * width + wrapX) * 3;
              // Hơi ngả xanh băng giá nhẹ (Cyan/Blue tint: R: 0.95, G: 0.98, B: 1.0)
              const rVal = Math.min(255, frameBuffer[pIdx] + Math.floor(val * 0.93));
              const gVal = Math.min(255, frameBuffer[pIdx + 1] + Math.floor(val * 0.97));
              const bVal = Math.min(255, frameBuffer[pIdx + 2] + val);

              frameBuffer[pIdx] = rVal;
              frameBuffer[pIdx + 1] = gVal;
              frameBuffer[pIdx + 2] = bVal;
            }
          }
        }
      }

      ffmpegProc.stdin.write(frameBuffer);
    }

    ffmpegProc.stdin.end();
  });
}
