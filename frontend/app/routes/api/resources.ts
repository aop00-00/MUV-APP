// app/routes/api/resources.ts
// GET /api/resources?classId=<id>
// Returns all resources for the class's room + which ones are already booked for that specific class.

import type { LoaderFunctionArgs } from "react-router";
import { requireGymAuth } from "~/services/gym.server";
import { supabaseAdmin } from "~/services/supabase.server";

export async function loader({ request }: LoaderFunctionArgs) {
    const { gymId } = await requireGymAuth(request);
    const url = new URL(request.url);
    const classId = url.searchParams.get("classId");

    if (!classId) {
        return Response.json({ error: "classId required" }, { status: 400 });
    }

    // Get the class to find its room
    const { data: classData, error: classErr } = await supabaseAdmin
        .from("classes")
        .select("room_id")
        .eq("id", classId)
        .eq("gym_id", gymId)
        .single();

    if (classErr || !classData?.room_id) {
        return Response.json({ resources: [], bookedIds: [] });
    }

    // Get all resources for the room
    const { data: resources, error: resErr } = await supabaseAdmin
        .from("resources")
        .select("id, name, resource_type, position_row, position_col, is_active")
        .eq("room_id", classData.room_id)
        .eq("gym_id", gymId)
        .eq("is_active", true)
        .order("position_row", { ascending: true })
        .order("position_col", { ascending: true });

    if (resErr) {
        return Response.json({ resources: [], bookedIds: [] });
    }

    // Get booked resource IDs for this specific class
    const { data: bookings } = await supabaseAdmin
        .from("bookings")
        .select("resource_id")
        .eq("class_id", classId)
        .eq("gym_id", gymId)
        .in("status", ["confirmed", "completed"])
        .not("resource_id", "is", null);

    const bookedIds = (bookings ?? []).map((b: any) => b.resource_id).filter(Boolean);

    return Response.json({ resources: resources ?? [], bookedIds });
}
