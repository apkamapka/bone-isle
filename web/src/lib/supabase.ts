import { createClient } from "@supabase/supabase-js";
import { AUTH_STORAGE_KEY, SUPABASE_KEY, SUPABASE_URL } from "../site.ts";

/**
 * The site's one Supabase client. The top bar loads it lazily (account-bar.ts),
 * so a visitor who has never logged in downloads none of it.
 *
 * Links in our emails carry a token hash that /confirm/ trades for a session
 * on a click, so nothing here reads sessions out of the address bar.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storageKey: AUTH_STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
