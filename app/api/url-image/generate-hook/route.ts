import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { ztteam_generateContentWithRetry } from "@/lib/gemini";

const FALLBACK_HOOKS = [
  "Officials reveal critical new details discovered right at the scene...",
  "A shocking discovery has just changed the entire investigation today...",
  "Authorities uncover what happened moments before she mysteriously vanished...",
  "Key evidence finally discovered that nobody expected to find here...",
  "New findings emerge as investigators take a closer look today...",
  "Surveillance footage uncovers crucial moments everyone has been searching for...",
  "Investigators discover a vital piece of evidence overlooked for days...",
  "Emergency responders share a remarkable update after tense search operation...",
  "Witnesses come forward with unexpected details changing the whole story...",
  "Newly uncovered clues raise urgent questions across the entire community...",
];

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const {
      title = "",
      url = "",
      excerpt = "",
      siteName = "",
      currentHook = "",
    } = await request.json();

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const promptText = `Article Title: ${title}
Source: ${siteName}
URL: ${url}
Excerpt: ${excerpt}
Current Hook (generate a DIFFERENT, fresh angle): ${currentHook}

Nhiệm vụ: Hãy tạo lại MỘT TIÊU ĐỀ HOOK MỚI BẰNG TIẾNG ANH chuyên dùng cho ảnh ghép viral Facebook:
1. hookText: Độ dài CHUẨN KHOẢNG 8 ĐẾN 12 TỪ (~10 từ).
- Mục đích: Kích thích sự tò mò cao độ của người xem, thôi thúc họ muốn bấm vào bài viết xem chi tiết.
- TUYỆT ĐỐI TUÂN THỦ TIÊU CHUẨN CỘNG ĐỒNG FACEBOOK:
  + KHÔNG dùng từ ngữ máu me, bạo lực ghê rợn, phản cảm, xúc phạm hoặc giật tít sai sự thật.
  + Dùng văn phong báo chí điều tra cuốn hút, khách quan, an toàn tuyệt đối cho Fanpage.
- Ví dụ mẫu chuẩn:
  + "Officials reveal critical new details discovered right at the scene..."
  + "Authorities uncover what happened moments before she mysteriously disappeared..."
  + "A shocking discovery has just changed the entire investigation today..."

2. badgeText: Nhãn tin tức 1-3 từ ngắn gọn viết HOA (ví dụ: BREAKING, UPDATE, DISCOVERY, EXCLUSIVE, INVESTIGATION).

Trả về DUY NHẤT một chuỗi JSON hợp lệ không kèm markdown:
{
  "hookText": "string",
  "badgeText": "string"
}`;

        const { response } = await ztteam_generateContentWithRetry(ai, {
          primaryModel: "gemini-2.5-flash",
          fallbackModels: ["gemini-2.0-flash", "gemini-1.5-flash"],
          contents: {
            parts: [{ text: promptText }],
          },
        });

        const raw = (response.text || "").trim();
        const cleanJson = raw.replace(/```json\n?|\n?```/g, "").trim();
        try {
          const parsed = JSON.parse(cleanJson);
          if (parsed.hookText && parsed.hookText.trim()) {
            return NextResponse.json({
              success: true,
              data: {
                hookText: parsed.hookText.trim(),
                badgeText: (parsed.badgeText || "BREAKING NEWS").trim().toUpperCase(),
              },
            });
          }
        } catch {
          if (raw && raw.length > 10 && raw.length < 200) {
            return NextResponse.json({
              success: true,
              data: {
                hookText: raw.replace(/^["']|["']$/g, "").trim(),
                badgeText: "BREAKING NEWS",
              },
            });
          }
        }
      } catch (geminiErr) {
        console.warn("Gemini generate-hook failed, using fallback templates:", geminiErr);
      }
    }

    // Fallback template selection
    const filtered = FALLBACK_HOOKS.filter((h) => h.toLowerCase() !== currentHook.trim().toLowerCase());
    const randomHook = filtered[Math.floor(Math.random() * filtered.length)] || FALLBACK_HOOKS[0];

    const badges = ["BREAKING NEWS", "EXCLUSIVE", "UPDATE", "INVESTIGATION", "JUST IN"];
    const randomBadge = badges[Math.floor(Math.random() * badges.length)];

    return NextResponse.json({
      success: true,
      data: {
        hookText: randomHook,
        badgeText: randomBadge,
      },
    });
  } catch (error) {
    console.error("generate-hook error:", error);
    const message = error instanceof Error ? error.message : "Lỗi khi tạo lại hook";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
