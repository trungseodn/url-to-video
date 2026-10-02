import { NextRequest, NextResponse } from "next/server";
import { getAdminCredentials, createSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Vui lòng nhập tên đăng nhập và mật khẩu" },
        { status: 400 }
      );
    }

    const admin = getAdminCredentials();

    if (username.trim() !== admin.username || password.trim() !== admin.password) {
      return NextResponse.json(
        { success: false, error: "Tên đăng nhập hoặc mật khẩu không chính xác" },
        { status: 401 }
      );
    }

    const sessionToken = createSessionToken(admin.username);

    const response = NextResponse.json({
      success: true,
      message: "Đăng nhập thành công",
      user: { username: admin.username },
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 ngày
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống khi đăng nhập: " + err.message },
      { status: 500 }
    );
  }
}
