"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/** Interface đại diện 1 trang WP */
interface ZTTeamWpSite {
  id: number;
  name: string;
  site_url: string;
  username: string;
  app_password: string;
  created_at: string;
}

/** Trạng thái từng URL */
type ZTTeamUrlStatus = "waiting" | "fetching" | "done" | "duplicate" | "error";

interface ZTTeamUrlItem {
  url: string;
  status: ZTTeamUrlStatus;
  message?: string;
  title?: string;
}

/** Status Badge */
function ZTTeamUrlStatusBadge({ item }: { item: ZTTeamUrlItem }) {
  const ztteam_config = {
    waiting: { icon: "pause_circle", color: "text-slate-400", label: "Chờ" },
    fetching: { icon: "sync", color: "text-blue-400", label: "Đang fetch..." },
    done: { icon: "check_circle", color: "text-emerald-400", label: "Đã lưu" },
    duplicate: {
      icon: "content_copy",
      color: "text-amber-400",
      label: "Trùng URL",
    },
    error: { icon: "error", color: "text-red-400", label: "Lỗi" },
  };

  const config = ztteam_config[item.status];

  return (
    <div className={`flex items-center gap-1.5 ${config.color}`}>
      <span
        className={`material-symbols-outlined text-sm ${item.status === "fetching" ? "animate-spin" : ""}`}
      >
        {config.icon}
      </span>
      <span className="text-xs font-medium">
        {item.status === "done" && item.title ? item.title : item.message || config.label}
        {item.status === "error" && item.message ? ` — ${item.message}` : ""}
      </span>
    </div>
  );
}

export default function ZTTeamUrlsPage() {
  const [input, setInput] = useState("");
  const [urlItems, setUrlItems] = useState<ZTTeamUrlItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    done: 0,
    error: 0,
    duplicate: 0,
  });
  const pauseRef = useRef(false);
  const stopRef = useRef(false);

  /** Quản lý WordPress Sites */
  const [wpSites, setWpSites] = useState<ZTTeamWpSite[]>([]);
  const [autoPublishWp, setAutoPublishWp] = useState(false);
  const [selectedWpSiteIds, setSelectedWpSiteIds] = useState<number[]>([]);
  const [showWpModal, setShowWpModal] = useState(false);

  /** State form thêm WP Site */
  const [newWpName, setNewWpName] = useState("");
  const [newWpUrl, setNewWpUrl] = useState("");
  const [newWpUser, setNewWpUser] = useState("");
  const [newWpPass, setNewWpPass] = useState("");
  const [isSavingWp, setIsSavingWp] = useState(false);
  const [wpError, setWpError] = useState<string | null>(null);

  /** Lấy danh sách WP sites */
  const ztteam_fetchWpSites = useCallback(async () => {
    try {
      const res = await fetch("/api/wp-sites");
      const json = await res.json();
      if (json.success && Array.isArray(json.sites)) {
        setWpSites(json.sites);
        /** Mặc định chọn tất cả các sites vừa lấy */
        setSelectedWpSiteIds((prev) =>
          prev.length === 0 ? json.sites.map((s: ZTTeamWpSite) => s.id) : prev,
        );
      }
    } catch {
      console.error("Không thể kết nối lấy danh sách WP sites");
    }
  }, []);

  useEffect(() => {
    ztteam_fetchWpSites();
  }, [ztteam_fetchWpSites]);

  /** Thêm mới WP site */
  const ztteam_handleAddWpSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWpName || !newWpUrl || !newWpUser || !newWpPass) {
      setWpError("Vui lòng điền đầy đủ các trường thông tin!");
      return;
    }

    setIsSavingWp(true);
    setWpError(null);

    try {
      const res = await fetch("/api/wp-sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWpName,
          site_url: newWpUrl,
          username: newWpUser,
          app_password: newWpPass,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setWpSites((prev) => [json.site, ...prev]);
        setSelectedWpSiteIds((prev) => [...prev, json.site.id]);
        setNewWpName("");
        setNewWpUrl("");
        setNewWpUser("");
        setNewWpPass("");
        setShowWpModal(false);
      } else {
        setWpError(json.error || "Không thể lưu WordPress site");
      }
    } catch {
      setWpError("Lỗi kết nối khi lưu WordPress site");
    } finally {
      setIsSavingWp(false);
    }
  };

  /** Xóa WP site */
  const ztteam_handleDeleteWpSite = async (id: number) => {
    if (!confirm("Bạn có chắc chắn muốn xóa trang WordPress này khỏi danh sách?"))
      return;

    try {
      const res = await fetch(`/api/wp-sites?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setWpSites((prev) => prev.filter((s) => s.id !== id));
        setSelectedWpSiteIds((prev) => prev.filter((sId) => sId !== id));
      }
    } catch {
      alert("Lỗi khi xóa trang WordPress");
    }
  };

  /** Toggle chọn/bỏ chọn WP Site */
  const ztteam_toggleWpSite = (id: number) => {
    setSelectedWpSiteIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id],
    );
  };

  /** Toggle Chọn tất cả / Bỏ tất cả */
  const ztteam_toggleAllWpSites = () => {
    if (selectedWpSiteIds.length === wpSites.length) {
      setSelectedWpSiteIds([]);
    } else {
      setSelectedWpSiteIds(wpSites.map((s) => s.id));
    }
  };

  /** Parse URLs từ textarea */
  const ztteam_parseUrls = (text: string): string[] => {
    return text
      .split("\n")
      .map((url) => url.trim())
      .filter((url) => url.length > 0 && url.startsWith("http"));
  };

  /** Update trạng thái 1 URL */
  const ztteam_updateItem = useCallback(
    (url: string, update: Partial<ZTTeamUrlItem>) => {
      setUrlItems((prev) =>
        prev.map((item) => (item.url === url ? { ...item, ...update } : item)),
      );
    },
    [],
  );

  /** Fetch 1 URL & Tự động đăng WP nếu được cấu hình */
  const ztteam_fetchOne = async (url: string): Promise<void> => {
    ztteam_updateItem(url, { status: "fetching", message: "Đang fetch..." });

    try {
      const res = await fetch("/api/fetch-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();

      if (!json.success) {
        ztteam_updateItem(url, { status: "error", message: json.error });
        return;
      }

      /** Lưu vào queue */
      const saveRes = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_url: json.data.url,
          title_original: json.data.title,
          content_original: json.data.content,
          content_html: json.data.contentHtml,
          image_original: json.data.image,
        }),
      });
      const saveJson = await saveRes.json();

      if (saveJson.success) {
        let wpPublishSummary = "";

        /** Tự động xuất bản lên WordPress nếu bật */
        if (autoPublishWp && selectedWpSiteIds.length > 0) {
          ztteam_updateItem(url, {
            status: "fetching",
            message: `Đang tự động đăng lên ${selectedWpSiteIds.length} trang WP...`,
          });

          let publishedCount = 0;
          for (const siteId of selectedWpSiteIds) {
            try {
              const pubRes = await fetch("/api/publish-wp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: json.data.title,
                  content: json.data.contentHtml || json.data.content,
                  featuredImageUrl: json.data.image,
                  siteId,
                }),
              });
              const pubJson = await pubRes.json();
              if (pubJson.success) {
                publishedCount++;
              }
            } catch {
              // Bỏ qua lỗi per-site để tiếp tục đăng các site khác
            }
          }
          wpPublishSummary = ` [Đã đăng ${publishedCount}/${selectedWpSiteIds.length} WP]`;
        }

        ztteam_updateItem(url, {
          status: "done",
          title: json.data.title + wpPublishSummary,
        });
        setStats((prev) => ({ ...prev, done: prev.done + 1 }));
      } else if (saveRes.status === 409) {
        ztteam_updateItem(url, { status: "duplicate" });
        setStats((prev) => ({ ...prev, duplicate: prev.duplicate + 1 }));
      } else {
        ztteam_updateItem(url, { status: "error", message: saveJson.error });
        setStats((prev) => ({ ...prev, error: prev.error + 1 }));
      }
    } catch {
      ztteam_updateItem(url, { status: "error", message: "Không thể kết nối" });
      setStats((prev) => ({ ...prev, error: prev.error + 1 }));
    }
  };

  /** Chạy với delay giữa các request */
  const ztteam_runQueue = async (urls: string[], limit?: number) => {
    const targets = limit ? urls.slice(0, limit) : urls;
    stopRef.current = false;
    pauseRef.current = false;
    setIsRunning(true);
    setIsPaused(false);

    for (const url of targets) {
      if (stopRef.current) break;

      /** Chờ nếu đang pause */
      while (pauseRef.current) {
        await new Promise((r) => setTimeout(r, 500));
        if (stopRef.current) break;
      }

      if (stopRef.current) break;

      await ztteam_fetchOne(url);

      /** Delay 2.5s giữa các request */
      if (!stopRef.current) {
        await new Promise((r) => setTimeout(r, 2500));
      }
    }

    setIsRunning(false);
    setIsPaused(false);
  };

  /** Validate + init items */
  const ztteam_initItems = (limit?: number) => {
    const urls = ztteam_parseUrls(input);
    if (urls.length === 0) return null;

    const targets = limit ? urls.slice(0, limit) : urls;
    const items: ZTTeamUrlItem[] = targets.map((url) => ({
      url,
      status: "waiting",
    }));

    setUrlItems(items);
    setStats({ total: targets.length, done: 0, error: 0, duplicate: 0 });
    return targets;
  };

  /** Test 3 bài */
  const ztteam_handleTest = () => {
    const urls = ztteam_initItems(3);
    if (urls) ztteam_runQueue(urls, 3);
  };

  /** Chạy tất cả */
  const ztteam_handleAll = () => {
    const urls = ztteam_initItems();
    if (urls) ztteam_runQueue(urls);
  };

  /** Pause / Resume */
  const ztteam_handlePause = () => {
    pauseRef.current = !pauseRef.current;
    setIsPaused(pauseRef.current);
  };

  /** Stop */
  const ztteam_handleStop = () => {
    stopRef.current = true;
    pauseRef.current = false;
    setIsRunning(false);
    setIsPaused(false);
  };

  const urlCount = ztteam_parseUrls(input).length;

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/** Header */}
      <header>
        <h2 className="text-3xl font-black tracking-tight mb-1">URL Input</h2>
        <p className="text-slate-400">
          Nhập danh sách URL để cào nội dung và tự động xuất bản lên các trang WordPress
        </p>
      </header>

      {/** Cấu hình Tự động Đăng WordPress */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1337ec]/10 border border-[#1337ec]/30 flex items-center justify-center text-[#1337ec]">
              <span className="material-symbols-outlined">language</span>
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Tự động xuất bản lên WordPress</h3>
              <p className="text-xs text-slate-400">
                Tự động đăng bài lên các trang WordPress đã chọn ngay sau khi cào thành công
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoPublishWp}
                onChange={(e) => setAutoPublishWp(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1337ec]"></div>
              <span className="ml-3 text-sm font-semibold text-slate-300">
                {autoPublishWp ? "Đang bật Auto-Publish" : "Tắt Auto-Publish"}
              </span>
            </label>

            <button
              onClick={() => setShowWpModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg transition-all border border-slate-700"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Thêm Web WP
            </button>
          </div>
        </div>

        {/** Danh sách WordPress Sites */}
        {wpSites.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
            Chưa có trang WordPress nào được lưu. Bấm nút <strong>"+ Thêm Web WP"</strong> để khai báo website của bạn.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">
                Chọn danh sách website sẽ xuất bản bài viết ({selectedWpSiteIds.length}/{wpSites.length}):
              </span>
              <button
                onClick={ztteam_toggleAllWpSites}
                className="text-xs text-blue-400 hover:underline font-medium"
              >
                {selectedWpSiteIds.length === wpSites.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {wpSites.map((site) => {
                const isSelected = selectedWpSiteIds.includes(site.id);
                return (
                  <div
                    key={site.id}
                    onClick={() => ztteam_toggleWpSite(site.id)}
                    className={`cursor-pointer p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                      isSelected
                        ? "bg-[#1337ec]/10 border-[#1337ec] text-white"
                        : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                          isSelected
                            ? "bg-[#1337ec] border-[#1337ec] text-white"
                            : "border-slate-600 bg-transparent"
                        }`}
                      >
                        {isSelected && (
                          <span className="material-symbols-outlined text-xs">check</span>
                        )}
                      </div>
                      <div className="truncate">
                        <p className="font-bold text-xs truncate">{site.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{site.site_url}</p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        ztteam_handleDeleteWpSite(site.id);
                      }}
                      title="Xóa trang WP"
                      className="text-slate-600 hover:text-red-400 transition-colors p-1"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/** Cột trái - Input */}
        <div className="flex flex-col gap-4">
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-800/30 flex items-center justify-between">
              <h3 className="font-bold">Danh sách URL</h3>
              {urlCount > 0 && (
                <span className="text-xs font-bold px-2 py-1 rounded-full text-blue-400 bg-blue-500/10">
                  {urlCount} URLs
                </span>
              )}
            </div>
            <div className="p-4">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`https://example.com/bai-viet-1\nhttps://example.com/bai-viet-2\nhttps://example.com/bai-viet-3`}
                disabled={isRunning}
                rows={12}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-[#1337ec]/50 focus:border-[#1337ec] transition-all resize-none disabled:opacity-50 font-mono"
              />
            </div>
          </div>

          {/** Buttons */}
          <div className="flex items-center gap-3">
            {!isRunning ? (
              <>
                <button
                  onClick={ztteam_handleTest}
                  disabled={urlCount === 0}
                  className="flex items-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl transition-all text-sm"
                >
                  <span className="material-symbols-outlined text-sm">
                    science
                  </span>
                  Test 3 bài
                </button>
                <button
                  onClick={ztteam_handleAll}
                  disabled={urlCount === 0}
                  className="flex items-center gap-2 px-5 py-3 bg-[#1337ec] hover:bg-[#1337ec]/90 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl transition-all text-sm"
                >
                  <span className="material-symbols-outlined text-sm">
                    play_arrow
                  </span>
                  Chạy tất cả ({urlCount})
                </button>
                {urlItems.length > 0 && (
                  <button
                    onClick={() => {
                      setUrlItems([]);
                      setStats({ total: 0, done: 0, error: 0, duplicate: 0 });
                    }}
                    className="flex items-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold rounded-xl transition-all text-sm"
                  >
                    <span className="material-symbols-outlined text-sm">
                      clear_all
                    </span>
                    Xóa
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={ztteam_handlePause}
                  className={`flex items-center gap-2 px-5 py-3 font-bold rounded-xl transition-all text-sm ${
                    isPaused
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                      : "bg-amber-500 hover:bg-amber-400 text-white"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">
                    {isPaused ? "play_arrow" : "pause"}
                  </span>
                  {isPaused ? "Resume" : "Pause"}
                </button>
                <button
                  onClick={ztteam_handleStop}
                  className="flex items-center gap-2 px-5 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-bold rounded-xl transition-all text-sm"
                >
                  <span className="material-symbols-outlined text-sm">
                    stop
                  </span>
                  Stop
                </button>
              </>
            )}
          </div>
        </div>

        {/** Cột phải - Runtime Info */}
        <div className="flex flex-col gap-4">
          {/** Stats */}
          {urlItems.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Tổng", value: stats.total, color: "text-white" },
                { label: "Done", value: stats.done, color: "text-emerald-400" },
                { label: "Lỗi", value: stats.error, color: "text-red-400" },
                {
                  label: "Trùng",
                  value: stats.duplicate,
                  color: "text-amber-400",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-slate-900 rounded-xl border border-slate-800 p-4 text-center"
                >
                  <p className={`text-2xl font-black ${stat.color}`}>
                    {stat.value}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          {/** Runtime list */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-800/30 flex items-center justify-between">
              <h3 className="font-bold">Runtime Info</h3>
              {isRunning && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-emerald-400 font-medium">
                    {isPaused ? "Paused" : "Running..."}
                  </span>
                </div>
              )}
            </div>

            {urlItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <span className="material-symbols-outlined text-slate-600 text-5xl">
                  terminal
                </span>
                <p className="text-slate-400 text-sm">Chưa có gì để hiển thị</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800 max-h-[500px] overflow-y-auto">
                {urlItems.map((item, index) => (
                  <div
                    key={index}
                    className="px-5 py-3 flex items-center gap-3"
                  >
                    <span className="text-xs text-slate-600 font-mono w-5 shrink-0">
                      {index + 1}
                    </span>
                    <p className="text-xs text-slate-400 truncate flex-1 font-mono">
                      {item.url}
                    </p>
                    <div className="shrink-0">
                      <ZTTeamUrlStatusBadge item={item} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/** Modal Thêm mới WordPress Site */}
      {showWpModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white text-base">Thêm Website WordPress</h3>
              <button
                onClick={() => setShowWpModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={ztteam_handleAddWpSite} className="p-6 flex flex-col gap-4">
              {wpError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
                  {wpError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Tên gợi nhớ Website
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Trang Tin Tức Bất Động Sản"
                  value={newWpName}
                  onChange={(e) => setNewWpName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-[#1337ec]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Đường dẫn Website (Site URL)
                </label>
                <input
                  type="url"
                  placeholder="https://sitetintuc.com"
                  value={newWpUrl}
                  onChange={(e) => setNewWpUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-[#1337ec]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Tên tài khoản WordPress (Username)
                </label>
                <input
                  type="text"
                  placeholder="admin"
                  value={newWpUser}
                  onChange={(e) => setNewWpUser(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-[#1337ec]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Mật khẩu ứng dụng (Application Password)
                </label>
                <input
                  type="password"
                  placeholder="abcd 1234 efgh 5678"
                  value={newWpPass}
                  onChange={(e) => setNewWpPass(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-[#1337ec]"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Tạo Application Password trong WordPress Admin: Users &gt; Profile &gt; Application Passwords.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowWpModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingWp}
                  className="px-5 py-2 bg-[#1337ec] hover:bg-[#1337ec]/90 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-2"
                >
                  {isSavingWp && <span className="material-symbols-outlined text-xs animate-spin">sync</span>}
                  Lưu Website
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
