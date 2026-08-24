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

  // Handle PKCE code at any route (e.g. https://blocapps.com/?code=... or http://192.168.1.8:3000/?code=...)
  // Supabase may redirect to Site URL (live) even when signing in on LAN IP if
  // that IP isn't in Supabase → Auth → URL Configuration → Redirect URLs.
  // Exchanging here prevents landing on /?code=... stuck without session.
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Strip ?code and go to /app preserving original host (LAN IP or live)
      const url = request.nextUrl.clone();
      url.searchParams.delete("code");
      url.pathname = "/app";
      return NextResponse.redirect(url);
    }
    // If exchange fails, fall through to callback route handling
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthed = !!user;
  const isProtected = pathname.startsWith("/app");
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
  matcher: ["/app/:path*", "/auth/:path*", "/"],
};
