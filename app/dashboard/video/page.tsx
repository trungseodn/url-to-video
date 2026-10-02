"use client";
// Fresh build trigger: 2026-09-30 T17:34:40
import { useState, useEffect, useRef, useCallback } from "react";
import type { ZTTeamArticle } from "@/lib/database";

/** Copy text to clipboard */
async function ztteam_copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

/** Format social post với Readmore link */
function ztteam_formatSocialPost(
  socialPost: string,
  wpLink: string | null,
): string {
  if (!wpLink || !socialPost) return socialPost || "";
  const sentences = socialPost.split("\n");
  if (sentences.length === 0) return socialPost;
  sentences.splice(1, 0, `\nReadmore: ${wpLink}\n`);
  return sentences.join("\n");
}

/** Trạng thái từng bài trong batch */
interface ZTTeamBatchItem {
  id: number;
  title: string;
  status: "waiting" | "processing" | "done" | "error";
  error?: string;
}

export default function ZTTeamVideoPage() {
  const [articles, setArticles] = useState<ZTTeamArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ZTTeamArticle | null>(null);
  const [filter, setFilter] = useState<"approved" | "done">("approved");
  
  // Video Mode State: "hook" (Khung trên ảnh, dưới hook text) or "voice" (Voice audio)
  const [videoMode, setVideoMode] = useState<"hook" | "voice">("hook");
  
  // Hook Video settings
  const [hookText, setHookText] = useState<string>("");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "1:1">("9:16");
  const [duration, setDuration] = useState<number>(7);

  const [isCreatingVideo, setIsCreatingVideo] = useState(false);
  const [isGeneratingAiHook, setIsGeneratingAiHook] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [pollingId, setPollingId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [markingDone, setMarkingDone] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isPreviewingImage, setIsPreviewingImage] = useState(false);

  /** Preview Ảnh Frame (0.5s) */
  const ztteam_handlePreviewImage = async () => {
    if (!selected) return;
    setIsPreviewingImage(true);
    setVideoError(null);
    try {
      const res = await fetch("/api/preview-hook-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          hookText,
          aspectRatio,
        }),
      });
      const json = await res.json();
      if (json.success && json.data.imageUrl) {
        setPreviewImageUrl(json.data.imageUrl);
      } else if (json.error) {
        setVideoError(json.error);
      }
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : "Có lỗi khi tạo ảnh xem trước");
    } finally {
      setIsPreviewingImage(false);
    }
  };

  /** AI Viết Hook Tò Mò ~50 từ */
  const ztteam_handleGenerateAiHook = async () => {
    if (!selected) return;
    setIsGeneratingAiHook(true);
    setVideoError(null);
    try {
      const res = await fetch("/api/generate-hook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id }),
      });
      const json = await res.json();
      if (json.success && json.data.hookText) {
        setHookText(json.data.hookText);
      } else if (json.error) {
        setVideoError(json.error);
      }
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : "Có lỗi khi tạo Hook");
    } finally {
      setIsGeneratingAiHook(false);
    }
  };

  /** Batch states */
  const [showBatch, setShowBatch] = useState(false);
  const [batchMode, setBatchMode] = useState<"hook" | "voice">("hook");
  const [batchItems, setBatchItems] = useState<ZTTeamBatchItem[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchCurrentIndex, setBatchCurrentIndex] = useState<number>(-1);
  const batchStopRef = useRef(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  /** Fetch articles */
  const ztteam_fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/queue");
      const json = await res.json();
      if (json.success) {
        const filtered = json.data.filter(
          (a: ZTTeamArticle) =>
            a.status === "approved" ||
            a.status === "processing" ||
            a.status === "done",
        );
        setArticles(filtered);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    ztteam_fetchArticles();
  }, [ztteam_fetchArticles]);

  /** Tự động gợi ý Hook text súc tích (~30 từ) khi đổi bài được chọn */
  useEffect(() => {
    if (!selected) {
      setHookText("");
      return;
    }
    if (selected.hook_text) {
      setHookText(selected.hook_text);
    } else {
      const parts: string[] = [];
      if (selected.large_title && selected.small_title) {
        parts.push(`${selected.large_title} — ${selected.small_title}`);
      } else if (selected.large_title) {
        parts.push(selected.large_title);
      } else if (selected.title_new) {
        parts.push(selected.title_new);
      }

      if (selected.script) {
        const sentences = selected.script.split(/(?<=[.!?])\s+/);
        parts.push(sentences.slice(0, 2).join(" "));
      } else if (selected.content_original) {
        const cleanContent = selected.content_original.replace(/<[^>]+>/g, " ");
        const sentences = cleanContent.split(/(?<=[.!?])\s+/);
        parts.push(sentences.slice(0, 2).join(" "));
      }

      const combinedText = parts.join(" ").replace(/\s+/g, " ").trim();
      setHookText(combinedText || selected.title_original || "");
    }
  }, [selected]);

  /** Polling check video status (cho Voice Mode) */
  const ztteam_waitForVideo = useCallback((id: number): Promise<boolean> => {
    return new Promise((resolve) => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/video-status?id=${id}`);
          const json = await res.json();
          if (json.success && json.data.ready) {
            clearInterval(interval);
            pollingRef.current = null;
            resolve(true);
          }
        } catch {
          /** Polling lỗi thì bỏ qua */
        }
      }, 5000);
      pollingRef.current = interval;
    });
  }, []);

  /** Polling cho single video voice */
  const ztteam_startPolling = useCallback(
    (id: number) => {
      setPollingId(id);
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/video-status?id=${id}`);
          const json = await res.json();
          if (json.success && json.data.ready) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setPollingId(null);
            setIsCreatingVideo(false);
            await ztteam_fetchArticles();
            const refreshRes = await fetch("/api/queue");
            const refreshJson = await refreshRes.json();
            if (refreshJson.success) {
              const updated = refreshJson.data.find(
                (a: ZTTeamArticle) => a.id === id,
              );
              if (updated) setSelected(updated);
            }
          }
        } catch {
          /** Polling lỗi thì bỏ qua */
        }
      }, 5000);
    },
    [ztteam_fetchArticles],
  );

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  /** Tạo video đơn (Hook Mode hoặc Voice Mode) */
  const ztteam_handleCreateVideo = async () => {
    if (!selected) return;
    setIsCreatingVideo(true);
    setVideoError(null);

    try {
      if (videoMode === "hook") {
        // Gọi API tạo video Khung trên ảnh + dưới câu hook
        const res = await fetch("/api/create-hook-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: selected.id,
            hookText,
            duration,
            aspectRatio,
          }),
        });
        const json = await res.json();
        if (!json.success) {
          setVideoError(json.error);
          setIsCreatingVideo(false);
          return;
        }

        // Đã hoàn thành ngay lập tức
        setIsCreatingVideo(false);
        await ztteam_fetchArticles();
        const refreshRes = await fetch("/api/queue");
        const refreshJson = await refreshRes.json();
        if (refreshJson.success) {
          const updated = refreshJson.data.find(
            (a: ZTTeamArticle) => a.id === selected.id,
          );
          if (updated) setSelected(updated);
        }
      } else {
        // Voice mode cũ
        const res = await fetch("/api/create-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selected.id }),
        });
        const json = await res.json();
        if (!json.success) {
          setVideoError(json.error);
          setIsCreatingVideo(false);
          return;
        }
        ztteam_startPolling(selected.id);
      }
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : "Có lỗi xảy ra");
      setIsCreatingVideo(false);
    }
  };

  /** Copy social post */
  const ztteam_handleCopySocialPost = async () => {
    if (!selected) return;
    const text = ztteam_formatSocialPost(
      selected.social_post || "",
      selected.wp_link,
    );
    await ztteam_copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /** Xác nhận đã đăng Fanpage */
  const ztteam_handleFanpageDone = async () => {
    if (!selected) return;
    setMarkingDone(true);
    try {
      await fetch(`/api/queue/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_status", status: "done" }),
      });
      await ztteam_fetchArticles();
      setSelected(null);
    } finally {
      setMarkingDone(false);
    }
  };

  /** Mở batch modal */
  const ztteam_openBatch = () => {
    const pendingVideos = articles.filter(
      (a) => a.status === "approved" && !a.video_path,
    );
    const items: ZTTeamBatchItem[] = pendingVideos.map((a) => ({
      id: a.id,
      title: a.title_new || a.title_original || `Bài #${a.id}`,
      status: "waiting",
    }));
    setBatchItems(items);
    setBatchCurrentIndex(-1);
    batchStopRef.current = false;
    setShowBatch(true);
  };

  /** Chạy batch tuần tự */
  const ztteam_handleBatchStart = async () => {
    if (batchItems.length === 0) return;
    setBatchRunning(true);
    batchStopRef.current = false;

    for (let i = 0; i < batchItems.length; i++) {
      if (batchStopRef.current) break;

      const item = batchItems[i];
      setBatchCurrentIndex(i);

      setBatchItems((prev) =>
        prev.map((b, idx) => (idx === i ? { ...b, status: "processing" } : b)),
      );

      try {
        if (batchMode === "hook") {
          // Tạo Hook video nhanh
          const res = await fetch("/api/create-hook-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: item.id,
              duration,
              aspectRatio,
            }),
          });
          const json = await res.json();
          if (!json.success) {
            setBatchItems((prev) =>
              prev.map((b, idx) =>
                idx === i ? { ...b, status: "error", error: json.error } : b,
              ),
            );
            continue;
          }
        } else {
          // Voice mode
          const res = await fetch("/api/create-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: item.id }),
          });
          const json = await res.json();

          if (!json.success) {
            setBatchItems((prev) =>
              prev.map((b, idx) =>
                idx === i ? { ...b, status: "error", error: json.error } : b,
              ),
            );
            continue;
          }

          await ztteam_waitForVideo(item.id);
        }

        if (batchStopRef.current) {
          setBatchItems((prev) =>
            prev.map((b, idx) => (idx === i ? { ...b, status: "waiting" } : b)),
          );
          break;
        }

        setBatchItems((prev) =>
          prev.map((b, idx) => (idx === i ? { ...b, status: "done" } : b)),
        );
      } catch (err) {
        setBatchItems((prev) =>
          prev.map((b, idx) =>
            idx === i
              ? {
                  ...b,
                  status: "error",
                  error: err instanceof Error ? err.message : "Có lỗi xảy ra",
                }
              : b,
          ),
        );
      }
    }

    setBatchRunning(false);
    setBatchCurrentIndex(-1);
    await ztteam_fetchArticles();
  };

  const ztteam_handleBatchStop = () => {
    batchStopRef.current = true;
  };

  const filteredArticles = articles.filter((a) =>
    filter === "approved"
      ? a.status === "approved" || a.status === "processing"
      : a.status === "done",
  );

  const pendingVideoCount = articles.filter(
    (a) => a.status === "approved" && !a.video_path,
  ).length;

  return (
    <div className="flex flex-col gap-8">
      {/** Header */}
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight mb-1">Tạo Video</h2>
          <p className="text-slate-400">
            Tạo Video Khung Trên Ảnh + Khung Dưới Câu Hook hoặc Video Voice
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pendingVideoCount > 0 && (
            <button
              onClick={ztteam_openBatch}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-purple-500/20 transition-all"
            >
              <span className="material-symbols-outlined text-sm">
                video_library
              </span>
              Tạo hàng loạt ({pendingVideoCount})
            </button>
          )}
          <button
            onClick={ztteam_fetchArticles}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition-colors"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Làm mới
          </button>
        </div>
      </header>

      {/** Filter Tabs */}
      <div className="flex items-center gap-2">
        {(["approved", "done"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              filter === tab
                ? "bg-[#1337ec] text-white shadow-md shadow-blue-500/20"
                : "bg-slate-900 text-slate-400 hover:text-slate-100 border border-slate-800"
            }`}
          >
            {tab === "approved" ? "Chờ tạo video" : "Đã hoàn thành"}
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                filter === tab ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
              }`}
            >
              {
                articles.filter((a) =>
                  tab === "approved"
                    ? a.status === "approved" || a.status === "processing"
                    : a.status === "done",
                ).length
              }
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3">
          <div className="w-6 h-6 border-2 border-slate-700 border-t-[#1337ec] rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Đang tải danh sách bài viết...</p>
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 flex flex-col items-center justify-center py-20 gap-3">
          <span className="material-symbols-outlined text-slate-600 text-6xl">
            movie_filter
          </span>
          <p className="text-slate-400 text-sm">
            {filter === "approved"
              ? "Chưa có bài nào chờ tạo video"
              : "Chưa có video nào hoàn thành"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/** Cột trái - Danh sách (4 cols) */}
          <div className="lg:col-span-4 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-800/30 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-200">Danh sách bài viết</h3>
              <span className="text-xs text-slate-500 font-medium">
                {filteredArticles.length} bài
              </span>
            </div>
            <div className="divide-y divide-slate-800 max-h-[75vh] overflow-y-auto">
              {filteredArticles.map((article) => (
                <div
                  key={article.id}
                  onClick={() => {
                    setSelected(article);
                    setVideoError(null);
                  }}
                  className={`p-4 flex gap-3 cursor-pointer transition-all border-l-4 ${
                    selected?.id === article.id
                      ? "bg-[#1337ec]/15 border-[#1337ec]"
                      : "hover:bg-slate-800/50 border-transparent"
                  }`}
                >
                  <div className="w-16 h-12 rounded-xl overflow-hidden bg-slate-800 shrink-0 border border-slate-700/50">
                    {article.image_new || article.image_original ? (
                      <img
                        src={article.image_new || article.image_original || ""}
                        alt=""
                        className="w-full h-full object-cover"
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
                    <p className="text-xs font-bold text-white truncate leading-snug">
                      {article.title_new || article.title_original}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {article.status === "processing" ? (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                          <span className="text-xs text-blue-400 font-bold">
                            Đang tạo...
                          </span>
                        </div>
                      ) : article.video_path ? (
                        <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          Video sẵn sàng
                        </span>
                      ) : article.status === "done" ? (
                        <span className="text-xs text-emerald-400 font-bold">
                          ✓ Đã đăng
                        </span>
                      ) : (
                        <span className="text-xs text-amber-400 font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">schedule</span>
                          Chưa tạo video
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/** Cột phải - Detail & Render (8 cols) */}
          {selected ? (
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/** Card bài viết đang chọn */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 flex gap-4">
                <div className="w-36 h-28 rounded-xl overflow-hidden bg-slate-800 shrink-0 border border-slate-700/50">
                  {(selected.image_new || selected.image_original) && (
                    <img
                      src={selected.image_new || selected.image_original || ""}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <a
                      href={selected.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base font-black text-white hover:text-[#1337ec] leading-snug mb-1 block transition-colors line-clamp-2"
                    >
                      {selected.title_new || selected.title_original}
                    </a>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                      {selected.large_title && selected.small_title
                        ? `${selected.large_title} — ${selected.small_title}`
                        : selected.script || ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                    <span className="material-symbols-outlined text-sm">link</span>
                    <span className="truncate">{selected.source_url}</span>
                  </div>
                </div>
              </div>

              {/** Chọn Mode Tạo Video */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 flex flex-col gap-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Chọn Kiểu Video
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/** Option 1: Video Hook (Mới) */}
                  <div
                    onClick={() => setVideoMode("hook")}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col gap-2 ${
                      videoMode === "hook"
                        ? "bg-purple-500/10 border-purple-500 shadow-lg shadow-purple-500/10"
                        : "bg-slate-800/40 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-purple-400">
                          movie_edit
                        </span>
                        <h4 className="font-bold text-white text-sm">
                          Video Slide Ảnh + BREAKING NEWS
                        </h4>
                      </div>
                      <span className="text-[10px] uppercase font-black px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full">
                        Slide Ảnh + Breaking News
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Khung trên tự động chạy Slide toàn bộ ảnh trong bài viết, khung dưới hiển thị Badge BREAKING NEWS & Câu Hook dài nổi bật.
                    </p>
                  </div>

                  {/** Option 2: Video Voice */}
                  <div
                    onClick={() => setVideoMode("voice")}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col gap-2 ${
                      videoMode === "voice"
                        ? "bg-blue-500/10 border-blue-500 shadow-lg shadow-blue-500/10"
                        : "bg-slate-800/40 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-400">
                          mic
                        </span>
                        <h4 className="font-bold text-white text-sm">
                          Video Voice Audio + Subtitle
                        </h4>
                      </div>
                      <span className="text-[10px] uppercase font-black px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full">
                        Cần file Voice (.wav)
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Tạo video voice-over với phụ đề từ file âm thanh sử dụng Python Whisper generator.
                    </p>
                  </div>
                </div>

                {/** Tuỳ chỉnh Hook Text nếu chọn Hook Mode */}
                {videoMode === "hook" && (
                  <div className="mt-2 flex flex-col gap-4 border-t border-slate-800 pt-4">
                    <div className="flex flex-col gap-2">
                      {(() => {
                        const wordCount = hookText.trim() ? hookText.trim().split(/\s+/).length : 0;
                        return (
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                              <span>Nội dung Câu Hook (Khung dưới - Nổi bật từ khóa & Căn đều)</span>
                              <span
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                                  wordCount > 60
                                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                    : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                {wordCount} từ / ~50 từ khuyên dùng
                              </span>
                            </label>

                            <button
                              onClick={ztteam_handleGenerateAiHook}
                              disabled={isGeneratingAiHook}
                              className="px-3 py-1.5 bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-500 hover:to-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-red-500/10 cursor-pointer"
                            >
                              {isGeneratingAiHook ? (
                                <>
                                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  Đang AI tạo Hook...
                                </>
                              ) : (
                                <>
                                  <span className="material-symbols-outlined text-sm">
                                    auto_awesome
                                  </span>
                                  AI Viết Hook Tò Mò (~50 từ)
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })()}

                      <textarea
                        value={hookText}
                        onChange={(e) => setHookText(e.target.value)}
                        rows={4}
                        placeholder="Nhập hoặc chỉnh sửa câu Hook kích thích tò mò (khoảng 50 từ để chuẩn đẹp chữ to)..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-red-500 transition-colors font-sans leading-relaxed"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/** Khung hình */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-300">
                          Tỷ lệ Video
                        </label>
                        <select
                          value={aspectRatio}
                          onChange={(e) =>
                            setAspectRatio(e.target.value as "9:16" | "1:1")
                          }
                          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-purple-500"
                        >
                          <option value="9:16">📱 Khung Dọc 9:16 (TikTok, Reels, Shorts)</option>
                          <option value="1:1">🔳 Khung Vuông 1:1 (Square Feed)</option>
                        </select>
                      </div>

                      {/** Thời lượng */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-300">
                          Thời lượng Video
                        </label>
                        <select
                          value={duration}
                          onChange={(e) => setDuration(Number(e.target.value))}
                          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-purple-500"
                        >
                          <option value={5}>5 giây</option>
                          <option value={7}>7 giây (Khuyên dùng)</option>
                          <option value={10}>10 giây</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/** Video status / Preview Player */}
              {selected.status === "processing" || pollingId === selected.id ? (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 flex items-center gap-4">
                  <div className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-blue-400">
                      Đang xử lý tạo video...
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Hệ thống đang render video trong giây lát
                    </p>
                  </div>
                </div>
              ) : selected.video_path ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-400">
                        check_circle
                      </span>
                      <p className="text-sm font-bold text-emerald-400">
                        Video đã hoàn thành!
                      </p>
                    </div>
                    <a
                      href={selected.video_path}
                      download
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">download</span>
                      Tải Video
                    </a>
                  </div>

                  {/** Embedded Video Player */}
                  <div className="w-full max-w-sm mx-auto aspect-[9/16] bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800">
                    <video
                      src={selected.video_path}
                      controls
                      autoPlay
                      loop
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              ) : null}

              {/** Link WP */}
              {selected.wp_link && (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-800 bg-slate-800/30">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Link bài đã đăng WordPress
                    </p>
                  </div>
                  <div className="p-4">
                    <a
                      href={selected.wp_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#1337ec] hover:underline break-all font-mono"
                    >
                      {selected.wp_link}
                    </a>
                  </div>
                </div>
              )}

              {/** Social Post Caption */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-800 bg-slate-800/30 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Nội dung bài đăng Fanpage
                  </p>
                  <button
                    onClick={ztteam_handleCopySocialPost}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      copied
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {copied ? "check" : "content_copy"}
                    </span>
                    {copied ? "Đã copy!" : "Copy"}
                  </button>
                </div>
                <div className="p-5">
                  <pre className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
                    {ztteam_formatSocialPost(
                      selected.social_post || "",
                      selected.wp_link,
                    )}
                  </pre>
                </div>
              </div>

              {/** Error alert */}
              {videoError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-400 text-sm">
                    error
                  </span>
                  <p className="text-sm text-red-400">{videoError}</p>
                </div>
              )}

              {/** Action buttons */}
              <div className="flex flex-col gap-3">
                {selected.status !== "processing" && (
                  <div className="flex gap-3">
                    {videoMode === "hook" && (
                      <button
                        onClick={ztteam_handlePreviewImage}
                        disabled={isPreviewingImage}
                        className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-purple-300 font-bold rounded-2xl transition-all border border-purple-500/30 flex items-center justify-center gap-2 text-sm cursor-pointer"
                      >
                        {isPreviewingImage ? (
                          <>
                            <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                            Đang render ảnh (0.5s)...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-base">
                              image
                            </span>
                            Test Render Ảnh Preview (0.5s)
                          </>
                        )}
                      </button>
                    )}

                    <button
                      onClick={ztteam_handleCreateVideo}
                      disabled={isCreatingVideo}
                      className={`flex-1 py-3.5 ${
                        videoMode === "hook"
                          ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500"
                          : "bg-gradient-to-r from-[#1337ec] to-blue-600 hover:from-[#1337ec]/90 hover:to-blue-500"
                      } disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold rounded-2xl transition-all shadow-xl flex items-center justify-center gap-2 text-sm cursor-pointer`}
                    >
                      {isCreatingVideo ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Đang tạo video...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-lg">
                            {videoMode === "hook" ? "movie_edit" : "movie"}
                          </span>
                          {videoMode === "hook"
                            ? "Tạo Video Khung Hook"
                            : "Tạo Video Voice"}
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/** Preview Modal / Image Display */}
                {previewImageUrl && (
                  <div className="bg-slate-900 border border-purple-500/40 rounded-2xl p-4 flex flex-col gap-3 shadow-2xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-purple-400 text-sm">
                          visibility
                        </span>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          Xem Trước Frame Ảnh Hook (0.5s)
                        </h4>
                      </div>
                      <button
                        onClick={() => setPreviewImageUrl(null)}
                        className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 bg-slate-800 rounded-lg"
                      >
                        Đóng
                      </button>
                    </div>

                    <div className="w-full max-w-sm mx-auto aspect-[9/16] bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800">
                      <img
                        src={previewImageUrl}
                        alt="Hook Frame Preview"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                )}

                {selected.status !== "done" && (
                  <button
                    onClick={ztteam_handleFanpageDone}
                    disabled={markingDone}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                  >
                    {markingDone ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Đang lưu...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">
                          done_all
                        </span>
                        Xác nhận đã đăng Fanpage
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="lg:col-span-8 bg-slate-900 rounded-2xl border border-slate-800 border-dashed flex flex-col items-center justify-center py-28 gap-3">
              <span className="material-symbols-outlined text-slate-600 text-6xl">
                touch_app
              </span>
              <p className="text-slate-400 text-sm font-medium">
                Vui lòng chọn bài viết từ danh sách bên trái để tạo video
              </p>
            </div>
          )}
        </div>
      )}

      {/** Batch Modal */}
      {showBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg flex flex-col gap-0 overflow-hidden shadow-2xl">
            {/** Modal header */}
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-black text-xl text-white">Tạo Video Hàng Loạt</h3>
                <p className="text-xs text-slate-400 mt-1">
                  {batchItems.length} bài viết sẽ được xử lý tự động
                </p>
              </div>
              {!batchRunning && (
                <button
                  onClick={() => setShowBatch(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">
                    close
                  </span>
                </button>
              )}
            </div>

            {/** Batch Settings */}
            <div className="p-5 border-b border-slate-800 bg-slate-950/50 flex flex-col gap-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Chế độ tạo video batch
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={batchRunning}
                  onClick={() => setBatchMode("hook")}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    batchMode === "hook"
                      ? "bg-purple-500/20 border-purple-500 text-purple-300"
                      : "bg-slate-800/40 border-slate-800 text-slate-400"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">movie_edit</span>
                  Khung Ảnh + Hook Text
                </button>
                <button
                  disabled={batchRunning}
                  onClick={() => setBatchMode("voice")}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    batchMode === "voice"
                      ? "bg-blue-500/20 border-blue-500 text-blue-300"
                      : "bg-slate-800/40 border-slate-800 text-slate-400"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">mic</span>
                  Voice Audio Mode
                </button>
              </div>
            </div>

            {/** Danh sách bài */}
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
              {batchItems.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-slate-600 text-4xl">
                    check_circle
                  </span>
                  <p className="text-sm text-slate-400">
                    Không có bài nào chờ tạo video
                  </p>
                </div>
              ) : (
                batchItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`px-6 py-3.5 flex items-center gap-3 transition-colors ${
                      batchCurrentIndex === idx ? "bg-slate-800/60" : ""
                    }`}
                  >
                    <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                      {item.status === "waiting" && (
                        <span className="w-2 h-2 rounded-full bg-slate-600" />
                      )}
                      {item.status === "processing" && (
                        <div className="w-5 h-5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                      )}
                      {item.status === "done" && (
                        <span className="material-symbols-outlined text-emerald-400 text-lg">
                          check_circle
                        </span>
                      )}
                      {item.status === "error" && (
                        <span className="material-symbols-outlined text-red-400 text-lg">
                          error
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs font-semibold truncate ${
                          item.status === "done"
                            ? "text-emerald-400"
                            : item.status === "error"
                              ? "text-red-400"
                              : item.status === "processing"
                                ? "text-purple-300 font-bold"
                                : "text-slate-300"
                        }`}
                      >
                        {item.title}
                      </p>
                      {item.error && (
                        <p className="text-[11px] text-red-400 mt-0.5 truncate">
                          {item.error}
                        </p>
                      )}
                    </div>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0 ${
                        item.status === "waiting"
                          ? "bg-slate-800 text-slate-500"
                          : item.status === "processing"
                            ? "bg-purple-500/20 text-purple-300 animate-pulse"
                            : item.status === "done"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {item.status === "waiting"
                        ? "Chờ"
                        : item.status === "processing"
                          ? "Đang tạo"
                          : item.status === "done"
                            ? "Xong"
                            : "Lỗi"}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/** Progress bar */}
            {batchItems.length > 0 && (
              <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400 font-medium">Tiến độ</span>
                  <span className="text-xs font-bold text-white font-mono">
                    {batchItems.filter((b) => b.status === "done").length} /{" "}
                    {batchItems.length}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        batchItems.length > 0
                          ? (batchItems.filter((b) => b.status === "done")
                              .length /
                              batchItems.length) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/** Modal actions */}
            <div className="px-6 py-4 border-t border-slate-800 flex gap-3">
              {!batchRunning ? (
                <>
                  <button
                    onClick={ztteam_handleBatchStart}
                    disabled={batchItems.length === 0}
                    className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-purple-500/20"
                  >
                    <span className="material-symbols-outlined text-base">
                      play_arrow
                    </span>
                    Bắt đầu tạo Hàng loạt
                  </button>
                  <button
                    onClick={() => setShowBatch(false)}
                    className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl transition-colors text-sm"
                  >
                    Đóng
                  </button>
                </>
              ) : (
                <button
                  onClick={ztteam_handleBatchStop}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <span className="material-symbols-outlined text-base">
                    stop
                  </span>
                  Dừng Batch
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
