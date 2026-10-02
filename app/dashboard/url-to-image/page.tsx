"use client";

import { useState, useEffect, useRef } from "react";

interface ZTTeamFetchedData {
  title: string;
  url: string;
  siteName: string;
  excerpt: string;
  images: string[];
  badgeText?: string;
  hookText: string;
  facebookCaption?: string;
}

interface ZTTeamCollageResult {
  imageUrl: string;
  fileName: string;
  title: string;
  hookText: string;
  badgeText: string;
  layout: string;
  aspectRatio: "1:1" | "4:5" | "9:16" | "16:9";
  imageCount: number;
  facebookCaption?: string;
  markerType?: string;
  markerX?: number;
  markerY?: number;
  showInsetCircle?: boolean;
  insetImageUrl?: string;
  insetX?: number;
  insetY?: number;
  insetSize?: number;
  createdAt: string;
}

type LayoutType =
  | "card"
  | "split_h"
  | "split_v"
  | "grid3"
  | "grid3_top"
  | "triptych_h"
  | "grid4"
  | "grid1_3"
  | "pip_circle"
  | "poster";

type AspectRatioType = "1:1" | "4:5" | "9:16" | "16:9";
type MarkerType = "none" | "circle" | "arrow" | "circle_arrow";
type ArrowDirType = "bottom-left" | "bottom-right" | "top-left" | "top-right" | "left" | "bottom";

export default function ZTTeamUrlToImagePage() {
  const [urlInput, setUrlInput] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Studio State
  const [articleData, setArticleData] = useState<ZTTeamFetchedData | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [layout, setLayout] = useState<LayoutType>("card");
  const [aspectRatio, setAspectRatio] = useState<AspectRatioType>("1:1");
  const [gap, setGap] = useState<number>(6);
  const [borderColor, setBorderColor] = useState<string>("#0f172a");
  const [showText, setShowText] = useState<boolean>(true);
  const [badgeText, setBadgeText] = useState("BREAKING NEWS");
  const [hookText, setHookText] = useState("");
  const [facebookCaption, setFacebookCaption] = useState("");
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Visual Attention Marker State (Vòng tròn đỏ & Mũi tên đỏ)
  const [markerType, setMarkerType] = useState<MarkerType>("none");
  const [markerX, setMarkerX] = useState<number>(50);
  const [markerY, setMarkerY] = useState<number>(40);
  const [markerSize, setMarkerSize] = useState<number>(160);
  const [markerColor, setMarkerColor] = useState<string>("#ef4444");
  const [arrowDirection, setArrowDirection] = useState<ArrowDirType>("bottom-left");
  const [isDraggingMarker, setIsDraggingMarker] = useState<boolean>(false);

  // Custom Keyword Highlights State (Tô màu từ khóa tùy chỉnh)
  const [customHighlights, setCustomHighlights] = useState<string[]>([]);
  const [highlightColor, setHighlightColor] = useState<string>("#facc15");

  // Regenerate Hook State
  const [isRegeneratingHook, setIsRegeneratingHook] = useState<boolean>(false);

  // Khung Tròn Inset (PiP Zoom / Detail Circle) State
  const [showInsetCircle, setShowInsetCircle] = useState<boolean>(false);
  const [insetImageIndex, setInsetImageIndex] = useState<number>(1);
  const [insetImageUrl, setInsetImageUrl] = useState<string>("");
  const [insetSize, setInsetSize] = useState<number>(32); // percentage
  const [insetX, setInsetX] = useState<number>(82); // percentage
  const [insetY, setInsetY] = useState<number>(75); // percentage
  const [insetBorderColor, setInsetBorderColor] = useState<string>("#ef4444");
  const [insetBadge, setInsetBadge] = useState<string>("ZOOM");
  const [isDraggingInset, setIsDraggingInset] = useState<boolean>(false);

  // Upload Images State
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewBoxRef = useRef<HTMLDivElement>(null);

  // Actions State
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState("");
  const [collageResult, setCollageResult] = useState<ZTTeamCollageResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"result" | "preview">("preview");

  // History State
  const [recentCollages, setRecentCollages] = useState<ZTTeamCollageResult[]>([]);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ztteam_url_collages_history");
      if (saved) {
        setRecentCollages(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const saveToHistory = (newCollage: ZTTeamCollageResult) => {
    try {
      const updated = [newCollage, ...recentCollages.slice(0, 11)];
      setRecentCollages(updated);
      localStorage.setItem("ztteam_url_collages_history", JSON.stringify(updated));
    } catch {}
  };

  /** Fetch URL Data */
  const handleFetchUrl = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!urlInput.trim()) return;

    setIsFetching(true);
    setFetchError(null);
    setActionError(null);
    setCollageResult(null);

    try {
      const res = await fetch("/api/url-image/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        const data: ZTTeamFetchedData = json.data;
        setArticleData(data);
        setHookText(data.hookText || "");
        setBadgeText(data.badgeText || "BREAKING NEWS");
        setFacebookCaption(data.facebookCaption || "");
        setSelectedImages(data.images.slice(0, 4));
        if (data.images && data.images.length > 1) {
          setInsetImageIndex(1);
          setInsetImageUrl(data.images[1]);
        } else if (data.images && data.images.length > 0) {
          setInsetImageIndex(0);
          setInsetImageUrl(data.images[0]);
        }
        setActiveTab("preview");
      } else {
        setFetchError(json.error || "Không thể cào dữ liệu từ URL này");
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Lỗi kết nối khi cào dữ liệu");
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

      const res = await fetch("/api/url-image/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (json.success && Array.isArray(json.urls) && json.urls.length > 0) {
        const newUrls: string[] = json.urls;

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
          return {
            ...prev,
            images: [...newUrls, ...prev.images],
          };
        });

        setUploadedImages((prev) => [...newUrls, ...prev]);

        // Tự động bổ sung vào danh sách chọn nếu chưa đủ 4 ảnh
        setSelectedImages((prev) => {
          const availableSlots = Math.max(0, 4 - prev.length);
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

  /** Toggle chọn / bỏ chọn ảnh */
  const toggleImageSelection = (imgUrl: string) => {
    setSelectedImages((prev) => {
      if (prev.includes(imgUrl)) {
        return prev.filter((p) => p !== imgUrl);
      } else {
        if (prev.length >= 4) {
          alert("Tối đa chọn 4 ảnh để tạo bố cục ghép chuẩn đẹp");
          return prev;
        }
        return [...prev, imgUrl];
      }
    });
  };

  /** Xoá ảnh tự tải lên */
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

  /** AI Viết lại Caption Facebook */
  const handleRegenerateCaption = async () => {
    if (!articleData && !hookText) return;
    setIsGeneratingCaption(true);
    setActionError(null);
    try {
      const res = await fetch("/api/url-image/generate-caption", {
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
        if (collageResult) {
          setCollageResult((prev) => (prev ? { ...prev, facebookCaption: json.caption } : null));
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

  /** Cập nhật vị trí điểm nhấn từ tọa độ chuột hoặc ngón tay */
  const updateMarkerFromCoords = (clientX: number, clientY: number) => {
    if (!previewBoxRef.current) return;
    const rect = previewBoxRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;
    const pctX = Math.round(Math.max(5, Math.min(95, (clickX / rect.width) * 100)));
    const pctY = Math.round(Math.max(5, Math.min(95, (clickY / rect.height) * 100)));
    setMarkerX(pctX);
    setMarkerY(pctY);
  };

  /** Cập nhật vị trí Khung Tròn Inset từ tọa độ chuột hoặc ngón tay */
  const updateInsetFromCoords = (clientX: number, clientY: number) => {
    if (!previewBoxRef.current) return;
    const rect = previewBoxRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;
    const pctX = Math.round(Math.max(10, Math.min(90, (clickX / rect.width) * 100)));
    const pctY = Math.round(Math.max(10, Math.min(90, (clickY / rect.height) * 100)));
    setInsetX(pctX);
    setInsetY(pctY);
  };

  /** Bắt đầu kéo thả điểm nhấn */
  const handlePreviewMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (markerType === "none") return;
    e.preventDefault();
    setIsDraggingMarker(true);
    updateMarkerFromCoords(e.clientX, e.clientY);
  };

  /** Hỗ trợ kéo thả trên màn hình cảm ứng */
  const handlePreviewTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (markerType === "none" || !e.touches[0]) return;
    setIsDraggingMarker(true);
    updateMarkerFromCoords(e.touches[0].clientX, e.touches[0].clientY);
  };

  /** Xử lý sự kiện kéo thả toàn màn hình (Window Drag Listener) */
  useEffect(() => {
    if (!isDraggingMarker && !isDraggingInset) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingMarker) updateMarkerFromCoords(e.clientX, e.clientY);
      if (isDraggingInset) updateInsetFromCoords(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
      setIsDraggingMarker(false);
      setIsDraggingInset(false);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        if (isDraggingMarker) updateMarkerFromCoords(e.touches[0].clientX, e.touches[0].clientY);
        if (isDraggingInset) updateInsetFromCoords(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleTouchEnd = () => {
      setIsDraggingMarker(false);
      setIsDraggingInset(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDraggingMarker, isDraggingInset]);

  /** Tạo lại tiêu đề Hook AI (~10 từ) */
  const handleRegenerateHook = async () => {
    if (!articleData) return;
    setIsRegeneratingHook(true);
    setActionError(null);
    try {
      const res = await fetch("/api/url-image/generate-hook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: articleData.title || "",
          url: articleData.url || "",
          excerpt: articleData.excerpt || "",
          siteName: articleData.siteName || "",
          currentHook: hookText,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        if (json.data.hookText) {
          setHookText(json.data.hookText);
          setCustomHighlights([]); // Tự động reset nhận diện từ khóa cho câu mới
        }
        if (json.data.badgeText && (!badgeText || badgeText === "BREAKING NEWS")) {
          setBadgeText(json.data.badgeText);
        }
      } else {
        setActionError(json.error || "Không thể tạo lại Hook");
      }
    } catch {
      setActionError("Lỗi kết nối khi tạo lại Hook");
    } finally {
      setIsRegeneratingHook(false);
    }
  };

  /** Xử lý Dán ảnh trực tiếp từ Clipboard */
  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard?.read) {
        alert("Hãy nhấn tổ hợp phím Ctrl + V trực tiếp trên bàn phím để dán ảnh đã sao chép!");
        return;
      }
      const clipboardItems = await navigator.clipboard.read();
      const imageFiles: File[] = [];

      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const ext = imageType.split("/")[1] || "png";
          const file = new File([blob], `pasted_${Date.now()}.${ext}`, { type: imageType });
          imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        await handleUploadImages(imageFiles);
      } else {
        alert("Không tìm thấy ảnh trong Clipboard. Bạn hãy chuột phải Copy ảnh ở web khác hoặc chụp màn hình rồi bấm lại nút này (hoặc Ctrl + V)!");
      }
    } catch (err) {
      console.warn("Clipboard read error, fallback to Ctrl+V:", err);
      alert("Hãy bấm phím Ctrl + V trên bàn phím để dán ảnh trực tiếp!");
    }
  };

  /** Lắng nghe phím tắt Ctrl + V trên toàn trang */
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
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
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [articleData, uploadedImages, selectedImages]);

  // Tổng hợp tất cả các ảnh có sẵn (ảnh upload/paste, ảnh bài viết, ảnh đã chọn)
  const allAvailableImages: string[] = Array.from(
    new Set([
      ...(uploadedImages || []),
      ...(selectedImages || []),
      ...(articleData?.images || []),
    ])
  ).filter((img): img is string => Boolean(img && typeof img === "string"));

  const currentInsetImageUrl: string =
    insetImageUrl && allAvailableImages.includes(insetImageUrl)
      ? insetImageUrl
      : (allAvailableImages[insetImageIndex] || allAvailableImages[1] || allAvailableImages[0] || selectedImages[0] || "");

  /** Render Ảnh Ghép Chất Lượng Cao */
  const handleRenderCollage = async () => {
    if (selectedImages.length === 0) {
      setActionError("Vui lòng chọn ít nhất 1 ảnh để ghép");
      return;
    }

    setIsRendering(true);
    setActionError(null);
    setRenderProgress("Đang ghép ảnh, xử lý font chữ và xuất ảnh chuẩn nét với Edge Headless...");

    try {
      const res = await fetch("/api/url-image/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: selectedImages,
          layout,
          aspectRatio,
          hookText,
          badgeText,
          showText,
          gap,
          borderColor,
          title: articleData?.title || "URL Collage Image",
          facebookCaption,
          markerType,
          markerX,
          markerY,
          markerSize,
          markerColor,
          arrowDirection,
          customHighlights,
          highlightColor,
          showInsetCircle: Boolean(showInsetCircle || layout === "pip_circle"),
          insetImageIndex,
          insetImageUrl: currentInsetImageUrl,
          insetSize,
          insetX,
          insetY,
          insetBorderColor,
          insetBadge,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        const newResult: ZTTeamCollageResult = {
          ...json.data,
          facebookCaption: facebookCaption || json.data.facebookCaption || "",
        };
        setCollageResult(newResult);
        saveToHistory(newResult);
        setActiveTab("result");
      } else {
        setActionError(json.error || "Lỗi khi render ảnh");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Lỗi kết nối khi render ảnh ghép");
    } finally {
      setIsRendering(false);
      setRenderProgress("");
    }
  };

  /** Sao chép ảnh trực tiếp vào Clipboard để Paste lên Facebook */
  const handleCopyImageToClipboard = async () => {
    if (!collageResult?.imageUrl) return;
    try {
      const response = await fetch(collageResult.imageUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);
      setCopiedImage(true);
      setTimeout(() => setCopiedImage(false), 2500);
    } catch (err) {
      console.warn("Direct clipboard image copy failed, copying link instead:", err);
      try {
        const fullUrl = `${window.location.origin}${collageResult.imageUrl}`;
        await navigator.clipboard.writeText(fullUrl);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } catch {}
    }
  };

  /** Clean word for comparing */
  const cleanWord = (w: string) =>
    w.replace(/^[^\w\u00C0-\u024F\u1E00-\u1EFF]+|[^\w\u00C0-\u024F\u1E00-\u1EFF]+$/g, "").toLowerCase();

  /** Auto-detect keywords (first words, capitalized, numbers, punctuations) */
  const isWordAutoHighlighted = (w: string, idx: number, total: number) => {
    const isFirstFew = idx < 2;
    const isLastFew =
      idx >= total - 8 &&
      (w.includes("...") || w.includes("(") || w.includes("Click") || w.includes("link") || w.includes("story") || w.includes("details"));
    return isFirstFew || isLastFew || /[A-Z]{3,}|\d+|[%$!]/.test(w);
  };

  /** Check if a word is currently highlighted */
  const isWordHighlighted = (w: string, idx: number, total: number): boolean => {
    if (customHighlights.length > 0) {
      if (customHighlights.includes("__NONE__")) return false;
      const cw = cleanWord(w);
      if (!cw) return false;
      return customHighlights.some((h) => {
        const ch = cleanWord(h);
        return ch === cw || (cw.length >= 3 && ch.length >= 3 && (cw.includes(ch) || ch.includes(cw)));
      });
    }
    return isWordAutoHighlighted(w, idx, total);
  };

  /** Toggle custom word highlight */
  const handleToggleWordHighlight = (w: string, idx: number) => {
    const cw = cleanWord(w);
    if (!cw) return;

    const words = hookText.trim().split(/\s+/).filter(Boolean);

    // If currently in auto mode (customHighlights is empty)
    if (customHighlights.length === 0) {
      const activeWords = words
        .filter((word, i) => isWordAutoHighlighted(word, i, words.length))
        .map(cleanWord)
        .filter(Boolean);

      let updated: string[];
      if (activeWords.includes(cw)) {
        updated = activeWords.filter((item) => item !== cw);
      } else {
        updated = [...activeWords, cw];
      }
      setCustomHighlights(updated.length > 0 ? updated : ["__NONE__"]);
    } else {
      let updated: string[];
      if (customHighlights.includes(cw)) {
        updated = customHighlights.filter((item) => item !== cw && item !== "__NONE__");
      } else {
        updated = [...customHighlights.filter((item) => item !== "__NONE__"), cw];
      }
      setCustomHighlights(updated.length > 0 ? updated : ["__NONE__"]);
    }
  };

  /** Format highlighted words for preview */
  const renderFormattedHookText = () => {
    const words = hookText.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return null;

    return words.map((w, idx) => {
      const isHigh = isWordHighlighted(w, idx, words.length);
      return (
        <span
          key={idx}
          style={isHigh ? { color: highlightColor } : undefined}
          className={isHigh ? "font-extrabold" : "text-white font-bold"}
        >
          {w}{" "}
        </span>
      );
    });
  };

  const getAspectRatioClasses = () => {
    switch (aspectRatio) {
      case "4:5":
        return "aspect-[4/5] max-w-[420px]";
      case "9:16":
        return "aspect-[9/16] max-w-[340px]";
      case "16:9":
        return "aspect-[16/9] max-w-[540px]";
      case "1:1":
      default:
        return "aspect-square max-w-[440px]";
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 rounded-xl shadow-lg shadow-purple-500/20 text-white flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">auto_awesome_mosaic</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              URL to Image Collage Studio
            </h1>
          </div>
          <p className="text-sm text-slate-400">
            Nhập từng link bài viết riêng biệt để cào ảnh, chọn mẫu ghép ảnh viral chuyên nghiệp, thêm vòng tròn & mũi tên đỏ, tạo caption đăng Facebook ngay lập tức.
          </p>
        </div>
      </div>

      {/* URL Input Box */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <form onSubmit={handleFetchUrl} className="space-y-4">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
            Nhập đường link bài viết cần ghép ảnh (URL)
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                link
              </span>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/breaking-news-story..."
                required
                className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all shadow-inner"
              />
            </div>
            <button
              type="submit"
              disabled={isFetching || !urlInput.trim()}
              className="py-3 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 cursor-pointer flex-shrink-0"
            >
              {isFetching ? (
                <>
                  <span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>
                  <span>Đang cào ảnh & tin...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">search</span>
                  <span>Cào Dữ Liệu & Ảnh</span>
                </>
              )}
            </button>
          </div>
        </form>

        {fetchError && (
          <div className="mt-4 p-3 bg-red-950/40 border border-red-800/80 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-red-400">error</span>
            <span>{fetchError}</span>
          </div>
        )}
      </div>

      {/* Main Studio Area */}
      {articleData && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Settings, Images & Content (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Image Selector & Upload */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">Chọn Ảnh Ghép (Tối đa 4 ảnh)</h3>
                    <p className="text-xs text-slate-400">
                      Bấm vào ảnh để chọn theo thứ tự hiển thị trong bố cục
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                      if (e.target.files) handleUploadImages(e.target.files);
                    }}
                    multiple
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImages}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-700 cursor-pointer"
                  >
                    <span className={`material-symbols-outlined text-sm ${isUploadingImages ? "animate-spin" : ""}`}>
                      {isUploadingImages ? "progress_activity" : "upload"}
                    </span>
                    <span>{isUploadingImages ? "Đang tải..." : "Tải từ máy"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    disabled={isUploadingImages}
                    className="px-3 py-1.5 bg-purple-950/70 hover:bg-purple-900/80 disabled:opacity-50 text-purple-300 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border border-purple-800/80 cursor-pointer shadow-sm"
                    title="Dán ảnh trực tiếp từ bộ nhớ tạm Clipboard (hoặc bấm Ctrl+V bất kỳ lúc nào)"
                  >
                    <span className="material-symbols-outlined text-sm">content_paste</span>
                    <span>Dán ảnh (Ctrl+V)</span>
                  </button>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-800 text-purple-400 border border-slate-700">
                    Đã chọn {selectedImages.length}/4
                  </span>
                </div>
              </div>

              {/* Fast Paste Shortcut Tip */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800/60">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs text-amber-400">tips_and_updates</span>
                  <span>Mẹo: Bạn có thể copy ảnh ở bất kỳ đâu rồi nhấn <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono text-[10px]">Ctrl + V</kbd> để dán ảnh vào ngay!</span>
                </span>
              </div>

              {/* Image Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {articleData.images.map((imgUrl, idx) => {
                  const isSelected = selectedImages.includes(imgUrl);
                  const selectedIdx = selectedImages.indexOf(imgUrl);
                  const isCustom = uploadedImages.includes(imgUrl);

                  return (
                    <div
                      key={idx}
                      onClick={() => toggleImageSelection(imgUrl)}
                      className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all group ${
                        isSelected
                          ? "border-purple-500 ring-2 ring-purple-500/30 shadow-md scale-[1.02]"
                          : "border-slate-800 hover:border-slate-700 opacity-75 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={imgUrl}
                        alt={`Article img ${idx}`}
                        className="w-full h-full object-cover"
                      />

                      {/* Selection Order Badge */}
                      {isSelected && (
                        <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-purple-600 text-white font-extrabold text-xs flex items-center justify-center shadow-lg">
                          {selectedIdx + 1}
                        </div>
                      )}

                      {/* Custom Upload Badge & Delete */}
                      {isCustom && (
                        <div className="absolute bottom-2 left-2">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-900/90 text-purple-200 border border-purple-700">
                            Tự tải lên
                          </span>
                        </div>
                      )}

                      {isCustom && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteUploadedImage(e, imgUrl)}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-600/90 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-md cursor-pointer opacity-0 group-hover:opacity-100"
                          title="Xoá ảnh này"
                        >
                          <span className="material-symbols-outlined text-xs">close</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Layout Templates */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-200">Chọn Bố Cục Ghép Ảnh (Layout)</h3>
                  <p className="text-xs text-slate-400">Đa dạng mẫu ghép từ cơ bản đến nâng cao</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* 1. Breaking News Card */}
                <button
                  type="button"
                  onClick={() => setLayout("card")}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                    layout === "card"
                      ? "bg-purple-600/15 border-purple-500 text-white ring-1 ring-purple-500/30"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="w-full h-12 bg-slate-800/80 rounded-lg flex flex-col overflow-hidden border border-slate-700/50">
                    <div className="h-7 bg-slate-700/60 w-full" />
                    <div className="h-1 bg-red-500 w-full" />
                    <div className="flex-1 bg-slate-900 p-1 flex items-center">
                      <div className="h-1.5 w-12 bg-amber-400/80 rounded" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">📰 News Card</h4>
                    <p className="text-[10px] text-slate-400 leading-tight">Ảnh trên + Thẻ chữ to ở dưới</p>
                  </div>
                </button>

                {/* 2. Split Horizontal */}
                <button
                  type="button"
                  onClick={() => setLayout("split_h")}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                    layout === "split_h"
                      ? "bg-purple-600/15 border-purple-500 text-white ring-1 ring-purple-500/30"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="w-full h-12 bg-slate-800/80 rounded-lg flex gap-1 p-1 overflow-hidden border border-slate-700/50">
                    <div className="flex-1 bg-slate-700/60 rounded" />
                    <div className="flex-1 bg-slate-700/60 rounded" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">⚡ Split 50/50 Ngang</h4>
                    <p className="text-[10px] text-slate-400 leading-tight">2 ảnh cạnh nhau Before/After</p>
                  </div>
                </button>

                {/* 3. Split Vertical */}
                <button
                  type="button"
                  onClick={() => setLayout("split_v")}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                    layout === "split_v"
                      ? "bg-purple-600/15 border-purple-500 text-white ring-1 ring-purple-500/30"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="w-full h-12 bg-slate-800/80 rounded-lg flex flex-col gap-1 p-1 overflow-hidden border border-slate-700/50">
                    <div className="flex-1 bg-slate-700/60 rounded" />
                    <div className="flex-1 bg-slate-700/60 rounded" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">↕️ Split 50/50 Dọc</h4>
                    <p className="text-[10px] text-slate-400 leading-tight">2 ảnh trên & dưới</p>
                  </div>
                </button>

                {/* 4. Grid 3 Top/Bottom */}
                <button
                  type="button"
                  onClick={() => setLayout("grid3_top")}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                    layout === "grid3_top"
                      ? "bg-purple-600/15 border-purple-500 text-white ring-1 ring-purple-500/30"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="w-full h-12 bg-slate-800/80 rounded-lg flex flex-col gap-1 p-1 overflow-hidden border border-slate-700/50">
                    <div className="h-6 bg-slate-700/60 rounded w-full" />
                    <div className="flex-1 flex gap-1">
                      <div className="flex-1 bg-slate-700/60 rounded" />
                      <div className="flex-1 bg-slate-700/60 rounded" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">📐 1 Trên + 2 Dưới</h4>
                    <p className="text-[10px] text-slate-400 leading-tight">Hiện trường trên, 2 ảnh phụ dưới</p>
                  </div>
                </button>

                {/* 5. Triptych 3 Columns */}
                <button
                  type="button"
                  onClick={() => setLayout("triptych_h")}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                    layout === "triptych_h"
                      ? "bg-purple-600/15 border-purple-500 text-white ring-1 ring-purple-500/30"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="w-full h-12 bg-slate-800/80 rounded-lg flex gap-1 p-1 overflow-hidden border border-slate-700/50">
                    <div className="flex-1 bg-slate-700/60 rounded" />
                    <div className="flex-1 bg-slate-700/60 rounded" />
                    <div className="flex-1 bg-slate-700/60 rounded" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">🏛️ 3 Cột Đứng</h4>
                    <p className="text-[10px] text-slate-400 leading-tight">3 ảnh chia đều song song</p>
                  </div>
                </button>

                {/* 6. Grid 3 Side */}
                <button
                  type="button"
                  onClick={() => setLayout("grid3")}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                    layout === "grid3"
                      ? "bg-purple-600/15 border-purple-500 text-white ring-1 ring-purple-500/30"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="w-full h-12 bg-slate-800/80 rounded-lg flex gap-1 p-1 overflow-hidden border border-slate-700/50">
                    <div className="w-1/2 bg-slate-700/60 rounded" />
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex-1 bg-slate-700/60 rounded" />
                      <div className="flex-1 bg-slate-700/60 rounded" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">🎨 1 Lớn + 2 Nhỏ Dọc</h4>
                    <p className="text-[10px] text-slate-400 leading-tight">1 ảnh chính + 2 ảnh phụ bên phải</p>
                  </div>
                </button>

                {/* 7. Grid 4 */}
                <button
                  type="button"
                  onClick={() => setLayout("grid4")}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                    layout === "grid4"
                      ? "bg-purple-600/15 border-purple-500 text-white ring-1 ring-purple-500/30"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="w-full h-12 bg-slate-800/80 rounded-lg grid grid-cols-2 gap-1 p-1 overflow-hidden border border-slate-700/50">
                    <div className="bg-slate-700/60 rounded" />
                    <div className="bg-slate-700/60 rounded" />
                    <div className="bg-slate-700/60 rounded" />
                    <div className="bg-slate-700/60 rounded" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">⊞ Grid 4 Ảnh</h4>
                    <p className="text-[10px] text-slate-400 leading-tight">Lưới 4 ảnh 2x2 cân xứng</p>
                  </div>
                </button>

                {/* 8. Grid 1 + 3 */}
                <button
                  type="button"
                  onClick={() => setLayout("grid1_3")}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                    layout === "grid1_3"
                      ? "bg-purple-600/15 border-purple-500 text-white ring-1 ring-purple-500/30"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="w-full h-12 bg-slate-800/80 rounded-lg flex gap-1 p-1 overflow-hidden border border-slate-700/50">
                    <div className="flex-[1.5] bg-slate-700/60 rounded" />
                    <div className="flex-1 flex flex-col gap-0.5">
                      <div className="flex-1 bg-slate-700/60 rounded" />
                      <div className="flex-1 bg-slate-700/60 rounded" />
                      <div className="flex-1 bg-slate-700/60 rounded" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">🗂️ 1 Lớn + 3 Nhỏ</h4>
                    <p className="text-[10px] text-slate-400 leading-tight">1 hero shot + 3 chi tiết</p>
                  </div>
                </button>

                {/* 9. Picture-in-Picture Inset Circle */}
                <button
                  type="button"
                  onClick={() => {
                    setLayout("pip_circle");
                    setShowInsetCircle(true);
                  }}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                    layout === "pip_circle"
                      ? "bg-purple-600/15 border-purple-500 text-white ring-1 ring-purple-500/30"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="w-full h-12 bg-slate-800/80 rounded-lg relative overflow-hidden border border-slate-700/50">
                    <div className="absolute inset-0 bg-slate-700/60" />
                    <div className="absolute bottom-1 right-2 w-6 h-6 rounded-full border-2 border-red-500 bg-slate-900 shadow-md" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">⭕ Khung Tròn Inset</h4>
                    <p className="text-[10px] text-slate-400 leading-tight">Ảnh nền + Ảnh chi tiết lồng tròn</p>
                  </div>
                </button>

                {/* 10. Poster Overlay */}
                <button
                  type="button"
                  onClick={() => setLayout("poster")}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                    layout === "poster"
                      ? "bg-purple-600/15 border-purple-500 text-white ring-1 ring-purple-500/30"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="w-full h-12 bg-slate-800/80 rounded-lg relative overflow-hidden border border-slate-700/50">
                    <div className="absolute inset-0 bg-slate-700/60" />
                    <div className="absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-slate-950 via-slate-900/80 to-transparent p-1 flex items-end">
                      <div className="h-1.5 w-16 bg-red-500 rounded" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">🎬 Poster Overlay</h4>
                    <p className="text-[10px] text-slate-400 leading-tight">Ảnh tràn khung + Gradient tối</p>
                  </div>
                </button>
              </div>

              {/* Khung Tròn Inset (PiP Zoom) Settings & Customization */}
              <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">⭕</span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">
                        Khung Tròn Inset (Lồng ảnh chi tiết / Zoom)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Có thể bật lồng thêm lên bất kỳ kiểu chia ảnh nào phía trên
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowInsetCircle(!showInsetCircle)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      showInsetCircle || layout === "pip_circle"
                        ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {showInsetCircle || layout === "pip_circle" ? "check_circle" : "add_circle"}
                    </span>
                    <span>{showInsetCircle || layout === "pip_circle" ? "Đang Bật Inset" : "Bật Khung Inset"}</span>
                  </button>
                </div>

                {(showInsetCircle || layout === "pip_circle") && (
                  <div className="p-4 bg-slate-950/90 border border-red-500/30 rounded-xl space-y-4 shadow-lg">
                    {/* 1. Chọn ảnh lồng vào khung tròn */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <label className="text-slate-300 font-semibold flex items-center gap-1">
                          <span>Chọn ảnh hiển thị trong khung tròn:</span>
                        </label>
                        <span className="text-slate-400 text-[11px]">
                          {selectedImages.includes(currentInsetImageUrl)
                            ? `Ảnh ghép #${selectedImages.indexOf(currentInsetImageUrl) + 1}`
                            : `Ảnh #${Math.max(1, allAvailableImages.indexOf(currentInsetImageUrl) + 1)}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                        {allAvailableImages.slice(0, 24).map((imgUrl, i) => {
                          const isCurrent = currentInsetImageUrl === imgUrl;
                          return (
                            <div
                              key={i}
                              onClick={() => {
                                setInsetImageIndex(i);
                                setInsetImageUrl(imgUrl);
                              }}
                              className={`relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                                isCurrent
                                  ? "border-red-500 ring-2 ring-red-500/50 scale-105 shadow-md shadow-red-500/30"
                                  : "border-slate-700 opacity-60 hover:opacity-100"
                              }`}
                            >
                              <img src={imgUrl} alt={`Inset ${i}`} className="w-full h-full object-cover" />
                              <span className="absolute bottom-0 inset-x-0 text-[8px] font-bold text-center bg-black/80 text-white truncate px-0.5">
                                {selectedImages.includes(imgUrl) ? `Ghép #${selectedImages.indexOf(imgUrl) + 1}` : `Ảnh ${i + 1}`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. Kích thước khung tròn Inset */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                          <span>Kích thước khung tròn:</span>
                          <span className="text-red-400 font-bold bg-red-950/70 px-2 py-0.5 rounded border border-red-800/60">
                            {insetSize}%
                          </span>
                        </label>
                        <div className="flex items-center gap-1">
                          {[
                            { label: "Nhỏ", size: 22 },
                            { label: "Vừa", size: 32 },
                            { label: "Lớn", size: 40 },
                            { label: "Cực lớn", size: 48 },
                          ].map((p) => (
                            <button
                              key={p.size}
                              type="button"
                              onClick={() => setInsetSize(p.size)}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer ${
                                Math.abs(insetSize - p.size) < 5
                                  ? "bg-red-600 text-white"
                                  : "bg-slate-800 text-slate-400 hover:text-white"
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        type="range"
                        min={18}
                        max={50}
                        step={1}
                        value={insetSize}
                        onChange={(e) => setInsetSize(Number(e.target.value))}
                        className="w-full accent-red-500 cursor-pointer"
                      />
                    </div>

                    {/* 3. Vị trí khung tròn Inset */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <label className="text-slate-300 font-semibold">Vị trí khung tròn:</label>
                        <span className="text-[11px] text-slate-400">
                          X: {insetX}% • Y: {insetY}% (hoặc kéo thả trên ảnh xem trước)
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400">Ngang (X): {insetX}%</span>
                          <input
                            type="range"
                            min={10}
                            max={90}
                            value={insetX}
                            onChange={(e) => setInsetX(Number(e.target.value))}
                            className="w-full accent-red-500 cursor-pointer"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400">Dọc (Y): {insetY}%</span>
                          <input
                            type="range"
                            min={10}
                            max={90}
                            value={insetY}
                            onChange={(e) => setInsetY(Number(e.target.value))}
                            className="w-full accent-red-500 cursor-pointer"
                          />
                        </div>
                      </div>
                      {/* Nút đặt vị trí nhanh */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] text-slate-500">Vị trí nhanh:</span>
                        {[
                          { label: "↘ Dưới-Phải", x: 82, y: 75 },
                          { label: "↙ Dưới-Trái", x: 20, y: 75 },
                          { label: "↗ Trên-Phải", x: 82, y: 25 },
                          { label: "↖ Trên-Trái", x: 20, y: 25 },
                          { label: "⏺ Giữa", x: 50, y: 50 },
                        ].map((pos) => (
                          <button
                            key={pos.label}
                            type="button"
                            onClick={() => {
                              setInsetX(pos.x);
                              setInsetY(pos.y);
                            }}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer ${
                              Math.abs(insetX - pos.x) < 8 && Math.abs(insetY - pos.y) < 8
                                ? "bg-red-600/30 text-red-300 border border-red-500"
                                : "bg-slate-800 text-slate-400 hover:text-white"
                            }`}
                          >
                            {pos.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 4. Tùy chọn Viền & Huy hiệu */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-800/80">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400 font-semibold">Màu viền khung tròn</label>
                        <select
                          value={insetBorderColor}
                          onChange={(e) => setInsetBorderColor(e.target.value)}
                          className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-bold"
                        >
                          <option value="#ef4444">🔴 Đỏ Rực (Tiêu chuẩn)</option>
                          <option value="#facc15">🟡 Vàng Neon</option>
                          <option value="#38bdf8">🔵 Xanh Cyan</option>
                          <option value="#ffffff">⚪ Trắng Tinh</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400 font-semibold">Chữ huy hiệu (Badge)</label>
                        <input
                          type="text"
                          value={insetBadge}
                          onChange={(e) => setInsetBadge(e.target.value.toUpperCase())}
                          placeholder="Ví dụ: ZOOM, CHI TIẾT..."
                          className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-bold"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Aspect Ratio & Borders */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-200">Tỷ Lệ Khung Hình & Viền Khung</h3>
                  <p className="text-xs text-slate-400">Tuỳ chỉnh kích thước xuất ảnh và đường viền giữa các ảnh</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Aspect Ratio */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold">Tỷ lệ khung hình</label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value as AspectRatioType)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  >
                    <option value="1:1">1:1 Vuông (1080x1080 - Facebook Feed)</option>
                    <option value="4:5">4:5 Dọc (1080x1350 - Tối ưu Mobile)</option>
                    <option value="9:16">9:16 Dọc (1080x1920 - Story/Pin)</option>
                    <option value="16:9">16:9 Ngang (1200x675 - Banner)</option>
                  </select>
                </div>

                {/* Gap Spacing */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold">Khoảng cách giữa ảnh</label>
                  <select
                    value={gap}
                    onChange={(e) => setGap(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  >
                    <option value={0}>0px (Khít liền kề)</option>
                    <option value={4}>4px (Mảnh tinh tế)</option>
                    <option value={8}>8px (Vừa vặn tiêu chuẩn)</option>
                    <option value={14}>14px (Viền dày nổi bật)</option>
                  </select>
                </div>

                {/* Border Color */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold">Màu sắc viền</label>
                  <select
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  >
                    <option value="#0f172a">Đen Slate (#0f172a)</option>
                    <option value="#000000">Đen Tuyền (#000000)</option>
                    <option value="#ffffff">Trắng Sáng (#ffffff)</option>
                    <option value="#ef4444">Đỏ Cảnh Báo (#ef4444)</option>
                  </select>
                </div>
              </div>

              {/* Show text toggle */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-200">Hiển thị Tiêu đề & Hook lên ảnh</span>
                  <p className="text-[11px] text-slate-400">Tắt nếu chỉ muốn xuất ảnh collage thuần túy không chữ</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowText(!showText)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    showText
                      ? "bg-purple-600/20 border-purple-500 text-purple-300"
                      : "bg-slate-950 border-slate-800 text-slate-500"
                  }`}
                >
                  {showText ? "Đang bật chữ" : "Chỉ ghép ảnh thuần"}
                </button>
              </div>
            </div>

            {/* 4. Attention Markers (Red Circle & Red Arrow) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center font-bold text-sm">
                    🎯
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">Điểm Nhấn Thị Giác (Vòng Tròn & Mũi Tên)</h3>
                    <p className="text-xs text-slate-400">Khoanh vùng chi tiết bí ẩn để kích thích người xem click xem bài</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setMarkerType("none")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      markerType === "none" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Tắt
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarkerType("circle")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      markerType === "circle" ? "bg-red-600 text-white shadow-md shadow-red-600/30" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    ⭕ Vòng tròn
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarkerType("arrow")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      markerType === "arrow" ? "bg-red-600 text-white shadow-md shadow-red-600/30" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    ↗️ Mũi tên
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarkerType("circle_arrow")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      markerType === "circle_arrow" ? "bg-red-600 text-white shadow-md shadow-red-600/30" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    🎯 Cả hai
                  </button>
                </div>
              </div>

              {markerType !== "none" && (
                <div className="space-y-4 pt-2 border-t border-slate-800/80">
                  {/* Preset Quick Positions (9 points) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <label className="text-slate-400 font-semibold">Chọn nhanh vị trí đặt điểm nhấn:</label>
                      <span className="text-[11px] text-purple-400">💡 Hoặc click trực tiếp vào ảnh xem trước</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 max-w-sm">
                      {[
                        { label: "↖ Trên Trái", x: 25, y: 25 },
                        { label: "⬆ Trên Giữa", x: 50, y: 25 },
                        { label: "↗ Trên Phải", x: 75, y: 25 },
                        { label: "⬅ Giữa Trái", x: 25, y: 50 },
                        { label: "🎯 Trung Tâm", x: 50, y: 50 },
                        { label: "➡ Giữa Phải", x: 75, y: 50 },
                        { label: "↙ Dưới Trái", x: 25, y: 75 },
                        { label: "⬇ Dưới Giữa", x: 50, y: 75 },
                        { label: "↘ Dưới Phải", x: 75, y: 75 },
                      ].map((pos, pIdx) => {
                        const isCurrent = Math.abs(markerX - pos.x) <= 5 && Math.abs(markerY - pos.y) <= 5;
                        return (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => {
                              setMarkerX(pos.x);
                              setMarkerY(pos.y);
                            }}
                            className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all cursor-pointer truncate ${
                              isCurrent
                                ? "bg-red-600/20 border-red-500 text-red-300"
                                : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                            }`}
                          >
                            {pos.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sliders for fine-tuning */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400 font-semibold">Tọa độ Ngang (X)</span>
                        <span className="text-slate-300 font-bold">{markerX}%</span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={90}
                        value={markerX}
                        onChange={(e) => setMarkerX(Number(e.target.value))}
                        className="w-full accent-red-500 cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400 font-semibold">Tọa độ Dọc (Y)</span>
                        <span className="text-slate-300 font-bold">{markerY}%</span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={90}
                        value={markerY}
                        onChange={(e) => setMarkerY(Number(e.target.value))}
                        className="w-full accent-red-500 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Options: Size, Arrow Direction, Color */}
                  <div className="space-y-3 pt-2 border-t border-slate-800/80">
                    {/* Size Slider & Quick Presets */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <label className="text-slate-400 font-semibold flex items-center gap-1.5">
                          <span>Kích thước vòng tròn & mũi tên:</span>
                          <span className="text-red-400 font-bold bg-red-950/60 px-2 py-0.5 rounded border border-red-800/60">
                            {markerSize}px
                          </span>
                        </label>
                        <div className="flex items-center gap-1">
                          {[
                            { label: "Nhỏ", size: 100 },
                            { label: "Vừa", size: 160 },
                            { label: "Lớn", size: 240 },
                            { label: "Rất lớn", size: 300 },
                          ].map((p) => (
                            <button
                              key={p.size}
                              type="button"
                              onClick={() => setMarkerSize(p.size)}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer ${
                                Math.abs(markerSize - p.size) < 15
                                  ? "bg-red-600 text-white"
                                  : "bg-slate-800 text-slate-400 hover:text-white"
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        type="range"
                        min={60}
                        max={360}
                        step={5}
                        value={markerSize}
                        onChange={(e) => setMarkerSize(Number(e.target.value))}
                        className="w-full accent-red-500 cursor-pointer"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(markerType === "arrow" || markerType === "circle_arrow") && (
                        <div className="space-y-1">
                          <label className="text-xs text-slate-400 font-semibold">Hướng mũi tên</label>
                          <select
                            value={arrowDirection}
                            onChange={(e) => setArrowDirection(e.target.value as ArrowDirType)}
                            className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-bold"
                          >
                            <option value="bottom-left">↗ Từ dưới-trái lên</option>
                            <option value="bottom-right">↖ Từ dưới-phải lên</option>
                            <option value="top-left">↘ Từ trên-trái xuống</option>
                            <option value="top-right">↙ Từ trên-phải xuống</option>
                            <option value="left">➔ Từ trái sang</option>
                            <option value="bottom">⬆ Từ dưới thẳng lên</option>
                          </select>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-xs text-slate-400 font-semibold">Màu sắc điểm nhấn</label>
                        <select
                          value={markerColor}
                          onChange={(e) => setMarkerColor(e.target.value)}
                          className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-bold"
                        >
                          <option value="#ef4444">🔴 Đỏ Rực (Tiêu chuẩn)</option>
                          <option value="#facc15">🟡 Vàng Neon (Bắt mắt)</option>
                          <option value="#3b82f6">🔵 Xanh Dương Điện</option>
                          <option value="#22c55e">🟢 Xanh Lá Neon</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Text & Badge Editor */}
            {showText && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold text-sm">
                      5
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-200">Tiêu Đề & Huy Hiệu (Badge)</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          hookText.trim().split(/\s+/).filter(Boolean).length >= 8 && hookText.trim().split(/\s+/).filter(Boolean).length <= 14
                            ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                            : "bg-amber-950 text-amber-400 border-amber-800"
                        }`}>
                          {hookText.trim() ? hookText.trim().split(/\s+/).filter(Boolean).length : 0}/10 từ {hookText.trim().split(/\s+/).filter(Boolean).length >= 8 && hookText.trim().split(/\s+/).filter(Boolean).length <= 14 ? "(Chuẩn)" : "(Nên ~10 từ)"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">Tiêu đề ngắn gọn ~10 từ gây tò mò, an toàn và không dính vi phạm từ ngữ Facebook</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Huy hiệu (Badge Text)</label>
                    <input
                      type="text"
                      value={badgeText}
                      onChange={(e) => setBadgeText(e.target.value.toUpperCase())}
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-red-500 font-extrabold text-xs tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-red-500/40"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <label className="text-slate-400 font-semibold">Tiêu đề chính (Hook ngắn ~10 từ)</label>
                        <button
                          type="button"
                          onClick={handleRegenerateHook}
                          disabled={isRegeneratingHook}
                          className="px-2 py-0.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 hover:text-white rounded-md text-[11px] font-bold flex items-center gap-1 transition-all border border-purple-500/30 cursor-pointer disabled:opacity-50"
                          title="Tạo lại tiêu đề hook mới (~10 từ) chuẩn chính sách Facebook"
                        >
                          <span className={`material-symbols-outlined text-xs ${isRegeneratingHook ? "animate-spin" : ""}`}>
                            {isRegeneratingHook ? "progress_activity" : "autorenew"}
                          </span>
                          <span>{isRegeneratingHook ? "Đang tạo..." : "Tạo lại Hook"}</span>
                        </button>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {hookText.trim() ? hookText.trim().split(/\s+/).filter(Boolean).length : 0} từ • {hookText.length} ký tự
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      value={hookText}
                      onChange={(e) => setHookText(e.target.value)}
                      placeholder="Ví dụ: Officials reveal shocking details found right at the scene..."
                      className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-500/40 resize-y"
                    />
                  </div>

                  {/* Realtime formatted preview snippet with clickable word customization */}
                  <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-amber-400">palette</span>
                          Màu chữ làm nổi bật từ khóa:
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-slate-800 text-slate-300">
                          {customHighlights.length > 0
                            ? customHighlights.includes("__NONE__")
                              ? "Tắt tô màu"
                              : `${customHighlights.length} từ tùy chỉnh`
                            : "Tự động AI"}
                        </span>
                      </div>

                      {/* Color Palette Selector */}
                      <div className="flex items-center gap-1.5">
                        {[
                          { color: "#facc15", label: "Vàng" },
                          { color: "#ef4444", label: "Đỏ" },
                          { color: "#22c55e", label: "Xanh lá" },
                          { color: "#38bdf8", label: "Cyan" },
                          { color: "#f97316", label: "Cam" },
                          { color: "#ffffff", label: "Trắng" },
                        ].map((c) => (
                          <button
                            key={c.color}
                            type="button"
                            title={`Màu ${c.label}`}
                            onClick={() => setHighlightColor(c.color)}
                            className={`w-6 h-6 rounded-full border transition-all cursor-pointer flex items-center justify-center text-[10px] ${
                              highlightColor === c.color
                                ? "ring-2 ring-white scale-110 shadow-lg"
                                : "opacity-70 hover:opacity-100"
                            }`}
                            style={{ backgroundColor: c.color, borderColor: "#334155" }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Word Chips: Click to toggle highlight */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Nhấp vào từng từ để bật/tắt tô màu nổi bật:</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCustomHighlights([])}
                            className={`text-[10px] px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                              customHighlights.length === 0
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-slate-800 text-slate-400 hover:text-white"
                            }`}
                          >
                            ✨ Tự động
                          </button>
                          <button
                            type="button"
                            onClick={() => setCustomHighlights(["__NONE__"])}
                            className={`text-[10px] px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                              customHighlights.includes("__NONE__")
                                ? "bg-red-500/20 text-red-300 border border-red-500/40"
                                : "bg-slate-800 text-slate-400 hover:text-white"
                            }`}
                          >
                            🚫 Tắt tô màu
                          </button>
                        </div>
                      </div>

                      {hookText.trim() ? (
                        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-900/90 rounded-lg border border-slate-800/80">
                          {hookText.trim().split(/\s+/).filter(Boolean).map((w, idx) => {
                            const words = hookText.trim().split(/\s+/).filter(Boolean);
                            const isHigh = isWordHighlighted(w, idx, words.length);
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleToggleWordHighlight(w, idx)}
                                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                  isHigh
                                    ? "shadow-sm border scale-105"
                                    : "bg-slate-800/80 text-slate-400 border border-slate-700/60 hover:text-white hover:bg-slate-700"
                                }`}
                                style={
                                  isHigh
                                    ? {
                                        backgroundColor: `${highlightColor}25`,
                                        borderColor: highlightColor,
                                        color: highlightColor,
                                      }
                                    : undefined
                                }
                              >
                                <span>{w}</span>
                                {isHigh && (
                                  <span className="text-[10px] opacity-80">✓</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 italic p-2 bg-slate-900/50 rounded-lg">
                          Chưa có tiêu đề. Nhập tiêu đề ở trên để chọn từ khóa cần tô màu.
                        </div>
                      )}
                    </div>

                    {/* Preview line */}
                    <div className="pt-2 border-t border-slate-800/60 flex items-start gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap mt-0.5">
                        Xem trước chữ:
                      </span>
                      <p className="text-xs leading-relaxed">
                        {renderFormattedHookText()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 6. Facebook Caption Editor */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-sm">
                    6
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">Caption Đăng Facebook</h3>
                    <p className="text-xs text-slate-400">Nội dung bài viết đăng kèm ảnh lên Fanpage</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={handleRegenerateCaption}
                    disabled={isGeneratingCaption}
                    className="p-1.5 px-2.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1 cursor-pointer"
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
                placeholder="Nhập hoặc tạo caption đăng Facebook kèm ảnh..."
                className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-medium text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
              />

              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>
                  {facebookCaption.length} ký tự • {facebookCaption.trim() ? facebookCaption.trim().split(/\s+/).length : 0} từ
                </span>
                {articleData?.url && (
                  <button
                    type="button"
                    onClick={() => {
                      setFacebookCaption((prev) => {
                        const cleaned = prev.replace(new RegExp(`(👉|🔗|👇)?\\s*(Full Story|Link)?:?\\s*${articleData.url}`, "gi"), "").trim();
                        return `👉 Full Story & Details: ${articleData.url}\n\n${cleaned}`;
                      });
                    }}
                    className="text-blue-400 hover:text-blue-300 hover:underline text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">arrow_upward</span>
                    <span>Đưa link lên đầu bài viết</span>
                  </button>
                )}
              </div>
            </div>

            {/* Render Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleRenderCollage}
                disabled={isRendering || selectedImages.length === 0}
                className="w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-purple-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {isRendering ? (
                  <>
                    <span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>
                    <span>{renderProgress || "Đang render ảnh ghép..."}</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-xl">auto_awesome</span>
                    <span>Tạo Ảnh Ghép Chất Lượng Cao (Render 2K)</span>
                  </>
                )}
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-red-950/40 border border-red-800/80 rounded-xl text-red-300 text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-red-400">error</span>
                <span>{actionError}</span>
              </div>
            )}
          </div>

          {/* Right Column: Studio Live Preview & Result (5 Cols) */}
          <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4 z-30 max-h-[calc(100vh-2rem)] lg:overflow-y-auto pr-1 scrollbar-thin">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              {/* Tab Navigation */}
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 p-1.5">
                <div className="flex flex-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab("preview")}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeTab === "preview"
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">visibility</span>
                    <span>Xem trước (Live)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("result")}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeTab === "result"
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">image</span>
                    <span>Ảnh Thành Phẩm</span>
                    {collageResult && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
                    )}
                  </button>
                </div>
                <div className="hidden xl:flex items-center gap-1 text-[10px] text-slate-500 font-semibold px-2" title="Khung xem trước được tự động ghim khi bạn kéo xuống xem các cài đặt khác">
                  <span>📌</span>
                  <span>Ghim theo dõi</span>
                </div>
              </div>

              {/* Tab Contents */}
              <div className="p-4 flex flex-col items-center justify-center min-h-[460px] bg-slate-950/40">
                {activeTab === "preview" ? (
                  /* CSS Realtime Live Preview */
                  <div className="w-full flex flex-col items-center space-y-3">
                    <div
                      ref={previewBoxRef}
                      onMouseDown={handlePreviewMouseDown}
                      onTouchStart={handlePreviewTouchStart}
                      className={`w-full ${getAspectRatioClasses()} rounded-xl overflow-hidden shadow-2xl relative flex flex-col select-none transition-shadow ${
                        markerType !== "none" || showInsetCircle || layout === "pip_circle"
                          ? isDraggingMarker || isDraggingInset
                            ? "cursor-grabbing ring-2 ring-red-500/50"
                            : "cursor-grab"
                          : ""
                      }`}
                      style={{ backgroundColor: borderColor }}
                      title="Nhấn giữ chuột & kéo thả trực tiếp để di chuyển vòng tròn & Inset"
                    >
                      {/* Dragging Help Indicator Badge */}
                      {(markerType !== "none" || showInsetCircle || layout === "pip_circle") && (
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 bg-black/85 backdrop-blur-md border border-red-500/60 px-3 py-1 rounded-full text-[10px] font-bold text-white flex items-center gap-1.5 shadow-xl pointer-events-none transition-all">
                          <span className="material-symbols-outlined text-xs text-red-400">
                            {isDraggingMarker || isDraggingInset ? "pan_tool" : "drag_pan"}
                          </span>
                          <span>
                            {isDraggingMarker
                              ? "Đang di chuyển Điểm Nhấn..."
                              : isDraggingInset
                              ? "Đang di chuyển Khung Inset..."
                              : "Nhấn giữ & Kéo thả để di chuyển Vòng Tròn / Inset"}
                          </span>
                        </div>
                      )}
                      {/* 1. Layout: News Card */}
                      {layout === "card" && (
                        <div className="w-full h-full flex flex-col">
                          <div className={`w-full ${showText ? "h-[62%]" : "h-full"} relative bg-slate-950 overflow-hidden`}>
                            {selectedImages[0] ? (
                              <img src={selectedImages[0]} alt="P1" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                                Chưa chọn ảnh
                              </div>
                            )}
                          </div>
                          {showText && (
                            <div className="h-[38%] bg-slate-800 flex flex-col justify-between p-3.5 border-t-4 border-red-500">
                              <span className="text-red-500 font-black text-xs tracking-wider uppercase">
                                {badgeText || "BREAKING NEWS"}
                              </span>
                              <p className="text-xs font-bold text-white line-clamp-3 leading-snug">
                                {renderFormattedHookText()}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 2. Layout: Split Horizontal */}
                      {layout === "split_h" && (
                        <div className="w-full h-full flex" style={{ gap: `${gap}px` }}>
                          <div className="flex-1 h-full bg-slate-900 overflow-hidden">
                            {selectedImages[0] && (
                              <img src={selectedImages[0]} alt="P1" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="flex-1 h-full bg-slate-900 overflow-hidden">
                            {selectedImages[1] ? (
                              <img src={selectedImages[1]} alt="P2" className="w-full h-full object-cover" />
                            ) : selectedImages[0] ? (
                              <img src={selectedImages[0]} alt="P1 fallback" className="w-full h-full object-cover" />
                            ) : null}
                          </div>
                        </div>
                      )}

                      {/* 3. Layout: Split Vertical */}
                      {layout === "split_v" && (
                        <div className="w-full h-full flex flex-col" style={{ gap: `${gap}px` }}>
                          <div className="flex-1 w-full bg-slate-900 overflow-hidden">
                            {selectedImages[0] && (
                              <img src={selectedImages[0]} alt="P1" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="flex-1 w-full bg-slate-900 overflow-hidden">
                            {selectedImages[1] ? (
                              <img src={selectedImages[1]} alt="P2" className="w-full h-full object-cover" />
                            ) : selectedImages[0] ? (
                              <img src={selectedImages[0]} alt="P1 fallback" className="w-full h-full object-cover" />
                            ) : null}
                          </div>
                        </div>
                      )}

                      {/* 4. Layout: Grid 3 Top/Bottom */}
                      {layout === "grid3_top" && (
                        <div className="w-full h-full flex flex-col" style={{ gap: `${gap}px` }}>
                          <div className="flex-[1.4] w-full bg-slate-900 overflow-hidden">
                            {selectedImages[0] && (
                              <img src={selectedImages[0]} alt="P1" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="flex-1 w-full flex" style={{ gap: `${gap}px` }}>
                            <div className="flex-1 h-full bg-slate-900 overflow-hidden">
                              {selectedImages[1] ? (
                                <img src={selectedImages[1]} alt="P2" className="w-full h-full object-cover" />
                              ) : null}
                            </div>
                            <div className="flex-1 h-full bg-slate-900 overflow-hidden">
                              {selectedImages[2] ? (
                                <img src={selectedImages[2]} alt="P3" className="w-full h-full object-cover" />
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 5. Layout: Triptych 3 Columns */}
                      {layout === "triptych_h" && (
                        <div className="w-full h-full flex" style={{ gap: `${gap}px` }}>
                          <div className="flex-1 h-full bg-slate-900 overflow-hidden">
                            {selectedImages[0] && (
                              <img src={selectedImages[0]} alt="P1" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="flex-1 h-full bg-slate-900 overflow-hidden">
                            {selectedImages[1] ? (
                              <img src={selectedImages[1]} alt="P2" className="w-full h-full object-cover" />
                            ) : null}
                          </div>
                          <div className="flex-1 h-full bg-slate-900 overflow-hidden">
                            {selectedImages[2] ? (
                              <img src={selectedImages[2]} alt="P3" className="w-full h-full object-cover" />
                            ) : null}
                          </div>
                        </div>
                      )}

                      {/* 6. Layout: Grid 3 Side */}
                      {layout === "grid3" && (
                        <div className="w-full h-full flex" style={{ gap: `${gap}px` }}>
                          <div className="flex-[1.25] h-full bg-slate-900 overflow-hidden">
                            {selectedImages[0] && (
                              <img src={selectedImages[0]} alt="P1" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="flex-[0.95] h-full flex flex-col" style={{ gap: `${gap}px` }}>
                            <div className="flex-1 bg-slate-900 overflow-hidden">
                              {selectedImages[1] ? (
                                <img src={selectedImages[1]} alt="P2" className="w-full h-full object-cover" />
                              ) : null}
                            </div>
                            <div className="flex-1 bg-slate-900 overflow-hidden">
                              {selectedImages[2] ? (
                                <img src={selectedImages[2]} alt="P3" className="w-full h-full object-cover" />
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 7. Layout: Grid 4 */}
                      {layout === "grid4" && (
                        <div className="w-full h-full grid grid-cols-2 grid-rows-2" style={{ gap: `${gap}px` }}>
                          {[0, 1, 2, 3].map((pos) => (
                            <div key={pos} className="bg-slate-900 overflow-hidden">
                              {selectedImages[pos] ? (
                                <img src={selectedImages[pos]} alt={`P${pos}`} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-700 text-xs">
                                  #{pos + 1}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 8. Layout: Grid 1 + 3 */}
                      {layout === "grid1_3" && (
                        <div className="w-full h-full flex" style={{ gap: `${gap}px` }}>
                          <div className="flex-[1.6] h-full bg-slate-900 overflow-hidden">
                            {selectedImages[0] && (
                              <img src={selectedImages[0]} alt="P1" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="flex-1 h-full flex flex-col" style={{ gap: `${gap}px` }}>
                            {[1, 2, 3].map((pos) => (
                              <div key={pos} className="flex-1 bg-slate-900 overflow-hidden">
                                {selectedImages[pos] ? (
                                  <img src={selectedImages[pos]} alt={`P${pos}`} className="w-full h-full object-cover" />
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 9. Layout: Picture-in-Picture Base Image */}
                      {layout === "pip_circle" && (
                        <div className="w-full h-full relative bg-slate-950 overflow-hidden">
                          {selectedImages[0] ? (
                            <img src={selectedImages[0]} alt="P1" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                              Chưa chọn ảnh
                            </div>
                          )}
                        </div>
                      )}

                      {/* 10. Layout: Poster Overlay */}
                      {layout === "poster" && (
                        <div className="w-full h-full relative bg-slate-950 overflow-hidden">
                          {selectedImages[0] && (
                            <img src={selectedImages[0]} alt="P1" className="w-full h-full object-cover" />
                          )}
                          <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent flex flex-col gap-1.5">
                            {badgeText && (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-red-600 text-white self-start">
                                {badgeText}
                              </span>
                            )}
                            <p className="text-xs font-bold text-white line-clamp-3">
                              {renderFormattedHookText()}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Floating Text banner for other layouts if enabled */}
                      {showText && layout !== "card" && layout !== "poster" && hookText.trim() && (
                        <div className="absolute bottom-3 inset-x-3 bg-slate-950/90 backdrop-blur-md border border-red-500/70 rounded-xl p-2.5 shadow-xl flex flex-col gap-1 z-20">
                          {badgeText && (
                            <span className="text-[10px] font-extrabold text-red-400 uppercase tracking-wider">
                              {badgeText}
                            </span>
                          )}
                          <p className="text-[11px] font-bold text-white line-clamp-2 leading-tight">
                            {renderFormattedHookText()}
                          </p>
                        </div>
                      )}

                      {/* Live Inset Circle Overlay (Áp dụng cho mọi khung chia ảnh và pip_circle) */}
                      {(showInsetCircle || layout === "pip_circle") && (
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setIsDraggingInset(true);
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            setIsDraggingInset(true);
                          }}
                          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full overflow-hidden shadow-2xl transition-transform select-none z-25 ${
                            isDraggingInset ? "cursor-grabbing ring-4 ring-white scale-105" : "cursor-grab hover:scale-105"
                          }`}
                          style={{
                            left: `${insetX}%`,
                            top: `${insetY}%`,
                            width: `${insetSize}%`,
                            height: `${insetSize}%`,
                            border: `3.5px solid ${insetBorderColor}`,
                            boxShadow: `0 8px 24px rgba(0,0,0,0.85), 0 0 15px ${insetBorderColor}99`,
                            backgroundColor: "#000000",
                          }}
                          title="Nhấn giữ chuột & kéo thả để di chuyển Khung Tròn Inset"
                        >
                          <img
                            src={currentInsetImageUrl || ""}
                            alt="Inset Zoom"
                            className="w-full h-full object-cover pointer-events-none"
                          />
                          {insetBadge && (
                            <div className="absolute bottom-1 inset-x-0 text-center pointer-events-none">
                              <span
                                className="px-1.5 py-0.5 rounded text-[8px] font-black text-white uppercase tracking-wider shadow"
                                style={{ backgroundColor: insetBorderColor }}
                              >
                                {insetBadge}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Live Visual Attention Marker Overlay (Vòng tròn đỏ & Mũi tên đỏ) */}
                      {markerType !== "none" && (
                        <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
                          {/* Circle: Clean bold circle without inner white loop, scaled to markerSize */}
                          {(markerType === "circle" || markerType === "circle_arrow") && (
                            <div
                              className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-150"
                              style={{
                                left: `${markerX}%`,
                                top: `${markerY}%`,
                                width: `${Math.round(markerSize * (aspectRatio === "9:16" ? 0.35 : 0.4))}px`,
                                height: `${Math.round(markerSize * (aspectRatio === "9:16" ? 0.35 : 0.4))}px`,
                              }}
                            >
                              <svg viewBox="0 0 100 100" className="w-full h-full" style={{ filter: `drop-shadow(0 0 12px ${markerColor}ee) drop-shadow(0 2px 6px rgba(0,0,0,0.9))` }}>
                                <circle cx="50" cy="50" r="44" fill="none" stroke={markerColor} strokeWidth="7" />
                              </svg>
                            </div>
                          )}

                          {/* Arrow: Scaled proportionally with markerSize */}
                          {(markerType === "arrow" || markerType === "circle_arrow") && (
                            <div
                              className="absolute transition-all duration-150"
                              style={{
                                left: `${markerX}%`,
                                top: `${markerY}%`,
                                transform: `translate(${
                                  arrowDirection === "bottom-left" ? "-120%, 10%" :
                                  arrowDirection === "bottom-right" ? "20%, 10%" :
                                  arrowDirection === "top-left" ? "-120%, -100%" :
                                  arrowDirection === "top-right" ? "20%, -100%" :
                                  arrowDirection === "left" ? "-130%, -40%" :
                                  "-50%, 50%"
                                }) rotate(${
                                  arrowDirection === "bottom-left" ? "0deg" :
                                  arrowDirection === "bottom-right" ? "-90deg" :
                                  arrowDirection === "top-left" ? "90deg" :
                                  arrowDirection === "top-right" ? "180deg" :
                                  arrowDirection === "left" ? "45deg" :
                                  "-45deg"
                                })`,
                                width: `${Math.round(markerSize * (aspectRatio === "9:16" ? 0.32 : 0.36))}px`,
                                height: `${Math.round(markerSize * (aspectRatio === "9:16" ? 0.32 : 0.36))}px`,
                              }}
                            >
                              <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-[0_0_8px_rgba(239,68,68,0.9)]">
                                <defs>
                                  <linearGradient id="prevArrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#991b1b" />
                                    <stop offset="50%" stopColor={markerColor} />
                                    <stop offset="100%" stopColor="#ff6b6b" />
                                  </linearGradient>
                                </defs>
                                <path d="M 15 95 Q 40 85 68 62 L 62 82 L 112 42 L 72 15 L 75 36 Q 36 60 15 95 Z" fill="url(#prevArrowGrad)" stroke="#ffffff" strokeWidth="4.5" strokeLinejoin="round" />
                              </svg>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400 text-center">
                      {markerType !== "none" ? "👆 Nhấn giữ chuột & kéo thả trực tiếp trên ảnh để di chuyển Vòng tròn & Mũi tên" : "Live Preview theo thời gian thực"} • Bấm nút bên dưới để render ảnh 2K
                    </p>
                  </div>
                ) : (
                  /* Rendered High-Res Result Tab */
                  collageResult ? (
                    <div className="space-y-4 w-full flex flex-col items-center">
                      <div className="relative rounded-xl overflow-hidden border border-slate-800 max-h-[580px] shadow-2xl bg-black w-full flex items-center justify-center">
                        <img
                          src={`${collageResult.imageUrl}?t=${Date.now()}`}
                          alt="Collage Result"
                          className="w-full h-auto max-h-[580px] object-contain rounded-xl"
                        />
                      </div>

                      {/* Actions */}
                      <div className="w-full space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                          <span>
                            {collageResult.aspectRatio} • {collageResult.layout.toUpperCase()} • {collageResult.imageCount} ảnh
                            {collageResult.markerType && collageResult.markerType !== "none" && (
                              <span className="text-red-400 font-semibold ml-1">
                                • 🎯 Điểm nhấn
                              </span>
                            )}
                          </span>
                          <span>{collageResult.createdAt}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <a
                            href={collageResult.imageUrl}
                            download={collageResult.fileName}
                            className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-emerald-600/20"
                          >
                            <span className="material-symbols-outlined text-base">download</span>
                            <span>Tải Ảnh PNG</span>
                          </a>

                          <button
                            type="button"
                            onClick={handleCopyImageToClipboard}
                            className="py-2.5 px-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-purple-600/20"
                          >
                            <span className="material-symbols-outlined text-base">
                              {copiedImage ? "check" : "content_paste"}
                            </span>
                            <span>{copiedImage ? "Đã chép ảnh!" : "Chép vào Clipboard"}</span>
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
                                  Copy để đăng kèm ảnh lên Facebook
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
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-8 space-y-3 text-slate-500">
                      <span className="material-symbols-outlined text-5xl text-slate-700">image</span>
                      <p className="text-xs">Chưa render ảnh thành phẩm</p>
                      <button
                        type="button"
                        onClick={handleRenderCollage}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white rounded-lg transition-colors cursor-pointer"
                      >
                        Bấm để tạo ảnh 2K ngay
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Collages History */}
      {recentCollages.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-purple-400">history</span>
              <h3 className="text-sm font-bold text-white">Ảnh Ghép Đã Tạo Gần Đây (Session)</h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setRecentCollages([]);
                localStorage.removeItem("ztteam_url_collages_history");
              }}
              className="text-xs text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
            >
              Xoá lịch sử
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentCollages.map((item, idx) => (
              <div
                key={idx}
                className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-2 group hover:border-purple-500/50 transition-all"
              >
                <div className="w-full aspect-square bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center border border-slate-800">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white truncate">{item.title}</h4>
                  <p className="text-[11px] text-slate-400 truncate">
                    {item.aspectRatio} • {item.layout.toUpperCase()} • {item.createdAt}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCollageResult(item);
                        if (item.facebookCaption) {
                          setFacebookCaption(item.facebookCaption);
                        }
                        setActiveTab("result");
                        window.scrollTo({ top: 300, behavior: "smooth" });
                      }}
                      className="text-[11px] text-purple-400 hover:underline font-semibold cursor-pointer"
                    >
                      Xem lại
                    </button>
                    <a
                      href={item.imageUrl}
                      download={item.fileName}
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
    </div>
  );
}
