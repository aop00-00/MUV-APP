// Temporary debug endpoint — DELETE after fixing the issue
// Visit: /api/debug-db

export async function loader() {
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const results: Record<string, any> = {};

    // 1. Check profiles table structure
    try {
        const { data, error } = await supabaseAdmin.rpc("exec_sql", {
            query: `SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'profiles'
                    ORDER BY ordinal_position`
        });
        // rpc might not exist, fallback to a simpler check
        if (error) {
            // Try getting a sample row instead
            const { data: sample, error: sampleErr } = await supabaseAdmin
                .from("profiles")
                .select("*")
                .limit(1);
            results["1_profiles_schema"] = sampleErr
                ? { error: sampleErr.message }
                : { columns: sample?.[0] ? Object.keys(sample[0]) : "NO ROWS FOUND" };
        } else {
            results["1_profiles_schema"] = data;
        }
    } catch (e: any) {
        results["1_profiles_schema"] = { error: e.message };
    }

    // 2. Try creating a test user to capture the EXACT error
    const testEmail = `debug.test.${Date.now()}@gmail.com`;
    try {
        // Use signUp instead of admin.createUser (trigger is disabled)
        const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
            email: testEmail,
            password: "TestPassword123!",
            options: { data: { full_name: "Debug Test", role: "admin" } }
        });

        if (authError) {
            results["2_create_user_test"] = {
                status: "FAILED",
                error_message: authError.message,
                error_status: authError.status,
                error_name: authError.name,
                full_error: JSON.stringify(authError),
            };
        } else if (!authData.user) {
            results["2_create_user_test"] = { status: "FAILED", error_message: "No user returned" };
        } else {
            results["2_create_user_test"] = {
                status: "SUCCESS",
                user_id: authData.user.id,
                email: authData.user.email,
            };

            // Test manual profile creation (same as onboarding does now)
            const { error: profileInsertErr } = await supabaseAdmin
                .from("profiles")
                .upsert({
                    id: authData.user.id,
                    email: testEmail,
                    full_name: "Debug Test",
                    role: "admin",
                    credits: 0,
                    gym_id: null,
                }, { onConflict: "id" });

            results["3_manual_profile_creation"] = profileInsertErr
                ? { status: "FAILED", error: profileInsertErr.message }
                : { status: "PROFILE CREATED MANUALLY" };

            // Cleanup: delete profile then user
            await supabaseAdmin.from("profiles").delete().eq("id", authData.user.id);
            const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            results["4_cleanup"] = deleteErr
                ? { status: "CLEANUP FAILED", error: deleteErr.message }
                : { status: "TEST USER DELETED" };
        }
    } catch (e: any) {
        results["2_create_user_test"] = { status: "EXCEPTION", error: e.message, stack: e.stack };
    }

    // 5. Check existing auth users count
    try {
        const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 5 });
        results["5_existing_users"] = error
            ? { error: error.message }
            : {
                total: users?.users?.length ?? 0,
                sample: users?.users?.slice(0, 3).map(u => ({
                    id: u.id,
                    email: u.email,
                    created_at: u.created_at,
                }))
            };
    } catch (e: any) {
        results["5_existing_users"] = { error: e.message };
    }

    // 6. Check profiles count and sample
    try {
        const { data: profiles, error, count } = await supabaseAdmin
            .from("profiles")
            .select("id, email, role, gym_id, full_name", { count: "exact" })
            .limit(5);
        results["6_existing_profiles"] = error
            ? { error: error.message }
            : { total: count, sample: profiles };
    } catch (e: any) {
        results["6_existing_profiles"] = { error: e.message };
    }

    // 7. Check gyms
    try {
        const { data: gyms, error } = await supabaseAdmin
            .from("gyms")
            .select("id, name, slug, owner_id, plan_status")
            .limit(5);
        results["7_existing_gyms"] = error
            ? { error: error.message }
            : gyms;
    } catch (e: any) {
        results["7_existing_gyms"] = { error: e.message };
    }

    return new Response(JSON.stringify(results, null, 2), {
        headers: { "Content-Type": "application/json" },
    });
}
