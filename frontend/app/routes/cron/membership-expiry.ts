// app/routes/cron/membership-expiry.ts
// ─────────────────────────────────────────────────────────────────────────────
// Vercel Cron Job: Daily membership expiration check.
//
// Schedule: daily at 09:00 UTC (configured in vercel.json)
// Protected by CRON_SECRET env var — Vercel sets the Authorization header
// automatically on cron invocations.
//
// Sends warning emails to members whose active memberships expire in exactly
// 7 days, 3 days, or 1 day.
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from "~/services/supabase.server";
import { sendMembershipExpiringSoon } from "~/services/email.server";

export async function loader({ request }: { request: Request }) {
  // ── Auth: verify Vercel cron secret ───────────────────────────────────────
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const results = {
    checked: 0,
    reminded: 0,
    errors: 0,
  };

  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 7);
    const targetStr = targetDate.toISOString().split("T")[0];

    // Fetch active memberships expiring in the next 7 days
    const { data: memberships, error } = await supabaseAdmin
      .from("memberships")
      .select("*, profiles(full_name, email), gyms(name)")
      .eq("status", "active")
      .gte("end_date", todayStr)
      .lte("end_date", targetStr);

    if (error) {
      throw new Error(`Error fetching memberships: ${error.message}`);
    }

    results.checked = memberships?.length ?? 0;

    for (const m of memberships ?? []) {
      try {
        const profile = m.profiles as any;
        const gym = m.gyms as any;

        if (!profile?.email) continue;

        // Calculate exact days remaining
        const end = new Date(m.end_date + "T23:59:59"); // ensure local EOD
        const now = new Date();
        const diffTime = end.getTime() - now.getTime();
        const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

        // Send reminders at milestones: exactly 7 days, 3 days, or 1 day remaining
        if (daysRemaining === 7 || daysRemaining === 3 || daysRemaining === 1) {
          const formattedEndDate = new Date(m.end_date + "T00:00:00").toLocaleDateString("es-MX", {
            day: "numeric",
            month: "long",
            year: "numeric"
          });

          await sendMembershipExpiringSoon({
            to: profile.email,
            memberName: profile.full_name ?? "Cliente",
            studioName: gym?.name ?? "tu estudio",
            planName: m.plan_name,
            endDate: formattedEndDate,
            daysRemaining,
          });

          results.reminded++;
        }
      } catch (err) {
        console.error(`[membership-expiry] Error processing membership ${m.id}:`, err);
        results.errors++;
      }
    }

    console.info("[membership-expiry] Completed:", results);

    return new Response(JSON.stringify({ success: true, ...results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[membership-expiry] Fatal error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
