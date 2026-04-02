// app/routes/cron/inactivity-check.ts
// ─────────────────────────────────────────────────────────────────────────────
// Vercel Cron Job: daily inactivity check for Emprendedor gyms.
//
// Schedule: daily at 09:00 UTC (configured in vercel.json)
// Protected by CRON_SECRET env var — Vercel sets the Authorization header
// automatically on cron invocations.
//
// Three-phase inactivity flow:
//   Phase 1 (45 days): Send warning email
//   Phase 2 (60 days): Archive account (gym_status = 'archived')
//   Phase 3 (150 days): Soft delete (gym_status = 'deleted_soft')
//
// NOTE: Email sending uses the n8n webhook configured in n8n.server.ts.
// If no webhook URL is set, warnings are logged only.
// ─────────────────────────────────────────────────────────────────────────────

import {
  getInactiveGyms,
  archiveGym,
  softDeleteGym,
} from "~/services/activity-tracker.server";
import { logAbuseEvent } from "~/services/abuse-control.server";
import { triggerInactivityEmail } from "~/services/n8n.server";


const WARN_DAYS        = 45;
const ARCHIVE_DAYS     = 60;
const SOFT_DELETE_DAYS = 150;

export async function loader({ request }: { request: Request }) {
  // ── Auth: verify Vercel cron secret ───────────────────────────────────────
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const results = {
    checked:     0,
    warned:      0,
    archived:    0,
    softDeleted: 0,
    errors:      0,
  };

  try {
    // Get all inactive emprendedor gyms (150+ days = worst case)
    const inactiveGyms = await getInactiveGyms(WARN_DAYS);
    results.checked = inactiveGyms.length;

    for (const gym of inactiveGyms) {
      try {
        if (gym.days_inactive >= SOFT_DELETE_DAYS) {
          // Phase 3: Soft delete
          await softDeleteGym(gym.id);
          await logAbuseEvent({
            gymId:       gym.id,
            eventType:   "account_archived",
            eventDetail: {
              phase:        3,
              days_inactive: gym.days_inactive,
              action:        "soft_deleted",
            },
          });
          results.softDeleted++;
          await triggerInactivityEmail(gym.id, "soft_delete", gym.days_inactive);

        } else if (gym.days_inactive >= ARCHIVE_DAYS) {
          // Phase 2: Archive
          await archiveGym(gym.id);
          await logAbuseEvent({
            gymId:       gym.id,
            eventType:   "account_archived",
            eventDetail: {
              phase:        2,
              days_inactive: gym.days_inactive,
              action:        "archived",
            },
          });
          results.archived++;
          await triggerInactivityEmail(gym.id, "archived", gym.days_inactive);

        } else if (gym.days_inactive >= WARN_DAYS) {
          // Phase 1: Warning
          await logAbuseEvent({
            gymId:       gym.id,
            eventType:   "inactivity_warning",
            eventDetail: {
              phase:        1,
              days_inactive: gym.days_inactive,
              action:        "warning_sent",
            },
          });
          results.warned++;
          await triggerInactivityEmail(gym.id, "warning", gym.days_inactive);
        }
      } catch (gymErr) {
        console.error(`[inactivity-check] Error processing gym ${gym.id}:`, gymErr);
        results.errors++;
      }
    }

    console.info("[inactivity-check] Completed:", results);

    return new Response(JSON.stringify({ success: true, ...results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[inactivity-check] Fatal error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
