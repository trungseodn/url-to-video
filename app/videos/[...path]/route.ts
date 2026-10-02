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
    const fullPath = path.join(process.cwd(), "public", "videos", safePath);

    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      return new NextResponse("Video not found", { status: 404 });
    }

    const stat = fs.statSync(fullPath);
    const fileSize = stat.size;
    const range = request.headers.get("range");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(fullPath, { start, end });

      return new NextResponse(file as any, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize.toString(),
          "Content-Type": "video/mp4",
        },
      });
    } else {
      const fileBuffer = fs.readFileSync(fullPath);
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Length": fileSize.toString(),
          "Content-Type": "video/mp4",
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  } catch (err: any) {
    return new NextResponse("Error reading video: " + err.message, { status: 500 });
  }
}
