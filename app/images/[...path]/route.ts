import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const filePathArray = resolvedParams.path || [];
    const safePath = filePathArray.join("/").replace(/\.\./g, "");
    const fullPath = path.join(process.cwd(), "public", "images", safePath);

    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      return new NextResponse("Image not found", { status: 404 });
    }

    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".webp": "image/webp",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
      ".avif": "image/avif",
    };

    const contentType = mimeTypes[ext] || "application/octet-stream";
    const fileBuffer = fs.readFileSync(fullPath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err: any) {
    return new NextResponse("Error reading image: " + err.message, { status: 500 });
  }
}
