import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { ZTTeamMusicTrack } from "@/lib/music-catalog";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Vui lòng chọn file nhạc (.mp3, .wav, .m4a)" },
        { status: 400 }
      );
    }

    const customDir = path.join(process.cwd(), "public", "music", "custom");
    await mkdir(customDir, { recursive: true });

    const originalName = file.name || "music.mp3";
    const ext = path.extname(originalName).toLowerCase() || ".mp3";
    
    if (![".mp3", ".wav", ".m4a", ".ogg", ".aac"].includes(ext)) {
      return NextResponse.json(
        { success: false, error: "Định dạng file không hỗ trợ. Vui lòng tải file .mp3, .wav, .m4a" },
        { status: 400 }
      );
    }

    const cleanBase = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().substring(0, 30);
    const filename = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${cleanBase}${ext}`;
    const filepath = path.join(customDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    const newTrack: ZTTeamMusicTrack = {
      id: `custom_${filename}`,
      title: originalName,
      category: "Hành Động",
      description: "Nhạc riêng tải lên từ máy",
      duration: "Tùy chỉnh",
      url: `/music/custom/${filename}`,
      isCustom: true,
    };

    return NextResponse.json({
      success: true,
      track: newTrack,
    });
  } catch (error) {
    console.error("Music upload error:", error);
    const message = error instanceof Error ? error.message : "Lỗi khi tải file nhạc lên";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
