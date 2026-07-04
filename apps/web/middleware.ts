import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];
const ADMIN_PATHS = ["/admin", "/pta", "/planejamentopta"];

function getJwtRole(token: string): string {
  try {
    const base64 = token.split(".")[1];
    const payload = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
    return typeof payload?.role === "string" ? payload.role : "user";
  } catch {
    return "user";
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("anac_token")?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (getJwtRole(token) !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|otf|eot)).*)"],
};
