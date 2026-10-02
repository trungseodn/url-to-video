"use client";
// Fresh build trigger: 2026-09-30 T09:49:45

import { useState, useEffect, useRef } from "react";
import type { ZTTeamArticle } from "@/lib/database";
import { ztteam_generateContentWithRetry, ztteam_formatGeminiError } from "@/lib/gemini";

/** Ghi log API usage sau mỗi lần gọi Gemini */
async function ztteam_logApiUsage(data: {
  article_id: number;
  model: string;
  type: string;
  input_tokens: number;
  output_tokens: number;
}): Promise<void> {
  try {
    await fetch("/api/api-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch {
    /** Lỗi log không ảnh hưởng flow chính */
  }
}

/** Gemini API types */
interface ZTTeamScriptData {
  title: string;
  script: string;
  socialPost: string;
  largeTitle: string;
  smallTitle: string;
  hookText: string;
  contentNew: string;
}

/** Section card wrapper */
function ZTTeamCard({
  title,
  children,
  accent,
}: {
  title: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      <div
        className={`px-5 py-3 border-b border-slate-800 ${accent ? "bg-purple-500/10" : "bg-slate-800/30"}`}
      >
        <p
          className={`text-xs font-bold uppercase tracking-wider ${accent ? "text-purple-400" : "text-slate-400"}`}
        >
          {title}
        </p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/** Compare row: gốc vs mới */
function ZTTeamCompareRow({
  label,
  original,
  generated,
}: {
  label: string;
  original: React.ReactNode;
  generated: React.ReactNode;
}) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-800 bg-slate-800/30">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {label}
        </p>
      </div>
      <div className="grid grid-cols-2 divide-x divide-slate-800">
        <div className="p-4">
          <p className="text-xs font-semibold text-slate-500 mb-2">Gốc</p>
          {original}
        </div>
        <div className="p-4">
          <p className="text-xs font-semibold text-purple-400 mb-2">Mới</p>
          {generated}
        </div>
      </div>
    </div>
  );
}

/** Chèn ảnh vào sau block đầu tiên của content */
function ztteam_buildContentNew(
  contentHtml: string,
  imagePath: string | null,
): string {
  if (!imagePath) return contentHtml;
  /** Strip query string */
  const cleanPath = imagePath.split("?")[0];
  const imageTag = `<figure class="wp-block-image aligncenter"><img src="${cleanPath}" alt="featured image" /></figure>`;
  /** Tìm closing tag đầu tiên */
  const closingTags = ["</p>", "</h2>", "</h3>", "</h4>"];
  let firstEnd = -1;
  let tagLen = 0;
  for (const tag of closingTags) {
    const idx = contentHtml.indexOf(tag);
    if (idx !== -1 && (firstEnd === -1 || idx < firstEnd)) {
      firstEnd = idx;
      tagLen = tag.length;
    }
  }
  if (firstEnd === -1) return `${imageTag}\n${contentHtml}`;
  return (
    contentHtml.substring(0, firstEnd + tagLen) +
    "\n" +
    imageTag +
    "\n" +
    contentHtml.substring(firstEnd + tagLen)
  );
}

export default function ZTTeamGeneratePage() {
  const [articles, setArticles] = useState<ZTTeamArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ZTTeamArticle | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scriptData, setScriptData] = useState<ZTTeamScriptData | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [enableScript, setEnableScript] = useState(false);
  const [enableAudio, setEnableAudio] = useState(false);
  const audioRef = useRef<string | null>(null);
  const audioPathRef = useRef<string | null>(null);
  const imagePathRef = useRef<string | null>(null);

  /** Fetch pending articles */
  const ztteam_fetchPending = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/queue");
      const json = await res.json();
      if (json.success) {
        const pending = json.data.filter(
          (a: ZTTeamArticle) =>
            a.status === "pending" || a.status === "rejected",
        );
        setArticles(pending);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    ztteam_fetchPending();
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) URL.revokeObjectURL(audioRef.current);
    };
  }, []);

  /** Select article */
  const ztteam_handleSelect = (article: ZTTeamArticle) => {
    setSelected(article);
    setScriptData(null);
    setUploadedImage(null);
    setGeneratedAudio(null);
    setError(null);
    setSavedId(null);
    setShowOriginal(false);
    audioPathRef.current = null;
    imagePathRef.current = null;
  };

  /** Xử lý upload ảnh từ file */
  const ztteam_handleImageUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setUploadedImage(base64);
      /** Lưu ảnh xuống file ngay */
      const saveRes = await fetch("/api/save-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          articleId: selected?.id,
        }),
      });
      const saveJson = await saveRes.json();
      if (saveJson.success) {
        imagePathRef.current = saveJson.imagePath;
      }
    };
    reader.readAsDataURL(file);
  };

  /** Xử lý paste ảnh từ clipboard */
  const ztteam_handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) await ztteam_handleImageUpload(file);
        break;
      }
    }
  };

  /** Generate */
  const ztteam_handleGenerate = async () => {
    if (!selected) return;
    setIsGenerating(true);
    setError(null);
    setScriptData(null);
    setGeneratedAudio(null);
    audioPathRef.current = null;

    try {
      const { GoogleGenAI, Type, Modality } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || "",
      });

      /** Step 1: Script (Có tự động retry khi bị 503 High Demand và fallback sang gemini-2.0-flash / 1.5-flash) */
      const { response: scriptResponse, modelUsed } = await ztteam_generateContentWithRetry(ai, {
        primaryModel: "gemini-2.5-flash",
        fallbackModels: ["gemini-2.0-flash", "gemini-1.5-flash"],
        contents: {
          parts: [{ text: `Nội dung yêu cầu: ${selected.content_original}` }],
        },
        config: {
          systemInstruction: `Bạn là AI chuyên tạo kịch bản video ngắn và bài đăng mạng xã hội (Fanpage).
Nhiệm vụ: Dựa vào NỘI DUNG và HÌNH ẢNH (nếu có) được cung cấp, hãy tạo kịch bản voice-over cho video ngắn dưới 60 giây VÀ một bài đăng Fanpage kèm theo.
QUAN TRỌNG: TOÀN BỘ NỘI DUNG (Title, Script, Social Post, Large Title, Small Title) PHẢI ĐƯỢC VIẾT BẰNG TIẾNG ANH (ENGLISH).
LƯU Ý CỰC KỲ QUAN TRỌNG: TUYỆT ĐỐI KHÔNG sử dụng các từ ngữ vi phạm chính sách của Facebook/TikTok (ví dụ: các từ liên quan đến bạo lực, tình dục, cam kết 100%, chữa bệnh, thuốc lá, rượu bia, phân biệt chủng tộc, thù địch, hoặc các từ ngữ nhạy cảm khác dễ bị bóp tương tác). Hãy dùng từ ngữ thay thế an toàn.

Yêu cầu kịch bản video (Script):
1. GIỌNG ĐIỆU (TONE): Voice-over phải được viết theo phong cách TIN TỨC (News-style) - chuyên nghiệp, khách quan, dứt khoát.
2. ĐƯA THÔNG TIN CHÍNH LÊN ĐẦU: Nội dung quan trọng nhất, tin tức cốt lõi phải được trình bày ngay lập tức.
3. Câu mở đầu PHẢI có HOOK gây chú ý mạnh trong 3 giây đầu (như một Breaking News) và đi thẳng vào vấn đề chính.
4. Tổng thời lượng đọc kịch bản dưới 60 giây (khoảng 100-130 từ).
5. Chỉ trả về nội dung voice-over liền mạch. ${enableScript ? "" : "(LƯU Ý: Người dùng KHÔNG yêu cầu Script voice-over, hãy để giá trị thuộc tính script là chuỗi rỗng \"\")"}

Yêu cầu bài đăng Fanpage (Social Post):
1. ĐƯA CHỦ ĐỀ CHÍNH LÊN ĐẦU TIÊN: Dòng đầu tiên của bài đăng PHẢI LÀ 1 dòng duy nhất nêu bật chủ đề chính của nội dung, Lưu ý: Nếu có nhân vật chính hãy ưu tiên đưa lên dòng đầu tiên, LUÔN VIẾT HOA DÒNG NÀY VÀ PHẢI XUỐNG DÒNG, THÊM ICON PHÙ HỢP VÀO ĐẦU DÒNG.
2. Viết một bài đăng hấp dẫn để đăng kèm video trên Facebook Fanpage/Instagram/TikTok.
3. Bao gồm tiêu đề thu hút, nội dung tóm tắt giá trị của video, lời kêu gọi hành động (CTA) và các hashtag phù hợp.
4. Sử dụng emoji hợp lý để tăng tương tác.
5. Đảm bảo 100% nội dung bài đăng tuân thủ tiêu chuẩn cộng đồng của Facebook, không chứa từ khóa bị cấm.

Yêu cầu về Tiêu đề hình ảnh (Large Title & Small Title):
1. Large Title: Một tiêu đề cực kỳ ngắn gọn (2-4 từ), gây sốc hoặc tóm tắt nội dung chính (ví dụ: "BREAKING NEWS", "MARKET CRASH", "NEW DISCOVERY").
2. Small Title: Một dòng mô tả ngắn (4-7 từ) bổ sung cho Large Title.

Yêu cầu về Câu Hook Video (Hook Text ~50 từ):
1. Viết một đoạn Hook bằng Tiếng Anh khoảng 45-55 từ (~50 từ).
2. Phong cách Breaking News kích thích tò mò tột độ, tạo sự lấp lửng/bỏ ngỏ (cliffhanger).
3. Khiến người xem sau khi đọc xong bắt buộc phải click vào link bài viết bên dưới để tìm câu trả lời.

Yêu cầu về Tiêu đề bài viết (Title):
1. Dựa trên tiêu đề gốc của bài, viết lại bằng Tiếng Anh theo phong cách clickbait news.
2. Phải hấp dẫn, kích thích click, gây tò mò, phù hợp site tin tức nóng hổi.
3. Độ dài 8-15 từ.
4. KHÔNG viết kiểu tiêu đề video ngắn (2-4 từ).
5. Ví dụ tốt: "Trump's Shocking Decision Leaves Washington in Chaos — Here's What Really Happened"

Yêu cầu nội dung bài viết web (Content New):
1. Dựa trên nội dung gốc, viết lại hoàn toàn bằng Tiếng Anh theo phong cách báo chí chuyên nghiệp.
2. Hấp dẫn, thu hút, SEO-friendly, phù hợp đăng web tin tức.
3. Cấu trúc rõ ràng với heading, đoạn văn, danh sách nếu cần.
4. TUYỆT ĐỐI không dùng từ ngữ vi phạm chính sách Google AdSense (bạo lực, tình dục, cờ bạc, thuốc lá, rượu bia...).
5. Trả về HTML thuần dùng thẻ <p>, <h2>, <h3>, <strong>, <ul>, <li>. KHÔNG có <html>, <head>, <body>.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description:
                  "Tiêu đề bài viết tin tức (bằng Tiếng Anh). Dựa trên title gốc, viết lại theo phong cách clickbait news - hấp dẫn, kích thích click, gây tò mò, phù hợp với site tin tức nóng hổi. Độ dài 8-15 từ. KHÔNG viết kiểu tiêu đề video ngắn.",
              },
              script: {
                type: Type.STRING,
                description:
                  "Toàn bộ nội dung voice-over liền mạch bằng Tiếng Anh, phong cách bản tin thời sự. Để rỗng \"\" nếu người dùng không chọn tạo script.",
              },
              socialPost: {
                type: Type.STRING,
                description:
                  "Nội dung bài đăng Fanpage (caption) bằng Tiếng Anh, bao gồm CTA và hashtags.",
              },
              largeTitle: {
                type: Type.STRING,
                description: "Tiêu đề lớn cho hình ảnh (2-4 từ, Tiếng Anh)",
              },
              smallTitle: {
                type: Type.STRING,
                description: "Tiêu đề nhỏ cho hình ảnh (4-7 từ, Tiếng Anh)",
              },
              hookText: {
                type: Type.STRING,
                description:
                  "Đoạn Hook video dài khoảng 45-55 từ (~50 từ) bằng Tiếng Anh. Phong cách Breaking News kích thích tò mò cực độ, tạo lấp lửng (cliffhanger) để hối thúc người xem click vào link bài viết bên dưới.",
              },
              contentNew: {
                type: Type.STRING,
                description:
                  "Nội dung bài viết tin tức bằng Tiếng Anh. Dựa trên nội dung gốc, viết lại hoàn toàn theo phong cách báo chí chuyên nghiệp, hấp dẫn, SEO-friendly. TUYỆT ĐỐI không dùng từ ngữ vi phạm chính sách Google AdSense hoặc Facebook. Trả về HTML thuần (dùng <p>, <h2>, <h3>, <strong>, <ul>, <li>). KHÔNG có <html>, <head>, <body>.",
              },
            },
            required: [
              "title",
              "script",
              "socialPost",
              "largeTitle",
              "smallTitle",
              "hookText",
              "contentNew",
            ],
          },
        },
      });

      const parsedScript = JSON.parse(
        scriptResponse.text || "{}",
      ) as ZTTeamScriptData;

      if (!enableScript) {
        parsedScript.script = "";
      }

      setScriptData(parsedScript);

      /** Log script generation */
      const scriptUsage = scriptResponse.usageMetadata;
      await ztteam_logApiUsage({
        article_id: selected.id,
        model: modelUsed,
        type: "script",
        input_tokens: scriptUsage?.promptTokenCount || 0,
        output_tokens: scriptUsage?.candidatesTokenCount || 0,
      });

      /** Generate audio (chỉ khi người dùng chọn tích enableAudio và có kịch bản) */
      if (enableAudio && parsedScript.script) {
        const audioResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [
            {
              parts: [
                {
                  text: `Say professionally like a news anchor: ${parsedScript.script}`,
                },
              ],
            },
          ],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: "Zephyr" },
              },
            },
          },
        });

        const base64Audio =
          audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          const binaryString = window.atob(base64Audio);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const sampleRate = 24000;
          const numChannels = 1;
          const bitsPerSample = 16;
          const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
          const blockAlign = numChannels * (bitsPerSample / 8);
          const wavHeader = new ArrayBuffer(44);
          const view = new DataView(wavHeader);

          view.setUint8(0, 0x52);
          view.setUint8(1, 0x49);
          view.setUint8(2, 0x46);
          view.setUint8(3, 0x46);
          view.setUint32(4, 36 + len, true);
          view.setUint8(8, 0x57);
          view.setUint8(9, 0x41);
          view.setUint8(10, 0x56);
          view.setUint8(11, 0x45);
          view.setUint8(12, 0x66);
          view.setUint8(13, 0x6d);
          view.setUint8(14, 0x74);
          view.setUint8(15, 0x20);
          view.setUint32(16, 16, true);
          view.setUint16(20, 1, true);
          view.setUint16(22, numChannels, true);
          view.setUint32(24, sampleRate, true);
          view.setUint32(28, byteRate, true);
          view.setUint16(32, blockAlign, true);
          view.setUint16(34, bitsPerSample, true);
          view.setUint8(36, 0x64);
          view.setUint8(37, 0x61);
          view.setUint8(38, 0x74);
          view.setUint8(39, 0x61);
          view.setUint32(40, len, true);

          const blob = new Blob([wavHeader, bytes], { type: "audio/wav" });
          const audioUrl = URL.createObjectURL(blob);
          if (audioRef.current) URL.revokeObjectURL(audioRef.current);
          audioRef.current = audioUrl;
          setGeneratedAudio(audioUrl);

          const saveRes = await fetch("/api/save-audio", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audioBase64: base64Audio,
              articleId: selected.id,
            }),
          });
          const saveJson = await saveRes.json();
          if (saveJson.success) {
            audioPathRef.current = saveJson.audioPath;
            /** Log audio generation */
            const audioUsage = audioResponse.usageMetadata;
            await ztteam_logApiUsage({
              article_id: selected.id,
              model: "gemini-2.5-flash-preview-tts",
              type: "audio",
              input_tokens: audioUsage?.promptTokenCount || 0,
              output_tokens: audioUsage?.candidatesTokenCount || 0,
            });
          }
        }
      }
    } catch (err) {
      setError(ztteam_formatGeminiError(err));
    } finally {
      setIsGenerating(false);
    }
  };

  /** Lưu vào SQLite */
  const ztteam_handleSave = async () => {
    if (!selected || !scriptData) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/queue/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_generated",
          generatedContent: {
            title_new: scriptData.title,
            script: scriptData.script,
            social_post: scriptData.socialPost,
            image_new: imagePathRef.current || null,
            audio_path: audioPathRef.current || null,
            large_title: scriptData.largeTitle || null,
            small_title: scriptData.smallTitle || null,
            hook_text: scriptData.hookText || null,
            content_new: ztteam_buildContentNew(
              scriptData.contentNew || "",
              imagePathRef.current || null,
            ),
          },
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSavedId(selected.id);
        await ztteam_fetchPending();
        setSelected(null);
        setScriptData(null);
        setUploadedImage(null);
        setGeneratedAudio(null);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/** Header */}
      <header>
        <h2 className="text-3xl font-black tracking-tight mb-1">AI Generate</h2>
        <p className="text-slate-400">Chọn bài viết để AI tạo nội dung mới</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/** Cột trái - Danh sách */}
        <div className="lg:col-span-1 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 bg-slate-800/30 flex items-center justify-between">
            <h3 className="font-bold text-sm">Chờ xử lý</h3>
            <span className="text-xs font-bold px-2 py-1 rounded-full text-amber-500 bg-amber-500/10">
              {articles.length} bài
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 gap-3">
              <div className="w-5 h-5 border-2 border-slate-700 border-t-[#1337ec] rounded-full animate-spin" />
            </div>
          ) : articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <span className="material-symbols-outlined text-slate-600 text-4xl">
                check_circle
              </span>
              <p className="text-slate-500 text-xs">Không có bài chờ xử lý</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800 max-h-[70vh] overflow-y-auto">
              {articles.map((article) => (
                <div
                  key={article.id}
                  onClick={() => ztteam_handleSelect(article)}
                  className={`p-4 flex gap-3 cursor-pointer transition-all ${
                    selected?.id === article.id
                      ? "bg-[#1337ec]/10 border-l-2 border-[#1337ec]"
                      : "hover:bg-slate-800/50 border-l-2 border-transparent"
                  }`}
                >
                  <div className="w-14 h-10 rounded-lg overflow-hidden bg-slate-800 shrink-0">
                    {article.image_original ? (
                      <img
                        src={article.image_original}
                        alt=""
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-slate-600 text-xs">
                          image
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate leading-snug">
                      {article.title_original}
                    </p>
                    <span
                      className={`text-xs mt-1 inline-block font-bold ${
                        article.status === "rejected"
                          ? "text-red-400"
                          : "text-amber-400"
                      }`}
                    >
                      {article.status === "rejected" ? "Rejected" : "Pending"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/** Cột phải - Workspace */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {!selected ? (
            <div className="bg-slate-900 rounded-xl border border-slate-800 border-dashed flex flex-col items-center justify-center py-24 gap-3">
              <span className="material-symbols-outlined text-slate-600 text-5xl">
                touch_app
              </span>
              <p className="text-slate-400 text-sm">Chọn bài viết để bắt đầu</p>
            </div>
          ) : (
            <>
              {/** So sánh ảnh */}
              <ZTTeamCompareRow
                label="Ảnh"
                original={
                  selected.image_original ? (
                    <img
                      src={selected.image_original}
                      alt="Original"
                      className="w-full aspect-video object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-full aspect-video bg-slate-800 rounded-lg flex items-center justify-center">
                      <span className="material-symbols-outlined text-slate-600">
                        image
                      </span>
                    </div>
                  )
                }
                generated={
                  <div
                    onPaste={ztteam_handlePaste}
                    className="flex flex-col gap-2"
                  >
                    {uploadedImage ? (
                      <img
                        src={uploadedImage}
                        alt="Uploaded"
                        className="w-full aspect-video object-contain rounded-lg"
                      />
                    ) : (
                      <div className="w-full aspect-video bg-slate-800 rounded-lg flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-700">
                        <span className="material-symbols-outlined text-slate-500 text-3xl">
                          upload
                        </span>
                        <p className="text-xs text-slate-500 text-center px-4">
                          Upload hoặc Paste ảnh vào đây
                        </p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors">
                        <span className="material-symbols-outlined text-sm">
                          upload_file
                        </span>
                        Chọn file
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) ztteam_handleImageUpload(file);
                          }}
                        />
                      </label>
                      {uploadedImage && (
                        <button
                          onClick={() => {
                            setUploadedImage(null);
                            imagePathRef.current = null;
                          }}
                          className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-semibold transition-colors"
                        >
                          Xóa
                        </button>
                      )}
                    </div>
                  </div>
                }
              />

              {/** So sánh tiêu đề */}
              <ZTTeamCompareRow
                label="Tiêu đề"
                original={
                  <p className="text-sm font-semibold text-slate-300 leading-snug">
                    {selected.title_original}
                  </p>
                }
                generated={
                  scriptData ? (
                    <p className="text-sm font-bold text-white leading-snug">
                      {scriptData.title}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-600 italic">Chưa có</p>
                  )
                }
              />

              {/** Nội dung gốc toggle */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <button
                  onClick={() => setShowOriginal(!showOriginal)}
                  className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Nội dung gốc
                  </p>
                  <span className="material-symbols-outlined text-slate-500 text-sm">
                    {showOriginal ? "expand_less" : "expand_more"}
                  </span>
                </button>
                {showOriginal && (
                  <div className="px-5 pb-5">
                    {selected.content_html ? (
                      <div
                        className="text-sm text-slate-300 leading-relaxed prose prose-invert prose-img:rounded-xl prose-img:w-full max-w-none max-h-64 overflow-y-auto"
                        dangerouslySetInnerHTML={{
                          __html: selected.content_html,
                        }}
                      />
                    ) : (
                      <p className="text-sm text-slate-300 leading-relaxed max-h-64 overflow-y-auto">
                        {selected.content_original}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/** Script */}
              <ZTTeamCard title="Script Voice-over" accent={!!scriptData}>
                {scriptData ? (
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {scriptData.script}
                  </p>
                ) : (
                  <p className="text-sm text-slate-600 italic">
                    Chưa có — nhấn Generate
                  </p>
                )}
              </ZTTeamCard>

              {/** Audio */}
              <ZTTeamCard title="Audio" accent={!!generatedAudio}>
                {generatedAudio ? (
                  <audio
                    src={generatedAudio}
                    controls
                    className="w-full accent-[#1337ec]"
                  />
                ) : isGenerating ? (
                  <div className="flex items-center gap-3 py-2">
                    <div className="w-4 h-4 border-2 border-slate-600 border-t-purple-400 rounded-full animate-spin" />
                    <p className="text-xs text-slate-500">Đang tạo audio...</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600 italic">
                    Chưa có — nhấn Generate
                  </p>
                )}
              </ZTTeamCard>

              {/** Social Post */}
              <ZTTeamCard title="Social Post" accent={!!scriptData}>
                {scriptData ? (
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                    {scriptData.socialPost}
                  </p>
                ) : (
                  <p className="text-sm text-slate-600 italic">
                    Chưa có — nhấn Generate
                  </p>
                )}
              </ZTTeamCard>

              {/** Content mới */}
              <ZTTeamCard
                title="Nội dung bài viết web"
                accent={!!scriptData?.contentNew}
              >
                {scriptData?.contentNew ? (
                  <div
                    className="text-sm text-slate-300 leading-relaxed prose prose-invert prose-headings:text-white prose-p:text-slate-300 prose-strong:text-white prose-li:text-slate-300 max-w-none max-h-96 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: scriptData.contentNew }}
                  />
                ) : (
                  <p className="text-sm text-slate-600 italic">
                    Chưa có — nhấn Generate
                  </p>
                )}
              </ZTTeamCard>

              {/** Error */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
                  ⚠️ {error}
                </div>
              )}

              {/** Checkbox tùy chọn AI Generate */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 flex flex-wrap items-center justify-between gap-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Tùy chọn tạo thêm
                </p>
                <div className="flex items-center gap-5">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={enableScript}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setEnableScript(checked);
                        if (!checked) setEnableAudio(false);
                      }}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-[#1337ec] focus:ring-[#1337ec] cursor-pointer"
                    />
                    <span>🎙️ Kịch bản Voice-over</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={enableAudio}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setEnableAudio(checked);
                        if (checked) setEnableScript(true);
                      }}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-[#1337ec] focus:ring-[#1337ec] cursor-pointer"
                    />
                    <span>🔊 Audio Voice-over (TTS)</span>
                  </label>
                </div>
              </div>

              {/** Actions */}
              <div className="flex gap-3">
                <button
                  onClick={ztteam_handleGenerate}
                  disabled={isGenerating}
                  className="flex-1 py-3 bg-gradient-to-r from-[#1337ec] to-purple-600 hover:from-[#1337ec]/90 hover:to-purple-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      AI đang xử lý...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">
                        auto_awesome
                      </span>
                      {scriptData ? "Generate lại" : "Generate"}
                    </>
                  )}
                </button>

                {scriptData && (
                  <button
                    onClick={ztteam_handleSave}
                    disabled={isSaving}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Đang lưu...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">
                          save
                        </span>
                        Lưu & Review
                      </>
                    )}
                  </button>
                )}
              </div>

              {savedId && (
                <p className="text-center text-sm text-emerald-400 font-semibold">
                  ✓ Đã lưu! Bài đã chuyển sang Review.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
