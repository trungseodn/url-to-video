import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { ZTTEAM_PRESET_MUSIC, ztteam_ensurePresetMusicFiles, ZTTeamMusicTrack } from "@/lib/music-catalog";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Tạo sẵn các file nhạc mẫu nếu chưa có
    ztteam_ensurePresetMusicFiles();

    // 2. Quét danh sách nhạc người dùng tự upload (nếu có)
    const customTracks: ZTTeamMusicTrack[] = [];
    const customDir = path.join(process.cwd(), "public", "music", "custom");

    if (fs.existsSync(customDir)) {
      const files = fs.readdirSync(customDir);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if ([".mp3", ".wav", ".m4a", ".ogg", ".aac"].includes(ext)) {
          const stats = fs.statSync(path.join(customDir, file));
          customTracks.push({
            id: `custom_${file}`,
            title: `Nhạc tải lên: ${file.replace(/^custom_\d+_[a-z0-9]+_/, "")}`,
            category: "Hành Động",
            description: `File tùy chỉnh tải lên (${(stats.size / 1024 / 1024).toFixed(1)} MB)`,
            duration: "Tự do",
            url: `/music/custom/${file}`,
            isCustom: true,
          });
        }
      }
    }

    const allTracks: ZTTeamMusicTrack[] = [...ZTTEAM_PRESET_MUSIC, ...customTracks];

    return NextResponse.json({
      success: true,
      tracks: allTracks,
    });
  } catch (error) {
    console.error("Music fetch error:", error);
    const message = error instanceof Error ? error.message : "Lỗi khi lấy danh sách nhạc";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
