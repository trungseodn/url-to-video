import { GoogleGenAI } from "@google/genai";

/** Model fallback priority for Gemini text models */
const DEFAULT_TEXT_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

/** Helper wrapper cho Gemini API với tự động retry khi gặp lỗi 503 (High demand) và chuyển model fallback */
export async function ztteam_generateContentWithRetry(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
    primaryModel?: string;
    fallbackModels?: string[];
    maxRetriesPerModel?: number;
  }
) {
  const models = [
    params.primaryModel || DEFAULT_TEXT_MODELS[0],
    ...(params.fallbackModels || DEFAULT_TEXT_MODELS.slice(1)),
  ];

  let lastError: any = null;

  for (const model of models) {
    const maxRetries = params.maxRetriesPerModel || 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });

        return { response, modelUsed: model };
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err || "");
        const status = err?.status || "";
        const is503 =
          errMsg.includes("503") ||
          errMsg.includes("UNAVAILABLE") ||
          errMsg.includes("high demand") ||
          status === "UNAVAILABLE";

        if (is503 && attempt < maxRetries) {
          // Tạm dừng 2 giây rồi thử lại model hiện tại
          await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
          continue;
        }

        // Nếu không phải lỗi 503 tạm thời hoặc đã hết lượt retry cho model này, thử model fallback tiếp theo
        break;
      }
    }
  }

  throw lastError;
}

/** Chuyển đổi thông báo lỗi Gemini thành Tiếng Việt thân thiện */
export function ztteam_formatGeminiError(error: any): string {
  const errMsg = String(error?.message || error || "");
  if (errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || errMsg.includes("high demand")) {
    return "Hệ thống Gemini AI của Google đang bị quá tải tạm thời (Lỗi 503). Hệ thống đã tự động thử lại nhiều lần nhưng Google vẫn chưa phản hồi. Vui lòng bấm thử lại sau 10-30 giây.";
  }
  if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
    return "Đã đạt giới hạn số lượng yêu cầu Gemini API (Quota Exceeded). Vui lòng đợi khoảng 1 phút rồi thử lại.";
  }
  if (errMsg.includes("API key")) {
    return "Khóa Google Gemini API Key không hợp lệ hoặc bị thiếu. Vui lòng kiểm tra file .env.local";
  }
  return errMsg || "Có lỗi không xác định từ Gemini AI";
}
