import * as cheerio from "cheerio";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

import {
  ztteam_validateUrl,
  ztteam_sanitizeUrl,
  ztteam_extractDomain,
} from "./validator";
import type { ZTTeamFetchResult } from "@/types";

async function ztteam_fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`);
  }

  return response.text();
}

/** Trích xuất ảnh chính (OG image, Thumbnail hoặc ảnh đầu tiên trong bài viết) */
function ztteam_extractOgImage($: cheerio.Root): string | null {
  /** 1. Tìm các thẻ Meta chính */
  const metaImg =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    $('meta[property="og:image:url"]').attr("content") ||
    $('meta[name="thumbnail"]').attr("content") ||
    $('link[rel="image_src"]').attr("href");

  if (metaImg && metaImg.trim().length > 0) {
    return metaImg.trim();
  }

  /** 2. Fallback: Tìm thẻ img/picture đầu tiên trong bài viết */
  let bodyImg: string | null = null;

  /** Quét thêm thẻ source trong picture */
  $("picture source").each((_, elem) => {
    if (bodyImg) return;
    const srcset = $(elem).attr("srcset") || $(elem).attr("data-srcset");
    if (srcset) {
      const firstCandidate = srcset.split(",")[0].trim().split(" ")[0];
      if (firstCandidate && !firstCandidate.startsWith("data:")) {
        bodyImg = firstCandidate;
      }
    }
  });

  if (bodyImg) return bodyImg;

  /** Quét các thẻ img trong nội dung chính */
  $("article img, main img, .content img, .post img, .entry-content img, img").each((_, elem) => {
    if (bodyImg) return;
    const src =
      $(elem).attr("src") ||
      $(elem).attr("data-src") ||
      $(elem).attr("data-original") ||
      $(elem).attr("lazy-src");

    if (
      src &&
      !src.startsWith("data:") &&
      !src.includes("icon") &&
      !src.includes("logo") &&
      !src.includes("avatar")
    ) {
      bodyImg = src.trim();
    }
  });

  return bodyImg;
}

/** Extract site name từ HTML */
function ztteam_extractSiteName($: cheerio.Root): string | null {
  return $('meta[property="og:site_name"]').attr("content") || null;
}

/** Helper lưu buffer ảnh thành tệp */
async function ztteam_saveImageBuffer(response: Response, fullUrl: string): Promise<string> {
  const contentType = response.headers.get("content-type") || "";
  let ext = "jpg";
  if (contentType.includes("webp") || fullUrl.toLowerCase().includes(".webp")) ext = "webp";
  else if (contentType.includes("png") || fullUrl.toLowerCase().includes(".png")) ext = "png";
  else if (contentType.includes("gif") || fullUrl.toLowerCase().includes(".gif")) ext = "gif";
  else if (contentType.includes("jpeg") || contentType.includes("jpg") || fullUrl.toLowerCase().includes(".jpg")) ext = "jpg";

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const imageDir = path.join(process.cwd(), "public", "images");
  await mkdir(imageDir, { recursive: true });

  const filename = `image-${Date.now()}-${Math.floor(Math.random() * 10000)}.${ext}`;
  const filepath = path.join(imageDir, filename);
  await writeFile(filepath, buffer);

  return `/images/${filename}`;
}

/** Tải ảnh về lưu trữ trực tiếp trên máy mình (public/images), hỗ trợ WebP & CDN có Referer/User-Agent */
async function ztteam_downloadAndSaveImage(
  rawImageUrl: string | null,
  baseUrl: string,
): Promise<string | null> {
  if (!rawImageUrl) return null;

  /** Cho phép tải ảnh từ các trang có chứng chỉ SSL thiếu/tự ký */
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  try {
    /** Xử lý chuỗi srcset nếu có dạng "http://url.com/a.webp 1000w, ..." */
    let cleanUrlStr = rawImageUrl.trim();
    if (cleanUrlStr.includes(" ")) {
      cleanUrlStr = cleanUrlStr.split(",")[0].trim().split(" ")[0];
    }

    const fullUrl = new URL(cleanUrlStr, baseUrl).href;
    const imgOrigin = new URL(fullUrl).origin + "/";
    const pageOrigin = new URL(baseUrl).origin + "/";

    /** Lần 1: Fetch với Referer của chính Server ảnh (Vượt CDN anti-hotlink Same-Origin) */
    let response = await fetch(fullUrl, {
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept:
          "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        Referer: imgOrigin,
        "Sec-Fetch-Dest": "image",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "same-origin",
      },
    });

    if (response.ok) {
      return await ztteam_saveImageBuffer(response, fullUrl);
    }

    /** Lần 2: Fetch với Referer của trang web nguồn */
    response = await fetch(fullUrl, {
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept:
          "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        Referer: pageOrigin,
      },
    });

    if (response.ok) {
      return await ztteam_saveImageBuffer(response, fullUrl);
    }

    /** Lần 3 (Fallback): Fetch không có Referer */
    const fallbackRes = await fetch(fullUrl, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "*/*",
      },
    });

    if (fallbackRes.ok) {
      return await ztteam_saveImageBuffer(fallbackRes, fullUrl);
    }

    return fullUrl;
  } catch (err) {
    console.error("Lỗi khi tải ảnh về máy cục bộ:", err);
    try {
      return new URL(rawImageUrl, baseUrl).href;
    } catch {
      return rawImageUrl;
    }
  }
}

/** Làm sạch HTML: Loại bỏ class, style inline, id, data-*, THẺ DIV VÀ TẢI TẤT CẢ ÁNH TRONG BÀI VIẾT VỀ MÁY CỤC BỘ */
export async function ztteam_cleanHtml(
  rawHtml: string,
  baseUrl: string,
): Promise<string> {
  if (!rawHtml) return "";

  const $ = cheerio.load(rawHtml);

  /** Loại bỏ script, style, iframe, form, button không cần thiết */
  $("script, style, iframe, form, button, input, noscript, svg").remove();

  /** Bỏ hoàn toàn tất cả thẻ div bằng cách unwrap nội dung bên trong */
  while ($("div").length > 0) {
    $("div").each((_, el) => {
      $(el).replaceWith($(el).contents());
    });
  }

  interface ImgTarget {
    elem: cheerio.Element;
    src: string;
    alt?: string;
  }
  const imgElements: ImgTarget[] = [];

  $("*").each((_, elem) => {
    if (elem.type !== "tag") return;

    const tagName = elem.tagName.toLowerCase();
    const attribs = { ...(elem.attribs || {}) };

    /** Xóa toàn bộ thuộc tính trang trí/style của thẻ trước */
    for (const attr of Object.keys(attribs)) {
      $(elem).removeAttr(attr);
    }

    /** Nếu là thẻ <a>: giữ lại href chuẩn hóa tuyệt đối */
    if (tagName === "a" && attribs["href"]) {
      try {
        const fullHref = new URL(attribs["href"], baseUrl).href;
        $(elem).attr("href", fullHref);
      } catch {
        $(elem).attr("href", attribs["href"]);
      }
    }

    /** Nếu là thẻ <img>: thu thập src & alt để tải về máy */
    if (tagName === "img") {
      const srcCandidate =
        attribs["src"] ||
        attribs["data-src"] ||
        attribs["data-original"] ||
        attribs["lazy-src"];

      if (srcCandidate && !srcCandidate.startsWith("data:")) {
        imgElements.push({
          elem,
          src: srcCandidate,
          alt: attribs["alt"]?.trim(),
        });
      }
    }
  });

  /** Tải song song tất cả các ảnh trong thân bài viết về public/images/ */
  await Promise.all(
    imgElements.map(async (item) => {
      const localPath = await ztteam_downloadAndSaveImage(item.src, baseUrl);
      if (localPath) {
        $(item.elem).attr("src", localPath);
      } else {
        try {
          $(item.elem).attr("src", new URL(item.src, baseUrl).href);
        } catch {
          $(item.elem).attr("src", item.src);
        }
      }

      if (item.alt) {
        $(item.elem).attr("alt", item.alt);
      }
    })
  );

  /** 1. Bóc tách (unwrap) tất cả các thẻ <a>: Giữ lại toàn bộ văn bản và hình ảnh bên trong, chỉ gỡ bỏ thẻ <a> (link out) */
  while ($("a").length > 0) {
    $("a").each((_, el) => {
      $(el).replaceWith($(el).contents());
    });
  }

  /** 2. Quét và xóa các thẻ chú thích dẫn nguồn hoặc xem thêm (chỉ áp dụng cho đoạn văn ngắn < 150 ký tự) */
  $("p, span, em, strong, small").each((_, elem) => {
    const text = $(elem).text().trim();
    const lowerText = text.toLowerCase();

    const explicitSourceKeywords = [
      "nguồn:",
      "source:",
      "credit:",
      "credits:",
      "xem thêm:",
      "bài gốc:",
      "tham khảo:",
    ];

    if (text.length < 150) {
      if (
        explicitSourceKeywords.some((kw) => lowerText.startsWith(kw)) ||
        lowerText.startsWith("theo báo ") ||
        lowerText.startsWith("theo trang ") ||
        lowerText.startsWith("ảnh:") ||
        lowerText.startsWith("photo:")
      ) {
        $(elem).remove();
      }
    }
  });

  /** 3. Xóa các thẻ rỗng còn sót lại */
  $("p, span, em, strong").each((_, elem) => {
    if ($(elem).children().length === 0 && $(elem).text().trim() === "") {
      $(elem).remove();
    }
  });

  return $.html();
}

/** Parse nội dung sạch bằng Mozilla Readability */
async function ztteam_parseReadability(
  html: string,
  url: string,
): Promise<{
  title: string;
  content: string;
  contentHtml: string;
  excerpt: string;
}> {
  const { document } = parseHTML(html);
  document.baseURI ?? url;
  const reader = new Readability(document as unknown as Document);
  const article = reader.parse();

  if (!article) {
    throw new Error("Không thể parse nội dung bài viết");
  }

  /** Làm sạch HTML loại bỏ class, style inline, data-* VÀ tải toàn bộ ảnh trong bài về máy mình */
  const cleanedContentHtml = await ztteam_cleanHtml(article.content || "", url);

  return {
    title: article.title || "",
    content:
      article.textContent
        ?.replace(/\t/g, " ")
        .replace(/[ ]{2,}/g, " ")
        .replace(/\. ([A-Z])/g, ".\n\n$1")
        .replace(/([.!?])\s+([A-Z])/g, "$1\n\n$2")
        .trim() || "",
    contentHtml: cleanedContentHtml,
    excerpt: article.excerpt || "",
  };
}

/** Main function: fetch và parse toàn bộ dữ liệu từ URL */
export async function ztteam_fetchUrlData(
  rawUrl: string,
): Promise<ZTTeamFetchResult> {
  const url = ztteam_sanitizeUrl(rawUrl);

  if (!ztteam_validateUrl(url)) {
    throw new Error("URL không hợp lệ");
  }

  const html = await ztteam_fetchHtml(url);
  const $ = cheerio.load(html);

  const rawImage = ztteam_extractOgImage($);
  const siteName = ztteam_extractSiteName($);
  const { title, content, contentHtml, excerpt } = await ztteam_parseReadability(
    html,
    url,
  );

  /** Tải ảnh đại diện gốc về máy mình (lưu tại public/images/) */
  const localImage = await ztteam_downloadAndSaveImage(rawImage, url);

  return {
    title,
    image: localImage,
    content,
    contentHtml,
    excerpt,
    siteName: siteName || ztteam_extractDomain(url),
    url,
  };
}
