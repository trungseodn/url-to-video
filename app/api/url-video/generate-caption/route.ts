import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { ztteam_generateContentWithRetry, ztteam_formatGeminiError } from "@/lib/gemini";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { title, hookText, url, excerpt, siteName } = await request.json();

    if (!title && !hookText) {
      return NextResponse.json(
        { success: false, error: "Thiếu tiêu đề hoặc nội dung hook để tạo caption" },
        { status: 400 }
      );
    }

    let caption = "";
    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
      if (apiKey) {
        const ai = new GoogleGenAI({ apiKey });
        const promptText = `Title: ${title || ""}\nHook: ${hookText || ""}\nExcerpt: ${excerpt || ""}\nSource: ${siteName || ""}\nURL: ${url || ""}`;

        const { response } = await ztteam_generateContentWithRetry(ai, {
          primaryModel: "gemini-2.5-flash",
          fallbackModels: ["gemini-2.0-flash", "gemini-1.5-flash"],
          contents: {
            parts: [{ text: promptText }],
          },
          config: {
            systemInstruction: `Bạn là chuyên gia Social Media chuyên viết Caption bài đăng Facebook Fanpage tin tức bằng Tiếng Anh.
Nhiệm vụ: Viết một Caption bài đăng Facebook hấp dẫn kèm video để tối đa hóa click vào link bài viết.

Yêu cầu định dạng:
1. Dòng 1: Tiêu đề giật gân, cuốn hút có emoji nổi bật (🚨, ⚠️, 🔴).
2. Dòng 2-3: Đoạn tóm tắt ngắn kịch tính (2-3 câu), nêu bật điểm nghẹt thở hoặc nghi vấn bỏ ngỏ để kích thích trí tò mò.
3. Dòng 4: Lời kêu gọi hành động (Call To Action) rõ ràng: "👇 Read the full story and shocking details here:" kèm link bài viết: ${url || "[LINK]"}.
4. Dòng cuối: 3-5 hashtags thịnh hành (ví dụ: #BreakingNews #News #Trending #ViralNews).

Chỉ trả về nội dung caption thuần (plain text), KHÔNG dùng khối markdown codeblock.`,
          },
        });

        caption = (response.text || "").trim();
      }
    } catch (aiErr) {
      console.warn("AI Caption generation error:", aiErr);
    }

    // Fallback if AI generation failed or empty
    if (!caption) {
      const cleanTitle = title || "Breaking News Alert";
      const cleanExcerpt = excerpt || hookText || "Shocking new details have just surfaced regarding this critical story as investigation continues.";
      const targetUrl = url || "#";
      caption = `🚨 BREAKING: ${cleanTitle}\n\n${cleanExcerpt}\n\n👇 Read the full story and critical updates in the link below:\n👉 Link: ${targetUrl}\n\n#BreakingNews #NewsAlert #Trending #ViralNews`;
    } else {
      // Ensure target URL is present
      if (url && !caption.includes(url)) {
        caption = `${caption}\n\n👉 Full story: ${url}`;
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
