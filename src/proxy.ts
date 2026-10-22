import { NextResponse, type NextRequest } from "next/server";

// 本人認証（Supabase Auth）を入れるまでの暫定ガード。
// BASIC_AUTH_USER / BASIC_AUTH_PASSWORD が設定されていればサイト全体とAPIに
// Basic認証をかけ、第三者がページやAI生成APIを使えないようにする。
export function proxy(request: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;
  if (!user || !password) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("BASIC_AUTH_USER / BASIC_AUTH_PASSWORD が未設定です", { status: 503 });
    }
    return NextResponse.next();
  }

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const [u, ...rest] = atob(header.slice(6)).split(":");
    if (u === user && rest.join(":") === password) return NextResponse.next();
  }

  return new NextResponse("認証が必要です", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="jinsei-album", charset="UTF-8"' },
  });
}

export const config = {
  // manifest とアイコンはホーム画面追加時に認証なしで取得されることがあるため除外
  matcher: ["/((?!_next/static|_next/image|manifest.webmanifest|icon|apple-icon|favicon.ico).*)"],
};
