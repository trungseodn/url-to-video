import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { GoogleGenAI } from "@google/genai";
import { ztteam_fetchUrlData } from "@/lib/fetcher";
import { ztteam_generateContentWithRetry } from "@/lib/gemini";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { success: false, error: "Vui lòng nhập đường link bài viết hợp lệ" },
        { status: 400 }
      );
    }

    // 1. Fetch & parse article
    const fetchedData = await ztteam_fetchUrlData(url.trim());

    // 2. Extract all images from contentHtml and main image
    const $ = cheerio.load(fetchedData.contentHtml || "");
    const bodyImages: string[] = [];
    $("img").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-original");
      if (src && !bodyImages.includes(src)) {
        // Filter out tiny tracking icons or spacers
        if (!src.includes("icon") && !src.includes("avatar") && !src.includes("1x1") && !src.includes("pixel")) {
          bodyImages.push(src);
        }
      }
    });

    const allImages = Array.from(
      new Set([fetchedData.image, ...bodyImages].filter(Boolean) as string[])
    );

    // 3. Generate Viral Headline & Facebook Caption via Gemini AI
    let hookText = "";
    let badgeText = "BREAKING NEWS";
    let facebookCaption = "";

    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
      if (apiKey) {
        const ai = new GoogleGenAI({ apiKey });
        const promptText = `Title: ${fetchedData.title}\n\nContent: ${fetchedData.content || fetchedData.excerpt}\n\nURL: ${fetchedData.url}`;

        const { response } = await ztteam_generateContentWithRetry(ai, {
          primaryModel: "gemini-2.5-flash",
          fallbackModels: ["gemini-2.0-flash", "gemini-1.5-flash"],
          contents: {
            parts: [{ text: promptText }],
          },
          config: {
            systemInstruction: `Bạn là chuyên gia thiết kế hình ảnh truyền thông và Social Media Manager chuyên nghiệp cho Facebook.
Nhiệm vụ: Dựa vào nội dung bài viết, hãy tạo các thông tin sau BẰNG TIẾNG ANH:

1. badgeText: Một nhãn thu hút 1-3 từ IN HOA (ví dụ: BREAKING, DISCOVERY, EXCLUSIVE, UPDATE, INVESTIGATION).
2. hookText: MỘT TIÊU ĐỀ NGẮN GỌN ĐÚNG KHOẢNG 8 ĐẾN 12 TỪ (~10 TỪ).
- Mục đích: Gợi sự tò mò cao độ, kích thích người xem muốn bấm vào đọc ngay.
- TIÊU CHUẨN AN TOÀN FACEBOOK (TUYỆT ĐỐI TUÂN THỦ): KHÔNG dùng từ ngữ vi phạm tiêu chuẩn cộng đồng, KHÔNG dùng từ ngữ máu me bạo lực ghê rợn, phản cảm hoặc giật tít sai sự thật. Văn phong báo chí cuốn hút, sạch sẽ.
- Ví dụ chuẩn mẫu:
  + "Officials reveal shocking details found right at the beach..."
  + "A critical discovery has just changed the entire investigation..."
  + "Authorities uncover what happened moments before she vanished..."

3. facebookCaption: NỘI DUNG CAPTION BÀI ĐĂNG FACEBOOK KÈM ẢNH:
- QUY TẮC BẮT BUỘC: ĐƯA LINK LÊN TRÊN CÙNG CỦA BÀI VIẾT!
  + Dòng 1: 👉 Full Story & Details: [URL]
  + Dòng 2: (xuống dòng cách 1 dòng)
  + Dòng 3: Tiêu đề cuốn hút với icon sạch sẽ (🚨, 🔍, ⚠️, 📌).
  + Dòng 4-5: Đoạn tóm tắt kịch tính 2-3 câu ngắn gây tò mò, tuyệt đối tránh các từ ngữ vi phạm chính sách kiểm duyệt của Facebook.
  + Dòng cuối: 3-4 hashtags liên quan (ví dụ: #BreakingNews #Investigation #TrendingNews).

Trả về DUY NHẤT JSON hợp lệ (không kèm markdown):
{
  "badgeText": "string",
  "hookText": "string",
  "facebookCaption": "string"
}`,
          },
        });

        const rawText = (response.text || "").trim();
        try {
          const cleanJson = rawText.replace(/```json\n?|\n?```/g, "").trim();
          const parsed = JSON.parse(cleanJson);
          if (parsed.badgeText) badgeText = parsed.badgeText.trim().toUpperCase();
          if (parsed.hookText) hookText = parsed.hookText.trim();
          if (parsed.facebookCaption) facebookCaption = parsed.facebookCaption.trim();
        } catch {
          hookText = rawText;
        }
      }
    } catch (aiErr) {
      console.warn("AI Hook generation failed, using fallback:", aiErr);
    }

    if (!hookText) {
      hookText = `Officials reveal critical new details discovered right at the scene...`;
    }

    if (!facebookCaption) {
      facebookCaption = `👉 Full Story & Details: ${fetchedData.url}\n\n🚨 BREAKING: ${fetchedData.title}\n\nAuthorities have uncovered critical new evidence in this developing investigation as detectives examine key findings.\n\n#BreakingNews #Investigation #NewsAlert`;
    } else {
      if (facebookCaption.includes("[URL]")) {
        facebookCaption = facebookCaption.replace(/\[URL\]/g, fetchedData.url);
      }
      // Đảm bảo link luôn nằm ở trên cùng của caption
      if (!facebookCaption.startsWith("👉 Full Story") && !facebookCaption.includes(fetchedData.url)) {
        facebookCaption = `👉 Full Story & Details: ${fetchedData.url}\n\n${facebookCaption.trim()}`;
      } else if (!facebookCaption.startsWith("👉 Full Story") && facebookCaption.includes(fetchedData.url)) {
        const cleaned = facebookCaption.replace(new RegExp(`(👉|🔗|👇)?\\s*(Full Story|Link)?:?\\s*${fetchedData.url}`, "gi"), "").trim();
        facebookCaption = `👉 Full Story & Details: ${fetchedData.url}\n\n${cleaned}`;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        title: fetchedData.title,
        url: fetchedData.url,
        siteName: fetchedData.siteName,
        excerpt: fetchedData.excerpt,
        images: allImages,
        badgeText,
        hookText,
        facebookCaption,
      },
    });
  } catch (error) {
    console.error("url-image fetch error:", error);
    const message = error instanceof Error ? error.message : "Lỗi khi lấy dữ liệu bài viết từ URL";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
