import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabase/config";

export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

