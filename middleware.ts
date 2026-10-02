import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Cho phép truy cập tài nguyên tĩnh và media công khai
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/videos") ||
    pathname.startsWith("/audio") ||
    pathname.startsWith("/music") ||
    pathname.startsWith("/effects") ||
    pathname === "/favicon.ico" ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".mp4")
  ) {
    return NextResponse.next();
  }

  // 2. Kiểm tra token session
  const sessionToken = request.cookies.get("ztteam_session")?.value;
  let isAuthenticated = false;

  if (sessionToken) {
    try {
      const decoded = atob(sessionToken);
      const parts = decoded.split(":");
      const expiry = parseInt(parts[1], 10);
      if (parts[0] && expiry && expiry > Date.now() && parts[2]) {
        isAuthenticated = true;
      }
    } catch {
      isAuthenticated = false;
    }
  }

  // 3. Nếu người dùng vào trang /login hoặc các API xác thực
  if (pathname === "/login" || pathname.startsWith("/api/auth/")) {
    // Nếu đã đăng nhập mà vẫn cố vào /login -> đưa thẳng vào /dashboard
    if (isAuthenticated && pathname === "/login") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // 4. Nếu chưa đăng nhập:
  if (!isAuthenticated) {
    // Nếu là gọi API -> trả về lỗi 401 Unauthorized
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { success: false, error: "Yêu cầu đăng nhập để truy cập tài nguyên này" },
        { status: 401 }
      );
    }
    // Nếu là vào trang giao diện web -> chuyển hướng tới trang /login
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
