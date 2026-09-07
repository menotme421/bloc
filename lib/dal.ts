import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SUPABASE_URL } from "@/lib/supabase/config";

function titleCase(value: string) {
  return value
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function getDisplayName(user: User) {
  return (
    (user.user_metadata?.full_name as string | undefined) ??
    titleCase(user.email?.split("@")[0] ?? "User")
  );
}

function parseJwtPayload(token: string): { sub?: string } | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function getCookiePrefix(): string {
  try {
    const url = new URL(SUPABASE_URL);
    const projectRef = url.hostname.split(".")[0];
    return `sb-${projectRef}-auth-token`;
  } catch {
    return "sb-auth-token";
  }
}

async function getUserIdFromCookies(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const all = cookieStore.getAll();
    const prefix = getCookiePrefix();

    const chunks: { index: number; value: string }[] = [];
    for (const c of all) {
      if (!c.name.startsWith(prefix)) continue;
      const suffix = c.name.slice(prefix.length);
      if (suffix === "") {
        chunks.push({ index: 0, value: c.value });
      } else if (/^\.\d+$/.test(suffix)) {
        chunks.push({ index: parseInt(suffix.slice(1), 10), value: c.value });
      }
    }

    if (chunks.length === 0) return null;

    chunks.sort((a, b) => a.index - b.index);
    const combined = chunks.map((c) => c.value).join("");

    const parsed = JSON.parse(combined) as { access_token?: string };
    if (!parsed.access_token) return null;

    const payload = parseJwtPayload(parsed.access_token);
    return payload?.sub ?? null;
  } catch {
    return null;
  }
}

const getSessionUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return user;

  const userId = await getUserIdFromCookies();
  if (userId) {
    return { id: userId, email: null, user_metadata: {}, app_metadata: {}, aud: "", created_at: "" } as unknown as User;
  }

  return null;
});

export const verifySession = cache(async () => {
  const user = await getSessionUser();

  if (!user) {
    redirect("/auth");
  }

  return { isAuth: true, userId: user.id };
});

export const getUser = cache(async () => {
  const user = await getSessionUser();

  if (!user) {
    redirect("/auth");
  }

  return user;
});

export const tryVerifySession = cache(async (): Promise<{ isAuth: true; userId: string } | null> => {
  try {
    const user = await getSessionUser();
    if (!user) return null;
    return { isAuth: true, userId: user.id };
  } catch {
    return null;
  }
});

export const tryGetUser = cache(async (): Promise<User | null> => {
  try {
    return await getSessionUser();
  } catch {
    return null;
  }
});
