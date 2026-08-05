import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const supabase = await createSupabaseServerClient();

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      const isRecovery =
        type === "recovery" ||
        (data as { redirectType?: string | null }).redirectType ===
          "recovery";
      return NextResponse.redirect(
        isRecovery ? `${origin}/reset-password` : `${origin}/app`
      );
    }
    console.error("[auth/callback] code exchange failed", error);
    return NextResponse.redirect(`${origin}/auth?error=auth_code_exchange`);
  }

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "email" | "sms" | "email_change" | "recovery",
    });
    if (!error && data.user) {
      return NextResponse.redirect(
        type === "recovery"
          ? `${origin}/reset-password`
          : `${origin}/app`
      );
    }
    console.error("[auth/callback] otp verification failed", { type, error });
    const expired =
      error?.code === "otp_expired" ||
      error?.message?.toLowerCase().includes("expired");
    return NextResponse.redirect(
      `${origin}/auth?error=${expired ? "token_expired" : "otp_invalid"}`
    );
  }

  return NextResponse.redirect(`${origin}/auth?error=missing_params`);
}
