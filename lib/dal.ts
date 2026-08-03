import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
