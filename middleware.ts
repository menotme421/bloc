import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabase/config";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthed = !!user;
  const isProtected =
    pathname.startsWith("/app") || pathname.startsWith("/notes");
  const isAuthRoute = pathname.startsWith("/auth");
  const isCallback = pathname.startsWith("/auth/callback");
  const isLanding = pathname === "/";

  if (isProtected && !isAuthed) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  if (isAuthRoute && !isCallback && isAuthed) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  if (isLanding && isAuthed) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/app/:path*", "/notes/:path*", "/auth/:path*", "/"],
};
