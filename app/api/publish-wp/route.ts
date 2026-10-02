import { NextRequest, NextResponse } from "next/server";
import { ztteam_getWpSiteById } from "@/lib/database";

/** POST /api/publish-wp */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { title, content, featuredImageUrl, siteId, customSiteUrl, customUsername, customAppPassword } = body;

    if (!title || !content) {
      return NextResponse.json(
        { success: false, error: "Thiếu title hoặc content" },
        { status: 400 },
      );
    }

    let siteUrl: string | undefined = customSiteUrl || process.env.WP_SITE_URL;
    let username: string | undefined = customUsername || process.env.WP_USERNAME;
    let appPassword: string | undefined = customAppPassword || process.env.WP_APP_PASSWORD;

    /** Nếu có siteId, lấy cấu hình từ DB ztteam_wp_sites */
    if (siteId) {
      const wpSite = ztteam_getWpSiteById(Number(siteId));
      if (wpSite) {
        siteUrl = wpSite.site_url;
        username = wpSite.username;
        appPassword = wpSite.app_password;
      }
    }

    if (!siteUrl || !username || !appPassword) {
      return NextResponse.json(
        { success: false, error: "Thiếu cấu hình kết nối WordPress" },
        { status: 500 },
      );
    }

    /** Chuẩn hóa siteUrl loại bỏ dấu slash cuối */
    siteUrl = siteUrl.trim().replace(/\/+$/, "");

    const credentials = Buffer.from(`${username}:${appPassword}`).toString(
      "base64",
    );

    /** Kiểm tra xem bài viết đã tồn tại trên WordPress chưa */
    const existingPost = await ztteam_findExistingPost(title, siteUrl, credentials);

    const headers = {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    };

    /** 1. Upload ảnh đại diện (featured image) nếu có */
    let featuredMediaId: number | null = null;
    let featuredMediaUrl: string | null = null;

    if (featuredImageUrl) {
      const uploadResult = await ztteam_uploadFeaturedImage(
        featuredImageUrl,
        siteUrl,
        credentials,
      );
      featuredMediaId = uploadResult?.id || null;
      featuredMediaUrl = uploadResult?.url || null;
    }

    /** 2. Tự động upload TẤT CẢ các ảnh nằm trong thân bài viết lên WordPress Media Library */
    let finalContent = await ztteam_processAndUploadAllContentImages(
      content,
      siteUrl,
      credentials,
    );

    /** Đổi URL ảnh đại diện nếu nó xuất hiện trong nội dung */
    const cleanFeaturedUrl = featuredImageUrl
      ? featuredImageUrl.split("?")[0]
      : null;

    if (featuredMediaUrl && cleanFeaturedUrl) {
      finalContent = finalContent.replace(
        new RegExp(
          cleanFeaturedUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "g",
        ),
        featuredMediaUrl,
      );
    }

    /** Tạo hoặc Cập nhật bài viết */
    const postData: Record<string, unknown> = {
      title,
      content: finalContent,
      status: "publish",
    };

    if (featuredMediaId) {
      postData.featured_media = featuredMediaId;
    }

    /** Nếu bài viết đã tồn tại -> Gửi POST tới endpoint ID bài viết đó để CẬP NHẬT nội dung */
    let targetEndpoint = `${siteUrl}/wp-json/wp/v2/posts`;
    let isUpdate = false;

    if (existingPost) {
      targetEndpoint = `${siteUrl}/wp-json/wp/v2/posts/${existingPost.id}`;
      isUpdate = true;
    }

    const postResponse = await fetch(targetEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(postData),
    });

    if (!postResponse.ok) {
      const error = await postResponse.json();
      throw new Error(
        error.message || (isUpdate ? "Không thể cập nhật bài viết trên WordPress" : "Không thể tạo bài viết trên WordPress")
      );
    }

    const post = await postResponse.json();

    return NextResponse.json({
      success: true,
      isUpdate,
      message: isUpdate ? "Cập nhật bài viết thành công trên WordPress!" : "Tạo bài viết mới thành công trên WordPress!",
      data: {
        id: post.id,
        link: post.link,
        editLink: `${siteUrl}/wp-admin/post.php?post=${post.id}&action=edit`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Có lỗi xảy ra";
    const stack = error instanceof Error ? error.stack : "";
    console.error("Publish WP error:", message, stack);
    return NextResponse.json(
      { success: false, error: message, stack },
      { status: 500 },
    );
  }
}

/** Tự động quét và Upload toàn bộ các ảnh nằm trong thân bài viết lên WordPress Media Library */
async function ztteam_processAndUploadAllContentImages(
  content: string,
  siteUrl: string,
  credentials: string,
): Promise<string> {
  if (!content) return content;

  /** Tìm tất cả đường dẫn trong thuộc tính src của các thẻ <img ... src="..."> */
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/g;
  const imageUrls = new Set<string>();
  let match;

  while ((match = imgRegex.exec(content)) !== null) {
    if (match[1]) imageUrls.add(match[1]);
  }

  let updatedContent = content;

  for (const imgUrl of Array.from(imageUrls)) {
    try {
      const uploadResult = await ztteam_uploadFeaturedImage(
        imgUrl,
        siteUrl,
        credentials,
      );
      if (uploadResult?.url) {
        const cleanUrl = imgUrl.split("?")[0];
        updatedContent = updatedContent.replace(
          new RegExp(cleanUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
          uploadResult.url,
        );
      }
    } catch (err) {
      console.error(`Không thể upload ảnh thân bài viết (${imgUrl}):`, err);
    }
  }

  return updatedContent;
}

/** Upload ảnh lên WordPress Media Library */
async function ztteam_uploadFeaturedImage(
  imageUrl: string,
  siteUrl: string,
  credentials: string,
): Promise<{ id: number; url: string } | null> {
  try {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    let imageBuffer: ArrayBuffer;
    let contentType: string;
    let filename: string;

    if (imageUrl.startsWith("/")) {
      /** Ảnh local từ Next.js public folder */
      const fs = await import("fs");
      const path = await import("path");
      const cleanImageUrl = imageUrl.split("?")[0];
      const localPath = path.join(process.cwd(), "public", cleanImageUrl);
      const fileBuffer = fs.readFileSync(localPath);
      imageBuffer = fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength,
      );
      filename = cleanImageUrl.split("/").pop() || "featured-image.jpg";
      const ext = filename.split(".").pop()?.toLowerCase();
      if (ext === "webp") contentType = "image/webp";
      else if (ext === "png") contentType = "image/png";
      else if (ext === "gif") contentType = "image/gif";
      else contentType = "image/jpeg";
    } else {
      /** Ảnh từ URL bên ngoài */
      const imgOrigin = new URL(imageUrl).origin + "/";
      const imageResponse = await fetch(imageUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Referer: imgOrigin,
          Accept:
            "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
      });
      if (!imageResponse.ok) return null;
      imageBuffer = await imageResponse.arrayBuffer();
      contentType = imageResponse.headers.get("Content-Type") || "image/jpeg";
      filename =
        imageUrl.split("/").pop()?.split("?")[0] || "featured-image.jpg";
    }

    /** Upload lên WP Media */
    const uploadResponse = await fetch(`${siteUrl}/wp-json/wp/v2/media`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
      body: imageBuffer,
    });

    if (!uploadResponse.ok) return null;

    const media = await uploadResponse.json();
    return {
      id: media.id,
      url: media.source_url,
    };
  } catch {
    return null;
  }
}

/** Tìm bài viết đã tồn tại trên WordPress theo tiêu đề */
async function ztteam_findExistingPost(
  title: string,
  siteUrl: string,
  credentials: string,
): Promise<{ id: number; link: string } | null> {
  try {
    const response = await fetch(
      `${siteUrl}/wp-json/wp/v2/posts?per_page=100&orderby=date&order=desc`,
      {
        headers: { Authorization: `Basic ${credentials}` },
      },
    );

    if (!response.ok) return null;

    const posts = await response.json();
    const normalizedTitle = title
      .trim()
      .toLowerCase()
      .replace(/[-–—]+$/, "")
      .trim();

    for (const post of posts) {
      const wpTitle = (post.title?.rendered || "")
        .replace(/&#8211;/g, "–")
        .replace(/&#8212;/g, "—")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/[-–—]+$/, "")
        .trim()
        .toLowerCase();

      if (wpTitle === normalizedTitle) {
        return { id: post.id, link: post.link };
      }
    }

    return null;
  } catch {
    return null;
  }
}
