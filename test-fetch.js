const imageUrl =
  "https://blog.igallery.blog/assets/2d75fbbe98a8c2e004b15d5c777a1ce2/2026/0725/8ff2d3d5-80e6-46e5-b119-3a940ba85f99-Untitled-design---2026-05-17T153200-530.webp";

async function test() {
  console.log("=== KIỂM TRA TẢI ÁNH BLOG.IGALLERY.BLOG ===");
  console.log("URL:", imageUrl);

  console.log("\n[TEST 1] Fetch tiêu chuẩn kèm Referer & User-Agent:");
  try {
    const res = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Referer: "https://blog.igallery.blog/",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });
    console.log("-> HTTP Status:", res.status, res.statusText);
    console.log("-> Content-Type:", res.headers.get("content-type"));
    const buf = await res.arrayBuffer();
    console.log("-> Dung lượng tải về:", buf.byteLength, "bytes");
  } catch (err) {
    console.error("-> Lỗi Test 1:", err instanceof Error ? err.message : err);
  }

  console.log("\n[TEST 2] Bỏ qua kiểm tra chứng chỉ SSL (NODE_TLS_REJECT_UNAUTHORIZED=0):");
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  try {
    const res = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Referer: "https://blog.igallery.blog/",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });
    console.log("-> HTTP Status:", res.status, res.statusText);
    console.log("-> Content-Type:", res.headers.get("content-type"));
    const buf = await res.arrayBuffer();
    console.log("-> Dung lượng tải về:", buf.byteLength, "bytes");
  } catch (err) {
    console.error("-> Lỗi Test 2:", err instanceof Error ? err.message : err);
  }
}

test();
