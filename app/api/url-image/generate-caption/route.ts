import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { ztteam_generateContentWithRetry } from "@/lib/gemini";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { title = "", hookText = "", url = "", excerpt = "", siteName = "" } = await request.json();

    if (!title && !hookText && !excerpt) {
      return NextResponse.json(
        { success: false, error: "Thiếu dữ liệu bài viết để tạo caption" },
        { status: 400 }
      );
    }

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Chưa cấu hình GEMINI_API_KEY" },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const promptText = `Title: ${title}
Hook Text: ${hookText}
Excerpt: ${excerpt}
Source: ${siteName}
URL: ${url}

Hãy viết lại MỘT BẢN CAPTION FACEBOOK HOÀN CHỈNH BẰNG TIẾNG ANH chuyên dùng để đăng kèm ảnh ghép (Photo Collage post):
- QUY TẮC BẮT BUỘC 1: ĐƯA LINK LÊN TRÊN CÙNG BÀI VIẾT!
  + Dòng 1: 👉 Full Story & Details: [URL]
  + Dòng 2: (xuống dòng cách 1 dòng)
- QUY TẮC BẮT BUỘC 2: TUÂN THỦ NGHIÊM NGẶT CHÍNH SÁCH FACEBOOK:
  + Tuyệt đối tránh từ ngữ vi phạm bộ lọc kiểm duyệt của Facebook (không dùng từ ngữ máu me, bạo lực ghê rợn, phản cảm hoặc khẳng định sai sự thật).
  + Dòng 3: Tiêu đề cuốn hút với icon sạch sẽ (🚨, 🔍, ⚠️, 📌).
  + Dòng 4-5: Đoạn tóm tắt kịch tính 2-3 câu ngắn gây tò mò, văn phong báo chí chuẩn mực, an toàn cho Fanpage.
  + Dòng cuối: 3-4 hashtags liên quan (ví dụ: #BreakingNews #Investigation #TrendingNews).

Trả về DUY NHẤT nội dung caption, không kèm lời mở đầu hoặc giải thích.`;

    const { response } = await ztteam_generateContentWithRetry(ai, {
      primaryModel: "gemini-2.5-flash",
      fallbackModels: ["gemini-2.0-flash", "gemini-1.5-flash"],
      contents: {
        parts: [{ text: promptText }],
      },
    });

    let caption = (response.text || "").trim();
    if (url) {
      if (caption.includes("[URL]")) {
        caption = caption.replace(/\[URL\]/g, url);
      }
      if (!caption.startsWith("👉 Full Story") && !caption.includes(url)) {
        caption = `👉 Full Story & Details: ${url}\n\n${caption}`;
      } else if (!caption.startsWith("👉 Full Story") && caption.includes(url)) {
        const cleaned = caption.replace(new RegExp(`(👉|🔗|👇)?\\s*(Full Story|Link)?:?\\s*${url}`, "gi"), "").trim();
        caption = `👉 Full Story & Details: ${url}\n\n${cleaned}`;
      }
    }

    return NextResponse.json({
      success: true,
      caption,
    });
  } catch (error) {
    console.error("generate-caption error:", error);
    const message = error instanceof Error ? error.message : "Lỗi khi tạo caption";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
