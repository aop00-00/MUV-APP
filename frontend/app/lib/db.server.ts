// app/lib/db.server.ts
// Supabase client – runs ONLY on the server (service role key).
// Uses lazy initialization to avoid crashing Vercel serverless functions.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL?.trim() || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn(
        "[db.server] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "Database calls will fail at runtime. Static routes will still work."
    );
}

let _client: SupabaseClient | null = null;

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        if (!_client) {
            if (!supabaseUrl || !supabaseServiceKey) {
                throw new Error(
                    "Cannot use db client: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars."
                );
            }
            _client = createClient(supabaseUrl, supabaseServiceKey, {
                auth: { autoRefreshToken: false, persistSession: false },
            });
        }
        return (_client as any)[prop];
    },
});