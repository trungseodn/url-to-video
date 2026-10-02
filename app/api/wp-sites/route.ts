import { NextRequest, NextResponse } from "next/server";
import {
  ztteam_getAllWpSites,
  ztteam_insertWpSite,
  ztteam_deleteWpSite,
} from "@/lib/database";

/** GET /api/wp-sites - Lấy danh sách trang WP */
export async function GET(): Promise<NextResponse> {
  try {
    let sites = ztteam_getAllWpSites();

    /** Nếu chưa có site nào trong DB nhưng có cấu hình .env.local, tự động seed site mặc định */
    if (sites.length === 0) {
      const siteUrl = process.env.WP_SITE_URL;
      const username = process.env.WP_USERNAME;
      const appPassword = process.env.WP_APP_PASSWORD;

      if (siteUrl && username && appPassword) {
        const cleanUrl = siteUrl.replace(/\/+$/, "");
        const defaultSite = ztteam_insertWpSite({
          name: "Website Mặc Định (từ .env)",
          site_url: cleanUrl,
          username,
          app_password: appPassword,
        });
        sites = [defaultSite];
      }
    }

    return NextResponse.json({ success: true, sites });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Có lỗi xảy ra";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

/** POST /api/wp-sites - Thêm trang WP mới */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { name, site_url, username, app_password } = body;

    if (!name || !site_url || !username || !app_password) {
      return NextResponse.json(
        {
          success: false,
          error: "Vui lòng nhập đầy đủ: Tên web, URL, Username và App Password",
        },
        { status: 400 },
      );
    }

    const cleanUrl = site_url.trim().replace(/\/+$/, "");
    const newSite = ztteam_insertWpSite({
      name: name.trim(),
      site_url: cleanUrl,
      username: username.trim(),
      app_password: app_password.trim(),
    });

    return NextResponse.json({ success: true, site: newSite });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Có lỗi xảy ra";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

/** DELETE /api/wp-sites - Xóa trang WP theo ID */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get("id");

    if (!idParam) {
      return NextResponse.json(
        { success: false, error: "Thiếu ID trang WordPress" },
        { status: 400 },
      );
    }

    const id = parseInt(idParam, 10);
    const deleted = ztteam_deleteWpSite(id);

    return NextResponse.json({ success: deleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Có lỗi xảy ra";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
