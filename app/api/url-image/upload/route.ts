import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const uploadDir = path.join(process.cwd(), "public", "images", "collages", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const savedUrls: string[] = [];
    const contentType = request.headers.get("content-type") || "";

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
        const filename = `up_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${cleanExt}`;
        const filepath = path.join(uploadDir, filename);

        await writeFile(filepath, buffer);
        savedUrls.push(`/images/collages/uploads/${filename}`);
      }
    } else {
      return NextResponse.json(
        { success: false, error: "Content-Type phải là multipart/form-data" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      urls: savedUrls,
    });
  } catch (error) {
    console.error("url-image upload error:", error);
    const message = error instanceof Error ? error.message : "Lỗi khi tải ảnh lên";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
