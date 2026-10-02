import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const uploadDir = path.join(process.cwd(), "public", "images", "url-video");
    await mkdir(uploadDir, { recursive: true });

    const savedUrls: string[] = [];
    const contentType = request.headers.get("content-type") || "";

    // 1. Multipart Form Data (file uploads)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      let files = formData.getAll("files") as File[];
      if (files.length === 0) {
        const single = formData.get("file") as File | null;
        if (single) files = [single];
      }

      if (files.length === 0) {
        return NextResponse.json(
          { success: false, error: "Vui lòng chọn ít nhất 1 file ảnh để tải lên" },
          { status: 400 }
        );
      }

      for (const file of files) {
        if (!file || typeof file === "string") continue;
        const buffer = Buffer.from(await file.arrayBuffer());
        const originalName = file.name || "image.png";
        const ext = path.extname(originalName) || ".jpg";
        const cleanExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext.toLowerCase())
          ? ext.toLowerCase()
          : ".jpg";
        const filename = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${cleanExt}`;
        const filepath = path.join(uploadDir, filename);

        await writeFile(filepath, buffer);
        savedUrls.push(`/images/url-video/${filename}`);
      }
    } 
    // 2. JSON Body (Base64 data URLs OR Remote Image URLs)
    else if (contentType.includes("application/json")) {
      const body = await request.json();
      const images: string[] = Array.isArray(body.images)
        ? body.images
        : body.image
        ? [body.image]
        : Array.isArray(body.urls)
        ? body.urls
        : body.url
        ? [body.url]
        : [];

      if (images.length === 0) {
        return NextResponse.json(
          { success: false, error: "Không tìm thấy dữ liệu ảnh để lưu" },
          { status: 400 }
        );
      }

      for (const imgData of images) {
        if (!imgData || typeof imgData !== "string") continue;
        const trimmed = imgData.trim();

        // 2a. Remote URL (http/https)
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
          try {
            const resp = await fetch(trimmed, { signal: AbortSignal.timeout(8000) });
            if (resp.ok) {
              const buffer = Buffer.from(await resp.arrayBuffer());
              const cleanUrl = trimmed.split("?")[0];
              const extCandidate = path.extname(cleanUrl).toLowerCase();
              const ext = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extCandidate)
                ? extCandidate
                : ".jpg";
              const filename = `paste_url_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
              const filepath = path.join(uploadDir, filename);

              await writeFile(filepath, buffer);
              savedUrls.push(`/images/url-video/${filename}`);
            }
          } catch (err) {
            console.warn("Could not download pasted image URL:", trimmed, err);
          }
          continue;
        }

        // 2b. Base64 Data URI
        const match = trimmed.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        let ext = ".jpg";
        let base64Content = trimmed;

        if (match) {
          ext = `.${match[1] || "jpg"}`;
          base64Content = match[2];
        }

        try {
          const buffer = Buffer.from(base64Content, "base64");
          const filename = `paste_clip_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
          const filepath = path.join(uploadDir, filename);

          await writeFile(filepath, buffer);
          savedUrls.push(`/images/url-video/${filename}`);
        } catch (err) {
          console.warn("Could not save base64 pasted image:", err);
        }
      }
    } else {
      return NextResponse.json(
        { success: false, error: "Định dạng request không hỗ trợ" },
        { status: 400 }
      );
    }

    if (savedUrls.length === 0) {
      return NextResponse.json(
        { success: false, error: "Không thể lưu ảnh tải lên" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      urls: savedUrls,
    });
  } catch (error) {
    console.error("Image upload error:", error);
    const message = error instanceof Error ? error.message : "Lỗi khi upload ảnh";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
