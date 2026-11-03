import { NextResponse, type NextRequest } from "next/server";
import { isAuthed } from "@/lib/auth";

// Password gate for the whole app. No APP_PASSWORD set = open (local dev).
export async function proxy(req: NextRequest) {
  if (await isAuthed(req.cookies.get("pr_auth")?.value)) return;
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = { matcher: ["/((?!login|_next|favicon.ico).*)"] };
