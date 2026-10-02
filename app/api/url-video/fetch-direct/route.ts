import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { GoogleGenAI } from "@google/genai";
import { ztteam_fetchUrlData } from "@/lib/fetcher";
import { ztteam_generateContentWithRetry, ztteam_formatGeminiError } from "@/lib/gemini";

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
      const src = $(el).attr("src");
      if (src && !bodyImages.includes(src)) {
        bodyImages.push(src);
      }
    });

    const allImages = Array.from(
      new Set([fetchedData.image, ...bodyImages].filter(Boolean) as string[])
    );

    // 3. Generate Viral Hook & Facebook Caption via Gemini AI
    let hookText = "";
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
            systemInstruction: `Bạn là chuyên gia sản xuất tin tức viral và Facebook Social Media Manager chuyên nghiệp.
Nhiệm vụ: Dựa vào nội dung bài viết, hãy tạo 2 nội dung BẰNG TIẾNG ANH:

1. hookText: MỘT ĐOẠN HOOK VIDEO dài đúng 45 đến 55 từ (~50 từ).
- Nêu thông tin gây sốc/kịch tính nhất ngay câu đầu theo phong cách BREAKING NEWS.
- Tạo cliffhanger lấp lửng ở chi tiết mấu chốt để người xem tò mò cực độ và phải xem tiếp.
- Câu cuối cùng kết thúc bằng: (Click link in caption to read full story!)

2. facebookCaption: NỘI DUNG CAPTION BÀI ĐĂNG FACEBOOK kèm video:
- Dòng 1: Tiêu đề giật gân, cuốn hút với icon cảnh báo (🚨, ⚠️, 🔴).
- Dòng 2-3: Đoạn tóm tắt kịch tính 2-3 câu ngắn nêu bật tình tiết nghẹt thở.
- Dòng 4: Lời kêu gọi hành động (CTA) kèm placeholder [URL] (ví dụ: "👇 Read full developing story here: [URL]").
- Dòng cuối: 3-5 hashtags liên quan (ví dụ: #BreakingNews #News #Trending #ViralNews).

Trả về duy nhất JSON hợp lệ (không kèm giải thích):
{
  "hookText": "string",
  "facebookCaption": "string"
}`,
          },
        });

        const rawText = (response.text || "").trim();
        try {
          const cleanJson = rawText.replace(/```json\n?|\n?```/g, "").trim();
          const parsed = JSON.parse(cleanJson);
          if (parsed.hookText) hookText = parsed.hookText.trim();
          if (parsed.facebookCaption) facebookCaption = parsed.facebookCaption.trim();
        } catch {
          // If not valid JSON, treat rawText as hookText
          hookText = rawText;
        }
      }
    } catch (aiErr) {
      console.warn("AI Hook/Caption generation failed, continuing with fallback:", aiErr);
    }

    // Fallback hook if AI failed or empty
    if (!hookText) {
      hookText = `BREAKING NEWS: ${fetchedData.title}. A shocking update has just emerged regarding this breaking story as authorities reveal critical details that changes everything. Full story details and updates inside... (Click link in caption to read full story!)`;
    }

    // Fallback / formatting for facebookCaption
    if (!facebookCaption) {
      facebookCaption = `🚨 BREAKING: ${fetchedData.title}\n\n${fetchedData.excerpt || "A shocking developing story has sparked intense scrutiny as unexpected details emerge. Authorities continue to investigate new evidence."}\n\n👇 Read the full story and critical updates here:\n👉 Link: ${fetchedData.url}\n\n#BreakingNews #NewsAlert #Trending #ViralNews`;
    } else {
      if (facebookCaption.includes("[URL]")) {
        facebookCaption = facebookCaption.replace(/\[URL\]/g, fetchedData.url);
      } else if (!facebookCaption.includes(fetchedData.url)) {
        facebookCaption = `${facebookCaption}\n\n👉 Full Story: ${fetchedData.url}`;
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
        hookText,
        facebookCaption,
      },
    });
  } catch (error) {
    console.error("fetch-direct error:", error);
    const message = error instanceof Error ? error.message : "Lỗi khi lấy dữ liệu bài viết từ URL";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const urlParam = request.nextUrl.searchParams.get("url");
  if (!urlParam) {
    return NextResponse.json({ success: false, error: "Missing url parameter" }, { status: 400 });
  }
  const fakeReq = new NextRequest(request.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: urlParam }),
  });
  return POST(fakeReq);
}
