"use client";

import { useState, useEffect, useRef } from "react";
import { ZTTeamMusicTrack } from "@/lib/music-catalog";

interface ZTTeamFetchedData {
  title: string;
  url: string;
  siteName: string;
  excerpt: string;
  images: string[];
  hookText: string;
  facebookCaption?: string;
}

interface ZTTeamVideoResult {
  videoUrl: string;
  fileName: string;
  title: string;
  hookText: string;
  duration: number;
  aspectRatio: "9:16" | "1:1";
  imageCount: number;
  createdAt: string;
  facebookCaption?: string;
  musicId?: string;
}

export default function ZTTeamUrlToVideoPage() {
  const [urlInput, setUrlInput] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Studio State
  const [articleData, setArticleData] = useState<ZTTeamFetchedData | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [hookText, setHookText] = useState("");
  const [facebookCaption, setFacebookCaption] = useState("");
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [badgeText, setBadgeText] = useState("BREAKING NEWS");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "1:1">("9:16");
  const [duration, setDuration] = useState<number>(6);

  // Font Size Zoom State (Cỡ chữ phóng to nhỏ)
  const [fontSize, setFontSize] = useState<number>(42);
  const [isAutoFontSize, setIsAutoFontSize] = useState<boolean>(true);

  // Paste Image States (Dán ảnh từ Clipboard / Link)
  const [isPastingImage, setIsPastingImage] = useState<boolean>(false);
  const [pasteSuccessMsg, setPasteSuccessMsg] = useState<string | null>(null);
  const [showPasteUrlModal, setShowPasteUrlModal] = useState<boolean>(false);
  const [pastedUrlInput, setPastedUrlInput] = useState<string>("");

  // Music State
  const [musicTracks, setMusicTracks] = useState<ZTTeamMusicTrack[]>([]);
  const [selectedMusicId, setSelectedMusicId] = useState<string>("news-breaking-alert");
  const [musicVolume, setMusicVolume] = useState<number>(80);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [isUploadingMusic, setIsUploadingMusic] = useState(false);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const musicFileInputRef = useRef<HTMLInputElement>(null);

  // Upload Images State
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Actions State
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState("");
  const [videoResult, setVideoResult] = useState<ZTTeamVideoResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "video">("preview");

  // History State
  const [recentVideos, setRecentVideos] = useState<ZTTeamVideoResult[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ztteam_url_videos_history");
      if (saved) {
        setRecentVideos(JSON.parse(saved));
      }
    } catch {}
  }, []);

  // Tải kho nhạc mẫu Facebook Sound Collection
  useEffect(() => {
    fetch("/api/url-video/music")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.tracks)) {
          setMusicTracks(json.tracks);
        }
      })
      .catch(() => {});
  }, []);

  // Đồng bộ âm lượng nghe thử
  useEffect(() => {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.volume = musicVolume / 100;
    }
  }, [musicVolume]);

  const saveToHistory = (newVid: ZTTeamVideoResult) => {
    try {
      const updated = [newVid, ...recentVideos.slice(0, 9)];
      setRecentVideos(updated);
      localStorage.setItem("ztteam_url_videos_history", JSON.stringify(updated));
    } catch {}
  };

  /** Calculate Word Count & Font Size Boundaries */
  const wordCount = hookText.trim() ? hookText.trim().split(/\s+/).length : 0;
  const isOptimalLength = wordCount >= 40 && wordCount <= 60;

  // Cỡ chữ tối ưu tự động dựa trên số từ & tỷ lệ khung hình
  const defaultFontSize = aspectRatio === "1:1"
    ? (wordCount <= 20 ? 38 : wordCount <= 35 ? 34 : 30)
    : (wordCount <= 20 ? 50 : wordCount <= 35 ? 44 : 38);

  const effectiveFontSize = isAutoFontSize ? defaultFontSize : fontSize;

  // Tính cỡ chữ tối đa an toàn để đảm bảo văn bản 100% không bị tràn khung
  const maxSafeFontSize = (() => {
    const chars = Math.max(100, hookText.length);
    const usableHeight = aspectRatio === "1:1" ? 340 : 680;
    const calculated = Math.floor(Math.sqrt((usableHeight * 926) / (chars * 0.76)));
    const hardLimit = aspectRatio === "1:1" ? 42 : 54;
    return Math.max(26, Math.min(hardLimit, calculated));
  })();

  const isFontSizeSafe = effectiveFontSize <= maxSafeFontSize;

  /** Fetch URL Data */
  const handleFetchUrl = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!urlInput.trim()) return;

    setIsFetching(true);
    setFetchError(null);
    setActionError(null);
    setPreviewImageUrl(null);
    setVideoResult(null);

    try {
      const res = await fetch("/api/url-video/fetch-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        const data: ZTTeamFetchedData = json.data;
        setArticleData(data);
        setHookText(data.hookText || "");
        setFacebookCaption(data.facebookCaption || "");
        setSelectedImages(data.images.slice(0, 4));
        setActiveTab("preview");

        // Tự động tạo ảnh preview ngay sau khi cào
        if (data.images.length > 0 && data.hookText) {
          triggerAutoPreview(data.images.slice(0, 4), data.hookText, aspectRatio, badgeText, effectiveFontSize);
        }
      } else {
        setFetchError(json.error || "Không thể cào dữ liệu từ URL này");
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Lỗi kết nối khi cào dữ liệu");
    } finally {
      setIsFetching(false);
    }
  };

  /** Helper trigger auto preview */
  const triggerAutoPreview = async (
    imgs: string[],
    text: string,
    ratio: "9:16" | "1:1",
    badge: string,
    fontSizeVal: number = effectiveFontSize
  ) => {
    if (imgs.length === 0 || !text.trim()) return;
    setIsPreviewing(true);
    try {
      const res = await fetch("/api/url-video/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: imgs,
          hookText: text,
          aspectRatio: ratio,
          badgeText: badge,
          fontSize: fontSizeVal,
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.imageUrl) {
        setPreviewImageUrl(json.data.imageUrl);
      }
    } catch {}
    finally {
      setIsPreviewing(false);
    }
  };

  // Tự động cập nhật ảnh preview khi đổi cỡ chữ (debounce 450ms)
  useEffect(() => {
    if (!articleData || selectedImages.length === 0 || !hookText.trim()) return;
    const timer = setTimeout(() => {
      triggerAutoPreview(selectedImages, hookText, aspectRatio, badgeText, effectiveFontSize);
    }, 450);
    return () => clearTimeout(timer);
  }, [effectiveFontSize, aspectRatio]);

  /** Re-generate AI Hook */
  const handleRegenerateHook = async () => {
    if (!articleData) return;
    setIsFetching(true);
    setActionError(null);
    try {
      const res = await fetch("/api/url-video/fetch-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: articleData.url }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        if (json.data.hookText) setHookText(json.data.hookText);
        if (json.data.facebookCaption && !facebookCaption) {
          setFacebookCaption(json.data.facebookCaption);
        }
      }
    } catch {
      setActionError("Không thể tạo lại Hook lúc này");
    } finally {
      setIsFetching(false);
    }
  };

  /** Xử lý Upload thêm ảnh từ máy */
  const handleUploadImages = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsUploadingImages(true);
    setActionError(null);

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }

      const res = await fetch("/api/url-video/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (json.success && Array.isArray(json.urls) && json.urls.length > 0) {
        const newUrls: string[] = json.urls;

        // Cập nhật danh sách ảnh của bài viết
        setArticleData((prev) => {
          if (!prev) {
            return {
              title: "Ảnh tải lên tùy chỉnh",
              url: "",
              siteName: "Tự tải lên",
              excerpt: "",
              images: newUrls,
              hookText: hookText || "",
              facebookCaption: facebookCaption || "",
            };
          }
          const merged = [...newUrls, ...prev.images];
          return {
            ...prev,
            images: merged,
          };
        });

        // Đánh dấu ảnh do user tự upload
        setUploadedImages((prev) => [...newUrls, ...prev]);

        // Tự động chọn ảnh mới nếu còn chỗ (tối đa 5 ảnh)
        setSelectedImages((prev) => {
          const availableSlots = Math.max(0, 5 - prev.length);
          if (availableSlots > 0) {
            const toAdd = newUrls.slice(0, availableSlots);
            return [...toAdd, ...prev];
          }
          return prev;
        });
      } else {
        setActionError(json.error || "Không thể tải ảnh lên");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Lỗi khi upload ảnh");
    } finally {
      setIsUploadingImages(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /** Xóa ảnh vừa upload nếu không thích */
  const handleDeleteUploadedImage = (e: React.MouseEvent, imgUrl: string) => {
    e.stopPropagation();
    setArticleData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        images: prev.images.filter((img) => img !== imgUrl),
      };
    });
    setSelectedImages((prev) => prev.filter((img) => img !== imgUrl));
    setUploadedImages((prev) => prev.filter((img) => img !== imgUrl));
  };

  /** Xử lý dán link ảnh từ URL trực tiếp */
  const handlePasteImageUrl = async (imgUrl: string) => {
    if (!imgUrl || !imgUrl.trim()) return;
    setIsUploadingImages(true);
    setActionError(null);

    try {
      const res = await fetch("/api/url-video/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: [imgUrl.trim()] }),
      });

      const json = await res.json();
      if (json.success && Array.isArray(json.urls) && json.urls.length > 0) {
        const newUrls: string[] = json.urls;
        setArticleData((prev) => {
          if (!prev) {
            return {
              title: "Ảnh dán từ clipboard / URL",
              url: "",
              siteName: "Dán trực tiếp",
              excerpt: "",
              images: newUrls,
              hookText: hookText || "",
              facebookCaption: facebookCaption || "",
            };
          }
          return {
            ...prev,
            images: [...newUrls, ...prev.images.filter((img) => !newUrls.includes(img))],
          };
        });

        setUploadedImages((prev) => [...newUrls, ...prev]);

        setSelectedImages((prev) => {
          const availableSlots = Math.max(0, 5 - prev.length);
          if (availableSlots > 0) {
            return [...newUrls.slice(0, availableSlots), ...prev];
          }
          return prev;
        });

        setPasteSuccessMsg("Đã dán ảnh thành công!");
        setTimeout(() => setPasteSuccessMsg(null), 3000);
        setShowPasteUrlModal(false);
        setPastedUrlInput("");
      } else {
        setActionError(json.error || "Không thể tải ảnh từ link đã dán");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Lỗi khi xử lý link ảnh");
    } finally {
      setIsUploadingImages(false);
    }
  };

  /** Xử lý dán ảnh trực tiếp từ Clipboard khi click nút */
  const handlePasteFromClipboard = async () => {
    setIsPastingImage(true);
    setActionError(null);
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        const imageFiles: File[] = [];
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith("image/"));
          if (imageType) {
            const blob = await item.getType(imageType);
            const ext = imageType.split("/")[1] || "png";
            const file = new File([blob], `clipboard_${Date.now()}.${ext}`, { type: imageType });
            imageFiles.push(file);
          }
        }

        if (imageFiles.length > 0) {
          await handleUploadImages(imageFiles);
          setPasteSuccessMsg(`Đã dán thành công ${imageFiles.length} ảnh từ Clipboard!`);
          setTimeout(() => setPasteSuccessMsg(null), 3000);
          return;
        }
      }

      // Fallback: Kiểm tra xem clipboard text có chứa link ảnh hay không
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = (await navigator.clipboard.readText()).trim();
        if (
          text &&
          (text.startsWith("http://") || text.startsWith("https://") || text.startsWith("data:image/")) &&
          (text.match(/\.(jpeg|jpg|png|webp|avif|gif)(\?.*)?$/i) || text.startsWith("data:image/"))
        ) {
          await handlePasteImageUrl(text);
          return;
        }
      }

      // Nếu không đọc được trực tiếp hoặc chưa có ảnh trong clipboard, mở modal dán tiện lợi
      setShowPasteUrlModal(true);
    } catch (err) {
      console.warn("Direct clipboard read unavailable, opening paste modal:", err);
      setShowPasteUrlModal(true);
    } finally {
      setIsPastingImage(false);
    }
  };

  /** Lắng nghe sự kiện Ctrl+V toàn trang để dán ảnh tức thì */
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        const items = e.clipboardData?.items;
        if (!items) return;
        let hasImage = false;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith("image/")) {
            hasImage = true;
            break;
          }
        }
        if (!hasImage) return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            imageFiles.push(file);
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        await handleUploadImages(imageFiles);
        setPasteSuccessMsg(`Đã dán thành công ${imageFiles.length} ảnh từ Clipboard!`);
        setTimeout(() => setPasteSuccessMsg(null), 3000);
        return;
      }

      const text = e.clipboardData?.getData("text")?.trim();
      if (
        text &&
        (text.startsWith("http://") || text.startsWith("https://") || text.startsWith("data:image/")) &&
        (text.match(/\.(jpeg|jpg|png|webp|avif|gif)(\?.*)?$/i) || text.startsWith("data:image/"))
      ) {
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
        e.preventDefault();
        await handlePasteImageUrl(text);
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [articleData, hookText, facebookCaption, effectiveFontSize]);

  /** AI Viết lại Caption Facebook */
  const handleRegenerateCaption = async () => {
    if (!articleData && !hookText) return;
    setIsGeneratingCaption(true);
    setActionError(null);
    try {
      const res = await fetch("/api/url-video/generate-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: articleData?.title || "",
          hookText: hookText || "",
          url: articleData?.url || "",
          excerpt: articleData?.excerpt || "",
          siteName: articleData?.siteName || "",
        }),
      });
      const json = await res.json();
      if (json.success && json.caption) {
        setFacebookCaption(json.caption);
        if (videoResult) {
          setVideoResult((prev) => (prev ? { ...prev, facebookCaption: json.caption } : null));
        }
      } else {
        setActionError(json.error || "Không thể tạo lại caption Facebook");
      }
    } catch {
      setActionError("Lỗi kết nối khi tạo lại caption");
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  /** Sao chép Facebook Caption */
  const handleCopyCaption = async () => {
    if (!facebookCaption) return;
    try {
      await navigator.clipboard.writeText(facebookCaption);
      setCopiedCaption(true);
      setTimeout(() => setCopiedCaption(false), 2500);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  /** Bật/Tắt nghe thử nhạc nền */
  const handleTogglePreviewAudio = (track: ZTTeamMusicTrack) => {
    if (!track.url || track.id === "none") {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      setPlayingTrackId(null);
      return;
    }

    if (playingTrackId === track.id) {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      setPlayingTrackId(null);
    } else {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.src = track.url;
        audioPreviewRef.current.volume = musicVolume / 100;
        audioPreviewRef.current.play().catch(() => {});
      }
      setPlayingTrackId(track.id);
    }
  };

  /** Tải file nhạc riêng từ máy tính */
  const handleUploadCustomMusic = async (file: File) => {
    if (!file) return;
    setIsUploadingMusic(true);
    setActionError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/url-video/upload-music", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (json.success && json.track) {
        const newTrack: ZTTeamMusicTrack = json.track;
        setMusicTracks((prev) => [newTrack, ...prev]);
        setSelectedMusicId(newTrack.id);
        handleTogglePreviewAudio(newTrack);
      } else {
        setActionError(json.error || "Không thể tải file nhạc lên");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Lỗi khi upload nhạc");
    } finally {
      setIsUploadingMusic(false);
      if (musicFileInputRef.current) musicFileInputRef.current.value = "";
    }
  };

  /** Toggle Image Selection */
  const toggleImageSelection = (imgUrl: string) => {
    setSelectedImages((prev) => {
      if (prev.includes(imgUrl)) {
        return prev.filter((p) => p !== imgUrl);
      } else {
        if (prev.length >= 5) {
          alert("Tối đa chọn 5 ảnh để tạo slideshow video mượt mà");
          return prev;
        }
        return [...prev, imgUrl];
      }
    });
  };

  /** Preview Frame */
  const handlePreviewFrame = async () => {
    if (selectedImages.length === 0) {
      setActionError("Vui lòng chọn ít nhất 1 ảnh");
      return;
    }
    if (!hookText.trim()) {
      setActionError("Vui lòng nhập nội dung Hook");
      return;
    }

    setIsPreviewing(true);
    setActionError(null);
    setActiveTab("preview");

    try {
      const res = await fetch("/api/url-video/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: selectedImages,
          hookText,
          aspectRatio,
          badgeText,
          fontSize: effectiveFontSize,
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.imageUrl) {
        setPreviewImageUrl(json.data.imageUrl);
      } else {
        setActionError(json.error || "Lỗi tạo ảnh xem trước");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Lỗi khi gọi API preview");
    } finally {
      setIsPreviewing(false);
    }
  };

  /** Render Video */
  const handleRenderVideo = async () => {
    if (selectedImages.length === 0) {
      setActionError("Vui lòng chọn ít nhất 1 ảnh để làm video");
      return;
    }
    if (!hookText.trim()) {
      setActionError("Vui lòng nhập nội dung Hook");
      return;
    }

    // Tạm dừng phát preview nhạc khi bắt đầu render
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      setPlayingTrackId(null);
    }

    setIsRendering(true);
    setActionError(null);
    setRenderProgress("Đang biên tập ảnh, ghép nhạc và render MP4 với FFmpeg...");

    try {
      const selectedTrack = musicTracks.find((m) => m.id === selectedMusicId);
      const res = await fetch("/api/url-video/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: selectedImages,
          hookText,
          duration,
          aspectRatio,
          badgeText,
          title: articleData?.title || "Quick Hook Video",
          facebookCaption,
          musicId: selectedMusicId,
          musicVolume,
          customMusicUrl: selectedTrack?.isCustom ? selectedTrack.url : "",
          fontSize: effectiveFontSize,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        const newResult: ZTTeamVideoResult = {
          ...json.data,
          facebookCaption: facebookCaption || json.data.facebookCaption || "",
          musicId: selectedMusicId,
          createdAt: new Date().toLocaleTimeString(),
        };
        setVideoResult(newResult);
        saveToHistory(newResult);
        setActiveTab("video");
      } else {
        setActionError(json.error || "Lỗi render video");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Lỗi kết nối khi render video");
    } finally {
      setIsRendering(false);
      setRenderProgress("");
    }
  };

  /** Format highlighted words for preview */
  const renderFormattedHookText = () => {
    const words = hookText.trim().split(/\s+/);
    return words.map((w, idx) => {
      const isFirstFew = idx < 2;
      const isLastFew =
        idx >= words.length - 8 &&
        (w.includes("...") || w.includes("(") || w.includes("Click") || w.includes("link") || w.includes("story"));
      const isHighlight = isFirstFew || isLastFew || /[A-Z]{3,}|\d+|[%$!]/.test(w);
      return (
        <span
          key={idx}
          className={isHighlight ? "text-amber-400 font-extrabold" : "text-white font-bold"}
        >
          {w}{" "}
        </span>
      );
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-xl shadow-lg shadow-blue-500/20 text-white flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">smart_display</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              URL to Hook Video Studio
            </h1>
          </div>
          <p className="text-sm text-slate-400">
            Dán link bài viết trực tiếp để tự động cào ảnh, tạo kịch bản Hook tò mò và render video viral độc lập.
          </p>
        </div>
      </div>

      {/* URL Input Box */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <form onSubmit={handleFetchUrl} className="space-y-4">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
            Nhập đường link bài viết (URL)
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                <span className="material-symbols-outlined text-xl">link</span>
              </div>
              <input
                type="url"
                required
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/news/article-headline..."
                className="w-full pl-11 pr-24 py-3.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              />
              {urlInput && (
                <button
                  type="button"
                  onClick={() => setUrlInput("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-500 hover:text-slate-300"
                >
                  Xoá
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={isFetching || !urlInput.trim()}
              className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all cursor-pointer flex-shrink-0"
            >
              {isFetching ? (
                <>
                  <span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>
                  <span>Đang cào dữ liệu & viết Hook...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">auto_awesome</span>
                  <span>Lấy Dữ Liệu & Tạo Hook</span>
                </>
              )}
            </button>
          </div>

          {fetchError && (
            <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl flex items-center gap-3 text-red-300 text-sm">
              <span className="material-symbols-outlined text-red-400">error</span>
              <span>{fetchError}</span>
            </div>
          )}
        </form>
      </div>

      {/* Main Studio Area */}
      {articleData && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Editor & Controls */}
          <div className="lg:col-span-7 space-y-6">
            {/* Article Info Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950 text-blue-400 border border-blue-800">
                  {articleData.siteName || "News Article"}
                </span>
                <a
                  href={articleData.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-slate-500 hover:text-blue-400 flex items-center gap-1 transition-colors ml-auto"
                >
                  <span>Mở link gốc</span>
                  <span className="material-symbols-outlined text-xs">open_in_new</span>
                </a>
              </div>
              <h2 className="text-base font-bold text-white leading-snug line-clamp-2">
                {articleData.title}
              </h2>
            </div>

            {/* Image Selector */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-200">
                    Chọn Ảnh Làm Video ({selectedImages.length}/{articleData.images.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Dán ảnh từ clipboard, dán link ảnh hoặc chọn ảnh có sẵn (tối đa 5 ảnh)
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Primary: Dán ảnh từ Clipboard (Ctrl+V) */}
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    disabled={isUploadingImages || isPastingImage}
                    className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/25 cursor-pointer"
                    title="Nhấn để dán ảnh trực tiếp từ Clipboard hoặc bấm Ctrl+V"
                  >
                    <span className={`material-symbols-outlined text-sm ${isPastingImage || isUploadingImages ? "animate-spin" : ""}`}>
                      {isPastingImage || isUploadingImages ? "progress_activity" : "content_paste"}
                    </span>
                    <span>{isPastingImage || isUploadingImages ? "Đang xử lý..." : "Dán ảnh (Ctrl+V)"}</span>
                  </button>

                  {/* Secondary: Dán link ảnh */}
                  <button
                    type="button"
                    onClick={() => setShowPasteUrlModal(true)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-700 cursor-pointer"
                    title="Dán đường link ảnh trực tiếp"
                  >
                    <span className="material-symbols-outlined text-sm">link</span>
                    <span>Dán link</span>
                  </button>

                  <span className="text-xs font-semibold text-slate-400 bg-slate-800 px-2.5 py-1.5 rounded-lg">
                    {selectedImages.length} đã chọn
                  </span>
                </div>
              </div>

              {/* Mẹo dán ảnh nhanh */}
              <div className="px-3.5 py-2 bg-blue-950/30 border border-blue-900/40 rounded-xl flex items-center justify-between text-[11px] text-blue-300">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-blue-400">info</span>
                  <span>Mẹo: Nhấn <strong>Ctrl + V</strong> bất cứ lúc nào trên trang để dán ảnh đã copy vào video!</span>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-slate-400 hover:text-slate-200 underline text-[10px] cursor-pointer ml-2 flex-shrink-0"
                >
                  tải từ máy
                </button>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files) handleUploadImages(e.target.files);
                }}
                className="hidden"
              />

              {articleData.images.length === 0 ? (
                <div className="p-8 text-center space-y-3 bg-slate-950/50 rounded-xl border border-dashed border-slate-800">
                  <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
                    <span className="material-symbols-outlined text-2xl">content_paste</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-slate-300 font-bold text-xs">Không tìm thấy ảnh trong bài viết</p>
                    <p className="text-slate-500 text-xs">Hãy nhấn Ctrl+V hoặc bấm nút dưới để dán ảnh đã copy</p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handlePasteFromClipboard}
                      disabled={isUploadingImages || isPastingImage}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-lg shadow-blue-600/20"
                    >
                      <span className="material-symbols-outlined text-sm">content_paste</span>
                      <span>Dán ảnh từ Clipboard (Ctrl+V)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPasteUrlModal(true)}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">link</span>
                      <span>Dán link ảnh</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-64 overflow-y-auto pr-1">
                  {/* Paste Tile Button */}
                  <div
                    onClick={handlePasteFromClipboard}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files) handleUploadImages(e.dataTransfer.files);
                    }}
                    className="relative aspect-video rounded-xl border-2 border-dashed border-blue-500/50 hover:border-blue-400 bg-blue-950/20 hover:bg-blue-950/40 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all group p-2 text-center"
                    title="Bấm để dán ảnh đã copy từ Clipboard hoặc kéo thả ảnh vào đây"
                  >
                    <span className={`material-symbols-outlined text-2xl text-blue-400 group-hover:scale-110 transition-transform ${isUploadingImages || isPastingImage ? "animate-spin" : ""}`}>
                      {isUploadingImages || isPastingImage ? "progress_activity" : "content_paste"}
                    </span>
                    <span className="text-[11px] font-extrabold text-blue-300 group-hover:text-white leading-tight">
                      {isUploadingImages || isPastingImage ? "Đang xử lý..." : "Dán ảnh (Ctrl+V)"}
                    </span>
                    <span className="text-[9px] text-slate-400 leading-none">
                      Click hoặc nhấn Ctrl+V
                    </span>
                  </div>

                  {articleData.images.map((img, idx) => {
                    const isSelected = selectedImages.includes(img);
                    const selectedIdx = selectedImages.indexOf(img) + 1;
                    const isCustomUploaded = uploadedImages.includes(img);
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleImageSelection(img)}
                        className={`relative aspect-video rounded-xl overflow-hidden cursor-pointer border-2 transition-all group ${
                          isSelected
                            ? "border-blue-500 ring-2 ring-blue-500/30"
                            : "border-slate-800 hover:border-slate-700 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <img
                          src={img}
                          alt={`Article ${idx}`}
                          className="w-full h-full object-cover"
                        />
                        {/* Number badge if selected */}
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-md">
                            {selectedIdx}
                          </div>
                        )}
                        {/* Upload badge if custom uploaded */}
                        {isCustomUploaded && (
                          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-indigo-600 text-white shadow">
                            Dán/Upload
                          </span>
                        )}
                        {/* Delete button if custom uploaded */}
                        {isCustomUploaded && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteUploadedImage(e, img)}
                            className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-md bg-red-600/90 hover:bg-red-500 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity shadow"
                            title="Xóa ảnh này"
                          >
                            <span className="material-symbols-outlined text-xs">close</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Hook Text Editor */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-200">Nội Dung Hook Kịch Tính</h3>
                  <p className="text-xs text-slate-400">Được hiển thị trong thẻ Breaking News</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                      isOptimalLength
                        ? "bg-emerald-950/80 text-emerald-400 border-emerald-800"
                        : "bg-amber-950/80 text-amber-400 border-amber-800"
                    }`}
                  >
                    {wordCount} từ (Chuẩn: 45-55)
                  </span>
                  <button
                    type="button"
                    onClick={handleRegenerateHook}
                    disabled={isFetching}
                    className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-xs flex items-center gap-1 cursor-pointer"
                    title="AI Viết lại Hook"
                  >
                    <span className="material-symbols-outlined text-sm">refresh</span>
                    <span>Tạo lại</span>
                  </button>
                </div>
              </div>

              <textarea
                rows={4}
                value={hookText}
                onChange={(e) => setHookText(e.target.value)}
                placeholder="Nhập nội dung Hook bằng tiếng Anh..."
                className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all resize-y"
              />

              {/* Chức năng Phóng to / Thu nhỏ cỡ chữ (Vẫn nằm trọn trong khung) */}
              <div className="p-3.5 bg-slate-950/90 border border-slate-800 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-400 text-base">format_size</span>
                    <span className="text-xs font-bold text-slate-200">Cỡ Chữ Thẻ Card (Font Size)</span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-blue-950 text-blue-400 border border-blue-800">
                      {effectiveFontSize}px
                    </span>
                    {isAutoFontSize && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400">
                        Tự động
                      </span>
                    )}
                  </div>

                  {/* Safety Boundary Indicator */}
                  <div className="flex items-center gap-1.5 text-[11px]">
                    {isFontSizeSafe ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                        Nằm gọn trong khung (An toàn)
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1 font-semibold" title={`Khuyên dùng tối đa ${maxSafeFontSize}px để không tràn khung`}>
                        <span className="material-symbols-outlined text-sm">warning</span>
                        Sát mép dưới (Khuyên dùng ≤ {maxSafeFontSize}px)
                      </span>
                    )}
                  </div>
                </div>

                {/* Slider & Zoom Controls */}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAutoFontSize(false);
                      setFontSize((prev) => Math.max(26, prev - 2));
                    }}
                    className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-xs transition-colors cursor-pointer flex-shrink-0"
                    title="Thu nhỏ chữ (A-)"
                  >
                    A-
                  </button>

                  <input
                    type="range"
                    min={26}
                    max={aspectRatio === "1:1" ? 42 : 54}
                    step={2}
                    value={effectiveFontSize}
                    onChange={(e) => {
                      setIsAutoFontSize(false);
                      setFontSize(Number(e.target.value));
                    }}
                    className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      setIsAutoFontSize(false);
                      setFontSize((prev) => Math.min(aspectRatio === "1:1" ? 42 : 54, prev + 2));
                    }}
                    className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-xs transition-colors cursor-pointer flex-shrink-0"
                    title="Phóng to chữ (A+)"
                  >
                    A+
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsAutoFontSize(true);
                      setFontSize(defaultFontSize);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer flex-shrink-0 ${
                      isAutoFontSize
                        ? "bg-blue-600/20 text-blue-400 border-blue-500"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                    title="Tự động tính cỡ chữ vừa vặn nhất"
                  >
                    Auto
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mr-1">Cỡ mẫu:</span>
                  {[
                    { label: "Nhỏ", size: aspectRatio === "1:1" ? 28 : 34 },
                    { label: "Vừa", size: aspectRatio === "1:1" ? 32 : 40 },
                    { label: "Lớn", size: aspectRatio === "1:1" ? 36 : 46 },
                    { label: "Cực đại", size: aspectRatio === "1:1" ? 40 : 50 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setIsAutoFontSize(false);
                        setFontSize(p.size);
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all cursor-pointer ${
                        !isAutoFontSize && fontSize === p.size
                          ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                          : "bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
                      }`}
                    >
                      {p.label} ({p.size}px)
                    </button>
                  ))}
                </div>
              </div>

              {/* Realtime formatted preview snippet with scaled font simulation */}
              <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Mô phỏng kích thước & màu nổi bật:</span>
                  <span className="text-blue-400 font-semibold">Cỡ chữ {effectiveFontSize}px</span>
                </div>
                <p
                  className="leading-relaxed transition-all"
                  style={{
                    fontSize: `${Math.max(12, Math.min(22, Math.round(effectiveFontSize * 0.38)))}px`,
                  }}
                >
                  {renderFormattedHookText()}
                </p>
              </div>
            </div>

            {/* Facebook Caption Editor */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-600/30 flex-shrink-0">
                    <span className="material-symbols-outlined text-lg">campaign</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">Caption Đăng Facebook</h3>
                    <p className="text-xs text-slate-400">Nội dung bài viết đăng kèm video lên Fanpage</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={handleRegenerateCaption}
                    disabled={isGeneratingCaption}
                    className="p-1.5 px-2.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    title="AI Viết lại caption Facebook"
                  >
                    <span className={`material-symbols-outlined text-sm ${isGeneratingCaption ? "animate-spin" : ""}`}>
                      refresh
                    </span>
                    <span>{isGeneratingCaption ? "Đang viết..." : "Tạo lại AI"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyCaption}
                    disabled={!facebookCaption.trim()}
                    className="py-1.5 px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-blue-600/20"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {copiedCaption ? "check" : "content_copy"}
                    </span>
                    <span>{copiedCaption ? "Đã chép" : "Sao chép"}</span>
                  </button>
                </div>
              </div>

              <textarea
                rows={5}
                value={facebookCaption}
                onChange={(e) => setFacebookCaption(e.target.value)}
                placeholder="Nhập hoặc tạo caption đăng Facebook kèm video..."
                className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-medium text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all resize-y"
              />

              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>
                  {facebookCaption.length} ký tự • {facebookCaption.trim() ? facebookCaption.trim().split(/\s+/).length : 0} từ
                </span>
                {articleData?.url && !facebookCaption.includes(articleData.url) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFacebookCaption((prev) => `${prev.trim()}\n\n👉 Full Story: ${articleData.url}`);
                    }}
                    className="text-blue-400 hover:text-blue-300 hover:underline text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">add_link</span>
                    <span>+ Chèn link bài viết</span>
                  </button>
                )}
              </div>
            </div>

            {/* Video Settings */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-200">Cấu Hình Video</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Aspect Ratio */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold">Tỷ lệ khung hình</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAspectRatio("9:16")}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        aspectRatio === "9:16"
                          ? "bg-blue-600/20 border-blue-500 text-blue-400"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">stay_current_portrait</span>
                      <span>9:16 Dọc</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAspectRatio("1:1")}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        aspectRatio === "1:1"
                          ? "bg-blue-600/20 border-blue-500 text-blue-400"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">crop_square</span>
                      <span>1:1 Vuông</span>
                    </button>
                  </div>
                </div>

                {/* Duration */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold">Thời lượng video</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  >
                    <option value={4}>4 Giây (Siêu nhanh)</option>
                    <option value={6}>6 Giây (Khuyên dùng)</option>
                    <option value={8}>8 Giây</option>
                    <option value={10}>10 Giây</option>
                  </select>
                </div>

                {/* Badge text */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold">Tiêu đề Card</label>
                  <input
                    type="text"
                    value={badgeText}
                    onChange={(e) => setBadgeText(e.target.value.toUpperCase())}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-red-500 font-extrabold text-xs tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-red-500/40"
                  />
                </div>
              </div>
            </div>

            {/* Kho Nhạc Nền Miễn Phí (Facebook Sound Collection) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-600 via-rose-600 to-amber-600 flex items-center justify-center text-white shadow-md shadow-rose-600/30 flex-shrink-0">
                    <span className="material-symbols-outlined text-lg">music_note</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-200">
                        Kho Nhạc Miễn Phí Facebook
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-950 text-blue-400 border border-blue-800">
                        Sound Collection
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Chọn bản nhạc phù hợp với không khí video hoặc tải lên nhạc riêng
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => musicFileInputRef.current?.click()}
                    disabled={isUploadingMusic}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-700 cursor-pointer"
                  >
                    <span className={`material-symbols-outlined text-sm ${isUploadingMusic ? "animate-spin" : ""}`}>
                      {isUploadingMusic ? "progress_activity" : "upload"}
                    </span>
                    <span>{isUploadingMusic ? "Đang tải..." : "Tải nhạc lên (.mp3)"}</span>
                  </button>

                  <a
                    href="https://www.facebook.com/sound/collection"
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all border border-blue-500/30"
                    title="Mở thư viện âm thanh chính thức của Facebook"
                  >
                    <span>Meta Sound</span>
                    <span className="material-symbols-outlined text-xs">open_in_new</span>
                  </a>
                </div>
              </div>

              {/* Hidden file input for music */}
              <input
                ref={musicFileInputRef}
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleUploadCustomMusic(e.target.files[0]);
                }}
                className="hidden"
              />

              {/* Hidden audio element for preview */}
              <audio
                ref={audioPreviewRef}
                onEnded={() => setPlayingTrackId(null)}
                className="hidden"
              />

              {/* Volume & Status Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-semibold">Đang chọn:</span>
                  <span className="font-bold text-white px-2 py-0.5 bg-slate-800 rounded-md truncate max-w-[200px] sm:max-w-[260px]">
                    {musicTracks.find((m) => m.id === selectedMusicId)?.title || "Chưa chọn"}
                  </span>
                </div>

                {selectedMusicId !== "none" && (
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-slate-400 text-sm">
                      {musicVolume === 0 ? "volume_off" : musicVolume < 50 ? "volume_down" : "volume_up"}
                    </span>
                    <span className="text-slate-400 font-semibold whitespace-nowrap">
                      Âm lượng: {musicVolume}%
                    </span>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      step={5}
                      value={musicVolume}
                      onChange={(e) => setMusicVolume(Number(e.target.value))}
                      className="w-24 sm:w-28 accent-blue-500 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* Tracks List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                {musicTracks.map((track) => {
                  const isSelected = selectedMusicId === track.id;
                  const isPlaying = playingTrackId === track.id;
                  const isSilent = track.id === "none";

                  return (
                    <div
                      key={track.id}
                      onClick={() => setSelectedMusicId(track.id)}
                      className={`relative p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                        isSelected
                          ? "bg-blue-950/30 border-blue-500 ring-1 ring-blue-500/40"
                          : "bg-slate-950/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950"
                      }`}
                    >
                      {/* Play/Pause Button */}
                      {!isSilent ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePreviewAudio(track);
                          }}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all cursor-pointer shadow ${
                            isPlaying
                              ? "bg-rose-600 text-white animate-pulse"
                              : "bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white"
                          }`}
                          title={isPlaying ? "Tạm dừng nghe thử" : "Bấm để nghe thử"}
                        >
                          <span className="material-symbols-outlined text-lg">
                            {isPlaying ? "pause" : "play_arrow"}
                          </span>
                        </button>
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0 text-slate-500">
                          <span className="material-symbols-outlined text-lg">volume_off</span>
                        </div>
                      )}

                      {/* Track Details */}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-white truncate">{track.title}</h4>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${
                              track.category === "Tin Nóng"
                                ? "bg-red-950 text-red-400 border border-red-800/60"
                                : track.category === "Hồi Hộp"
                                ? "bg-amber-950 text-amber-400 border border-amber-800/60"
                                : track.category === "Tắt Nhạc"
                                ? "bg-slate-800 text-slate-400"
                                : "bg-blue-950 text-blue-400 border border-blue-800/60"
                            }`}
                          >
                            {track.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">{track.description}</p>
                      </div>

                      {/* Selection Radio Indicator */}
                      <div className="flex items-center justify-center flex-shrink-0">
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                            isSelected
                              ? "border-blue-500 bg-blue-600 text-white"
                              : "border-slate-700 bg-slate-900"
                          }`}
                        >
                          {isSelected && (
                            <span className="material-symbols-outlined text-xs font-bold">check</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Error Message if any */}
            {actionError && (
              <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl flex items-center gap-3 text-red-300 text-sm">
                <span className="material-symbols-outlined text-red-400">error</span>
                <span>{actionError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handlePreviewFrame}
                disabled={isPreviewing || isRendering}
                className="flex-1 py-3.5 px-5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-bold text-sm rounded-xl flex items-center justify-center gap-2 border border-slate-700 transition-all cursor-pointer"
              >
                {isPreviewing ? (
                  <>
                    <span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>
                    <span>Đang tạo ảnh preview...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">image</span>
                    <span>Xem Trước Ảnh (Preview Frame)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleRenderVideo}
                disabled={isRendering || isPreviewing}
                className="flex-1 py-3.5 px-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-blue-600/30 transition-all cursor-pointer"
              >
                {isRendering ? (
                  <>
                    <span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>
                    <span>{renderProgress || "Đang render video MP4..."}</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">movie</span>
                    <span>Tạo Video MP4 Ngay</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Studio Live Preview & Video Player */}
          <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-8">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              {/* Tab Navigation */}
              <div className="flex border-b border-slate-800 bg-slate-950/60 p-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === "preview"
                      ? "bg-slate-800 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">photo</span>
                  <span>Ảnh xem trước (Frame)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("video")}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === "video"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">play_circle</span>
                  <span>Video thành phẩm</span>
                  {videoResult && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
                  )}
                </button>
              </div>

              {/* Tab Contents */}
              <div className="p-4 flex flex-col items-center justify-center min-h-[460px] bg-slate-950/40">
                {activeTab === "preview" ? (
                  previewImageUrl ? (
                    <div className="space-y-3 w-full flex flex-col items-center">
                      <div className="relative rounded-xl overflow-hidden border border-slate-800 max-h-[580px] shadow-2xl bg-black">
                        <img
                          src={previewImageUrl}
                          alt="Hook Frame Preview"
                          className="w-full h-auto max-h-[580px] object-contain"
                        />
                      </div>
                      <div className="flex items-center justify-between w-full text-xs text-slate-400 px-1">
                        <span>Đã căn lề pixel-perfect qua Edge</span>
                        <a
                          href={previewImageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-blue-400 flex items-center gap-1"
                        >
                          <span>Xem kích thước gốc</span>
                          <span className="material-symbols-outlined text-xs">open_in_new</span>
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-8 space-y-3 text-slate-500">
                      <span className="material-symbols-outlined text-5xl text-slate-700">image</span>
                      <p className="text-xs">Chưa có ảnh xem trước</p>
                      <button
                        type="button"
                        onClick={handlePreviewFrame}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white rounded-lg transition-colors cursor-pointer"
                      >
                        Bấm để tạo ảnh xem trước
                      </button>
                    </div>
                  )
                ) : (
                  videoResult ? (
                    <div className="space-y-4 w-full flex flex-col items-center">
                      <div className="relative rounded-xl overflow-hidden border border-slate-800 max-h-[580px] shadow-2xl bg-black w-full flex items-center justify-center">
                        <video
                          key={videoResult.videoUrl}
                          src={videoResult.videoUrl}
                          controls
                          autoPlay
                          loop
                          className="w-full h-auto max-h-[580px] object-contain rounded-xl"
                        />
                      </div>

                      {/* Video Actions */}
                      <div className="w-full space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                          <span>
                            {videoResult.aspectRatio} • {videoResult.duration}s • {videoResult.imageCount} ảnh
                            {videoResult.musicId && videoResult.musicId !== "none" && (
                              <span className="text-amber-400 font-semibold ml-1">
                                • 🎵 {musicTracks.find((m) => m.id === videoResult.musicId)?.title || "Nhạc nền"}
                              </span>
                            )}
                          </span>
                          <span>{videoResult.createdAt}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <a
                            href={videoResult.videoUrl}
                            download={videoResult.fileName}
                            className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-emerald-600/20"
                          >
                            <span className="material-symbols-outlined text-base">download</span>
                            <span>Tải Video MP4</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => {
                              const fullUrl = `${window.location.origin}${videoResult.videoUrl}`;
                              navigator.clipboard.writeText(fullUrl);
                              setCopiedLink(true);
                              setTimeout(() => setCopiedLink(false), 2000);
                            }}
                            className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-base">
                              {copiedLink ? "check" : "content_copy"}
                            </span>
                            <span>{copiedLink ? "Đã chép link" : "Sao chép link"}</span>
                          </button>
                        </div>

                        {/* Ô Caption Đăng Facebook */}
                        <div className="w-full mt-3 bg-gradient-to-b from-slate-900 to-slate-950 border border-blue-500/30 rounded-2xl p-4 space-y-3 shadow-xl">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/30">
                                <span className="material-symbols-outlined text-base">campaign</span>
                              </div>
                              <div>
                                <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">
                                  Ô Caption Đăng Facebook
                                </h4>
                                <p className="text-[11px] text-slate-400">
                                  Copy để đăng kèm video lên Facebook
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={handleCopyCaption}
                              disabled={!facebookCaption.trim()}
                              className="py-1.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/30 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-sm">
                                {copiedCaption ? "check" : "content_copy"}
                              </span>
                              <span>{copiedCaption ? "Đã sao chép!" : "Sao chép Caption"}</span>
                            </button>
                          </div>

                          <textarea
                            rows={5}
                            value={facebookCaption}
                            onChange={(e) => setFacebookCaption(e.target.value)}
                            placeholder="Nội dung Caption đăng Facebook..."
                            className="w-full p-3 bg-slate-950/90 border border-slate-800 rounded-xl text-slate-100 font-medium text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all resize-y shadow-inner"
                          />

                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                            <span className="font-semibold text-slate-400">
                              {facebookCaption.length} ký tự
                            </span>
                            <div className="flex items-center gap-3">
                              {articleData?.url && !facebookCaption.includes(articleData.url) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFacebookCaption((prev) => `${prev.trim()}\n\n👉 Full Story: ${articleData.url}`);
                                  }}
                                  className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-xs">add_link</span>
                                  <span>Chèn link</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={handleRegenerateCaption}
                                disabled={isGeneratingCaption}
                                className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <span className={`material-symbols-outlined text-xs ${isGeneratingCaption ? "animate-spin" : ""}`}>
                                  refresh
                                </span>
                                <span>{isGeneratingCaption ? "Đang tạo..." : "AI Tạo lại"}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-8 space-y-3 text-slate-500">
                      <span className="material-symbols-outlined text-5xl text-slate-700">movie</span>
                      <p className="text-xs">Chưa render video thành phẩm</p>
                      <button
                        type="button"
                        onClick={handleRenderVideo}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white rounded-lg transition-colors cursor-pointer"
                      >
                        Bấm để tạo video MP4
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Videos History */}
      {recentVideos.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400">history</span>
              <h3 className="text-sm font-bold text-white">Video Đã Tạo Gần Đây (Session)</h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setRecentVideos([]);
                localStorage.removeItem("ztteam_url_videos_history");
              }}
              className="text-xs text-slate-500 hover:text-red-400 transition-colors"
            >
              Xoá lịch sử
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentVideos.map((vid, idx) => (
              <div
                key={idx}
                className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex gap-3 items-center group hover:border-slate-700 transition-all"
              >
                <div className="w-14 h-20 bg-slate-900 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center border border-slate-800">
                  <video
                    src={vid.videoUrl}
                    className="w-full h-full object-cover"
                    muted
                    preload="metadata"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <h4 className="text-xs font-bold text-white truncate">{vid.title}</h4>
                  <p className="text-[11px] text-slate-400 truncate">
                    {vid.aspectRatio} • {vid.duration}s • {vid.createdAt}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setVideoResult(vid);
                        if (vid.facebookCaption) {
                          setFacebookCaption(vid.facebookCaption);
                        }
                        if (vid.musicId) {
                          setSelectedMusicId(vid.musicId);
                        }
                        setActiveTab("video");
                        window.scrollTo({ top: 300, behavior: "smooth" });
                      }}
                      className="text-[11px] text-blue-400 hover:underline font-semibold"
                    >
                      Xem video
                    </button>
                    <span className="text-slate-600">•</span>
                    <a
                      href={vid.videoUrl}
                      download={vid.fileName}
                      className="text-[11px] text-emerald-400 hover:underline font-semibold"
                    >
                      Tải về
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal dán ảnh từ URL hoặc trực tiếp */}
      {showPasteUrlModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">content_paste</span>
                </div>
                <h3 className="text-base font-bold text-white">Dán Ảnh Làm Video</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPasteUrlModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Quick paste dropzone */}
            <div
              tabIndex={0}
              onPaste={async (e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                const imageFiles: File[] = [];
                for (let i = 0; i < items.length; i++) {
                  if (items[i].type.startsWith("image/")) {
                    const file = items[i].getAsFile();
                    if (file) imageFiles.push(file);
                  }
                }
                if (imageFiles.length > 0) {
                  e.preventDefault();
                  setShowPasteUrlModal(false);
                  await handleUploadImages(imageFiles);
                  setPasteSuccessMsg(`Đã dán thành công ${imageFiles.length} ảnh từ Clipboard!`);
                  setTimeout(() => setPasteSuccessMsg(null), 3000);
                  return;
                }
                const text = e.clipboardData?.getData("text")?.trim();
                if (text && (text.startsWith("http://") || text.startsWith("https://") || text.startsWith("data:image/"))) {
                  e.preventDefault();
                  await handlePasteImageUrl(text);
                }
              }}
              className="p-6 border-2 border-dashed border-blue-500/50 hover:border-blue-400 bg-blue-950/20 hover:bg-blue-950/30 rounded-xl text-center cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 space-y-2 group"
            >
              <span className="material-symbols-outlined text-3xl text-blue-400 group-hover:scale-110 transition-transform">
                assignment_returned
              </span>
              <div>
                <p className="text-sm font-bold text-white">Bấm vào khung này rồi ấn Ctrl + V</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Dán ảnh chụp màn hình, ảnh copy từ website hoặc bộ nhớ đệm
                </p>
              </div>
            </div>

            {/* Or Paste URL Form */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">
                Hoặc dán trực tiếp đường link ảnh (URL):
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://example.com/photo.jpg..."
                  value={pastedUrlInput}
                  onChange={(e) => setPastedUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && pastedUrlInput.trim()) {
                      e.preventDefault();
                      handlePasteImageUrl(pastedUrlInput.trim());
                    }
                  }}
                  className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => handlePasteImageUrl(pastedUrlInput.trim())}
                  disabled={isUploadingImages || !pastedUrlInput.trim()}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer flex-shrink-0"
                >
                  <span className={`material-symbols-outlined text-xs ${isUploadingImages ? "animate-spin" : ""}`}>
                    {isUploadingImages ? "progress_activity" : "add_photo_alternate"}
                  </span>
                  <span>{isUploadingImages ? "Đang tải..." : "Thêm ảnh"}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Hỗ trợ các định dạng ảnh phổ biến: JPG, PNG, WEBP, AVIF hoặc Base64
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowPasteUrlModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast thông báo dán ảnh thành công */}
      {pasteSuccessMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 text-xs font-bold border border-emerald-400/30">
          <span className="material-symbols-outlined text-base">check_circle</span>
          <span>{pasteSuccessMsg}</span>
        </div>
      )}
    </div>
  );
}
