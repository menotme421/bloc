import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

const getSessionUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
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
