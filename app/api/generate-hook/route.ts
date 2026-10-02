import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { ztteam_getArticleById, ztteam_updateVideoInfo } from "@/lib/database";
import { ztteam_generateContentWithRetry, ztteam_formatGeminiError } from "@/lib/gemini";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Thiếu Article ID" },
        { status: 400 },
      );
    }

    const article = ztteam_getArticleById(Number(id));
    if (!article) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy bài viết" },
        { status: 404 },
      );
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || "",
    });

    const promptText = `Content of article: ${article.content_original || article.content_new || article.title_original}`;

    const { response } = await ztteam_generateContentWithRetry(ai, {
      primaryModel: "gemini-2.5-flash",
      fallbackModels: ["gemini-2.0-flash", "gemini-1.5-flash"],
      contents: {
        parts: [{ text: promptText }],
      },
      config: {
        systemInstruction: `Bạn là chuyên gia viết kịch bản video viral và tiêu đề giật gân (Clickbait News).
Nhiệm vụ: Dựa vào nội dung bài viết, hãy viết MỘT ĐOẠN HOOK VIDEO BẰNG TIẾNG ANH dài khoảng 45 đến 55 từ (~50 từ).

Yêu cầu cực kỳ quan trọng:
1. Đọc nội dung bài viết và nêu ra thông tin gây sốc nhất, kịch tính nhất ngay câu đầu tiên theo phong cách BREAKING NEWS.
2. Tạo sự lấp lửng/bỏ ngỏ (cliffhanger) ở chi tiết mấu chốt nhất để người xem TÒ MÒ CỰC ĐỘ và phải bấm vào link bài viết để xem tiếp!
3. Độ dài NẰM TRONG KHOẢNG 45-55 TỪ (~50 từ). Ngắn gọn, đắt giá, giữ độ kịch tính cực cao.
4. KHÔNG dùng markdown hay định dạng đặc biệt, chỉ trả về văn bản thuần (plain text).`,
      },
    });

    const generatedHook = (response.text || "").trim();

    if (generatedHook) {
      ztteam_updateVideoInfo(Number(id), { hook_text: generatedHook });
    }

    return NextResponse.json({
      success: true,
      data: { hookText: generatedHook },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: ztteam_formatGeminiError(error) },
      { status: 500 },
    );
  }
}
