import type { Route } from "./+types/_index";
import { Link, useFetcher } from "react-router";
import { useDashboardTheme as useDashboardThemeHook, type ThemeTokens } from "~/hooks/useDashboardTheme";
import { useState, useMemo, useEffect } from "react";
import {
    Calendar, CreditCard, TrendingUp, ArrowRight, Flame, Coffee,
    Dumbbell, Timer, Smile, Frown, Meh, Zap, Activity, Plus, History, Trash2, Check, X, Scale, Ruler,
    Droplet, Heart, Moon, Award, ChevronLeft, ChevronRight, Clock, MapPin, Users, Sparkles, Rocket, Crown, Star, Ticket
} from "lucide-react";
import { BookingConfirmationPopup } from "~/components/BookingConfirmationPopup";

// ─── Constants ──────────────────────────────────────────────────
const PREDEFINED_EXERCISES = [
    "Peso Muerto", "Sentadilla Libre", "Press Banca", "Dominadas (Pull-ups)", "Press Militar",
    "Remo con Barra", "Sentadilla Frontal", "Clean & Jerk", "Snatch (Arrancada)", "Fondos en Paralelas (Dips)",
    "Hip Thrust", "Zancadas (Lunges)", "Press Inclinado", "Remo en Anillas", "Push Press",
    "Kettlebell Swing", "Box Jump", "Wall Balls", "Muscle Up", "Peso Muerto Rumano"
];

// ─── Types ──────────────────────────────────────────────────────
interface PRRecord {
    exercise: string;
    value: number;
    unit: string;
    max: number;
    previous: number;
    history: { date: string; val: number }[];
}

interface BodyStat {
    date: string;
    weight: number;
    height: number;
}

interface RecentActivity {
    name: string;
    date: string;
    amount: string;
    type: "booking" | "order";
}

interface ClassEvent {
    id: string;
    title: string;
    description: string | null;
    coach_id: string;
    capacity: number;
    start_time: string;
    end_time: string;
    location: string | null;
    bookedCount: number;
    isEvent?: boolean; // flag para diferenciar eventos exclusivos
}

interface DashEvent {
    id: string;
    name: string;
    start_time: string;
    location: string;
    description: string;
    price: number;
    max_capacity: number;
    current_enrolled: number;
}

type ClassType = "hyrox" | "fullMuv" | "upperBody" | "lowerBody" | "openGym";

// ─── Loader ──────────────────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAuth } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { profile, gymId } = await requireGymAuth(request);

    // Parallel queries
    const { getActiveEvents } = await import("~/services/event.server");

    const [
        { data: gym },
        { data: userStats },
        { data: gymStats },
        { data: prs },
        { data: bodyMeasurements },
        { data: recentBookings },
        { data: recentOrders },
        { data: topProduct },
        { data: nextBooking },
        { data: upcomingClasses },
        rawEvents,
        { data: userEventRegs },
    ] = await Promise.all([
        // Gym basics
        supabaseAdmin.from("gyms").select("brand_color, primary_color, studio_type, plan_id").eq("id", gymId).single(),
        // User stats snapshot
        supabaseAdmin
            .from("user_stats")
            .select("*")
            .eq("user_id", profile.id)
            .eq("gym_id", gymId)
            .single(),
        // Gym occupancy
        supabaseAdmin
            .from("gym_stats")
            .select("current_occupancy, max_capacity")
            .eq("gym_id", gymId)
            .single(),
        // Personal records
        supabaseAdmin
            .from("personal_records")
            .select("exercise, value, unit, previous, max_visual, history")
            .eq("user_id", profile.id)
            .eq("gym_id", gymId)
            .order("created_at", { ascending: true }),
        // Body measurements (last 10)
        supabaseAdmin
            .from("body_measurements")
            .select("weight, height, measured_at")
            .eq("user_id", profile.id)
            .eq("gym_id", gymId)
            .order("measured_at", { ascending: false })
            .limit(10),
        // Recent bookings (last 5 completed)
        supabaseAdmin
            .from("bookings")
            .select("id, status, created_at, class:classes!class_id(title)")
            .eq("user_id", profile.id)
            .eq("gym_id", gymId)
            .in("status", ["completed", "confirmed"])
            .order("created_at", { ascending: false })
            .limit(5),
        // Recent orders (last 3 paid)
        supabaseAdmin
            .from("orders")
            .select("id, total, created_at")
            .eq("user_id", profile.id)
            .eq("gym_id", gymId)
            .eq("status", "paid")
            .order("created_at", { ascending: false })
            .limit(3),
        // Most popular product for quick buy
        supabaseAdmin
            .from("products")
            .select("id, name, price")
            .eq("gym_id", gymId)
            .eq("is_active", true)
            .in("category", ["beverage", "supplement"])
            .order("created_at", { ascending: true })
            .limit(1),
        // Next upcoming booking
        supabaseAdmin
            .from("bookings")
            .select("id, class:classes!class_id(title, start_time, location)")
            .eq("user_id", profile.id)
            .eq("gym_id", gymId)
            .eq("status", "confirmed")
            .order("created_at", { ascending: false }),
        // Upcoming classes for calendar (next 30 days)
        supabaseAdmin
            .from("classes")
            .select("id, title, description, coach_id, capacity, start_time, end_time, location, current_enrolled")
            .eq("gym_id", gymId)
            .gte("start_time", new Date().toISOString())
            .lte("start_time", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
            .order("start_time", { ascending: true }),
        // Active upcoming events for this gym
        getActiveEvents(gymId),
        // Events this user has registered for (via event_registrations table if exists, fallback to orders)
        supabaseAdmin
            .from("event_registrations")
            .select("event_id")
            .eq("user_id", profile.id)
            .eq("gym_id", gymId),
    ]);

    const gymContext = {
        brandColor: gym?.brand_color || gym?.primary_color || "#7c3aed",
        studioType: gym?.studio_type || null,
    };

    // Determine user state
    const now = Date.now();
    // Determine user state and next class - filter in JS to be safe
    const nowTime = new Date().getTime();
    const upcomingBookings = (nextBooking || [])
        .filter((b: any) => b.class && new Date(b.class.start_time).getTime() > nowTime)
        .sort((a: any, b: any) => new Date(a.class.start_time).getTime() - new Date(b.class.start_time).getTime());

    const nextBookingItem = upcomingBookings[0];
    const nextClassData = nextBookingItem?.class as any;
    const classStart = nextClassData?.start_time ? new Date(nextClassData.start_time).getTime() : 0;
    const diff = classStart ? classStart - nowTime : -1;
    const hourMs = 60 * 60 * 1000;

    let userState: "before_class" | "during_class" | "after_class" = "after_class";
    if (classStart > 0) {
        if (diff > 0 && diff <= 4 * hourMs) userState = "before_class";
        else if (diff <= 0 && diff > -1 * hourMs) userState = "during_class";
    }

    // Occupancy
    const occPct = (gymStats?.current_occupancy || 0) / (gymStats?.max_capacity || 100);
    const gymOccupancy: "low" | "medium" | "high" = occPct > 0.8 ? "high" : occPct > 0.4 ? "medium" : "low";

    // Streak: count consecutive days with bookings ending today
    const { count: streakCount } = await supabaseAdmin
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("gym_id", gymId)
        .eq("status", "completed")
        .gte("created_at", new Date(Date.now() - 30 * 24 * hourMs).toISOString());
    const streak = Math.min(streakCount ?? 0, 30);

    // Map PRs
    const initialPrs: PRRecord[] = (prs ?? []).map((pr: any) => ({
        exercise: pr.exercise,
        value: Number(pr.value),
        unit: pr.unit,
        max: Number(pr.max_visual),
        previous: Number(pr.previous),
        history: (pr.history || []) as { date: string; val: number }[],
    }));

    // Map body stats
    const initialBodyStats: BodyStat[] = (bodyMeasurements ?? []).map((m: any) => ({
        date: new Date(m.measured_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" }),
        weight: Number(m.weight ?? 0),
        height: Number(m.height ?? 0),
    }));

    // Radar stats based on class attendance types
    const { data: classAttendance } = await supabaseAdmin
        .from("bookings")
        .select("class:classes!class_id(title)")
        .eq("user_id", profile.id)
        .eq("gym_id", gymId)
        .eq("status", "completed")
        .gte("created_at", new Date(Date.now() - 90 * 24 * hourMs).toISOString());

    // Simple radar: count classes by keyword
    const classNames = (classAttendance ?? []).map((b: any) => ((b.class as any)?.title ?? "").toLowerCase());
    const totalClasses = Math.max(classNames.length, 1);

    const countMatches = (keywords: string[]) =>
        classNames.filter((n: string) => keywords.some(k => n.includes(k))).length;

    const radarStats = {
        Cardio: Math.min(100, Math.round((countMatches(["spinning", "cardio", "hiit", "running", "hyrox"]) / totalClasses) * 300 + 30)),
        Fuerza: Math.min(100, Math.round((countMatches(["crossfit", "fuerza", "strength", "upper", "lower", "pesas"]) / totalClasses) * 300 + 30)),
        Flexibilidad: Math.min(100, Math.round((countMatches(["yoga", "stretch", "flex", "pilates"]) / totalClasses) * 300 + 30)),
        Mente: Math.min(100, Math.round((countMatches(["yoga", "medit", "mindful"]) / totalClasses) * 300 + 40)),
        Resistencia: Math.min(100, Math.round((countMatches(["hiit", "hyrox", "crossfit", "full", "muv"]) / totalClasses) * 300 + 30)),
    };

    // Recent activity: merge bookings + orders
    const recentActivity: RecentActivity[] = [];
    for (const b of (recentBookings ?? [])) {
        recentActivity.push({
            name: (b.class as any)?.title ?? "Clase",
            date: new Date(b.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" }),
            amount: "-1 crédito",
            type: "booking",
        });
    }
    for (const o of (recentOrders ?? [])) {
        recentActivity.push({
            name: `Orden #${o.id.slice(0, 8)}`,
            date: new Date(o.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" }),
            amount: `$${Number(o.total).toFixed(0)}`,
            type: "order",
        });
    }
    // Sort by date descending, take first 5
    recentActivity.sort((a, b) => 0); // Already sorted from DB
    const activity = recentActivity.slice(0, 5);

    // Quick buy product
    const quickBuy = topProduct?.[0]
        ? { id: topProduct[0].id, name: topProduct[0].name, price: Number(topProduct[0].price) }
        : { id: "", name: "Proteína Whey", price: 65 };

    // Next class
    const nextClass = nextClassData
        ? {
            id: nextBookingItem.id,
            name: nextClassData.title ?? "Sin reserva",
            startTime: nextClassData.start_time ?? new Date().toISOString(),
            instructor: (nextClassData as any).coach_name ?? "Coach",
            location: nextClassData.location ?? "Gimnasio",
        }
        : {
            id: "none",
            name: "Ninguna",
            startTime: new Date().toISOString(),
            instructor: "N/A",
            location: "N/A",
        };

    // Map classes for calendar
    const classes: ClassEvent[] = (upcomingClasses ?? []).map((c: any) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        coach_id: c.coach_id,
        capacity: c.capacity,
        start_time: c.start_time,
        end_time: c.end_time,
        location: c.location,
        bookedCount: c.current_enrolled ?? 0,
    }));

    // Map active events as calendar entries (always visible)
    const registeredEventIds = new Set((userEventRegs ?? []).map((r: any) => r.event_id));
    const eventItems: ClassEvent[] = (rawEvents ?? []).map((e: any) => ({
        id: e.id,
        title: e.name,
        description: e.description || null,
        coach_id: "",
        capacity: e.max_capacity,
        start_time: e.start_time,
        end_time: new Date(new Date(e.start_time).getTime() + 60 * 60 * 1000).toISOString(), // default 1h duration
        location: e.location || null,
        bookedCount: e.current_enrolled,
        isEvent: true,
    }));

    const allCalendarItems = [...classes, ...eventItems].sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    // Build upcoming items list: all booked classes + registered events, sorted by date
    const bookedClassItems = upcomingBookings.map((b: any) => ({
        id: b.id,
        name: b.class.title ?? "Clase",
        startTime: b.class.start_time,
        instructor: (b.class as any).coach_name ?? "Coach",
        location: b.class.location ?? "Gimnasio",
        isEvent: false as const,
    }));
    const registeredEventItems = (rawEvents ?? [])
        .filter((e: any) => registeredEventIds.has(e.id) && new Date(e.start_time).getTime() > nowTime)
        .map((e: any) => ({
            id: e.id,
            name: e.name,
            startTime: e.start_time,
            instructor: "",
            location: e.location || "Studio",
            isEvent: true as const,
        }));
    const upcomingItems = [...bookedClassItems, ...registeredEventItems].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    // Determine nextClass: first item of upcomingItems
    let finalNextClass: { id: string; name: string; startTime: string; instructor: string; location: string; isEvent?: boolean } =
        upcomingItems[0] ?? nextClass;

    // Strava: check connection + load stored activities
    const { getStravaConnection, getStoredActivities } = await import("~/services/strava.server");
    const { PLAN_FEATURES } = await import("~/config/plan-features");

    const gymPlan = (gym as any)?.plan_id as string ?? "emprendedor";
    const planFeatures = PLAN_FEATURES[gymPlan as keyof typeof PLAN_FEATURES] ?? PLAN_FEATURES.emprendedor;
    const stravaEnabled = planFeatures.stravaEnabled ?? false;

    let stravaConnected = false;
    let stravaActivities: any[] = [];
    let stravaStats = { weeklyMinutes: 0, totalMinutes: 0, avgHR: 0 };

    if (stravaEnabled) {
        const conn = await getStravaConnection(profile.id, gymId);
        stravaConnected = !!conn;
        if (conn) {
            // Load last 20 to compute stats, show 5 in widget
            const allActivities = await getStoredActivities(profile.id, gymId, 20);
            stravaActivities = allActivities.slice(0, 5);

            // Weekly: activities in the last 7 days
            const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            const weeklyActs = allActivities.filter(
                (a: any) => new Date(a.start_date).getTime() >= weekAgo
            );
            const weeklyMinutes = weeklyActs.reduce((s: number, a: any) => s + Math.round(a.moving_time / 60), 0);

            // Total minutes from all stored activities
            const totalMinutes = allActivities.reduce((s: number, a: any) => s + Math.round(a.moving_time / 60), 0);

            // Average HR from activities that have it
            const hrActs = allActivities.filter((a: any) => a.has_heartrate && a.average_heartrate);
            const avgHR = hrActs.length > 0
                ? Math.round(hrActs.reduce((s: number, a: any) => s + Number(a.average_heartrate), 0) / hrActs.length)
                : 0;

            stravaStats = { weeklyMinutes, totalMinutes, avgHR };
        }
    }

    // Strava toast from OAuth redirect
    const url = new URL(request.url);
    const stravaParam = url.searchParams.get("strava");

    return {
        gymContext,
        profile,
        userState,
        nextClass: finalNextClass,
        streak,
        classesMonth: userStats?.classes_this_month || 0,
        gymOccupancy,
        radarStats,
        initialPrs,
        initialBodyStats,
        quickBuy,
        recentActivity: activity,
        classes: allCalendarItems,
        events: (rawEvents ?? []).map((e: any) => ({
            id: e.id,
            name: e.name,
            start_time: e.start_time,
            location: e.location || "",
            description: e.description || "",
            price: e.price,
            max_capacity: e.max_capacity,
            current_enrolled: e.current_enrolled,
        })),
        registeredEventIds: Array.from(registeredEventIds),
        upcomingItems,
        stravaEnabled,
        stravaConnected,
        stravaActivities,
        stravaStats,
        stravaParam,
    };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAuth } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { profile, gymId } = await requireGymAuth(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "book_class") {
        const classId = formData.get("classId") as string;

        // Check user has credits
        if ((profile.credits ?? 0) < 1) {
            return { success: false, error: "No tienes créditos suficientes" };
        }

        // Get class details
        const { data: classData } = await supabaseAdmin
            .from("classes")
            .select("*, current_enrolled, capacity")
            .eq("id", classId)
            .single();

        if (!classData) {
            return { success: false, error: "Clase no encontrada" };
        }

        if (classData.current_enrolled >= classData.capacity) {
            return { success: false, error: "Clase llena" };
        }

        // Create booking
        const { data: booking, error: bookingError } = await supabaseAdmin
            .from("bookings")
            .insert({
                user_id: profile.id,
                class_id: classId,
                gym_id: gymId,
                status: "confirmed",
            })
            .select()
            .single();

        if (bookingError) {
            return { success: false, error: bookingError.message };
        }

        // Deduct credit
        await supabaseAdmin
            .from("profiles")
            .update({ credits: (profile.credits ?? 0) - 1 })
            .eq("id", profile.id);

        // Increment class enrollment
        await supabaseAdmin
            .from("classes")
            .update({ current_enrolled: (classData.current_enrolled ?? 0) + 1 })
            .eq("id", classId);

        return {
            success: true,
            booking_id: booking.id,
            class_id: classId,
            credits_remaining: (profile.credits ?? 0) - 1
        };
    }

    if (intent === "register_event") {
        const eventId = formData.get("eventId") as string;

        // Check event exists and has capacity
        const { data: eventData } = await supabaseAdmin
            .from("events")
            .select("id, max_capacity, current_enrolled, title, name, start_time, location")
            .eq("id", eventId)
            .eq("gym_id", gymId)
            .single();

        if (!eventData) return { success: false, error: "Evento no encontrado" };
        if ((eventData.current_enrolled ?? 0) >= (eventData.max_capacity ?? 0)) {
            return { success: false, error: "El evento está lleno" };
        }

        // Upsert registration (idempotent)
        const { error: regError } = await supabaseAdmin
            .from("event_registrations")
            .upsert({ user_id: profile.id, event_id: eventId, gym_id: gymId, status: "confirmed" },
                { onConflict: "user_id,event_id" });

        if (regError) return { success: false, error: regError.message };

        // Decrement available spots
        await supabaseAdmin
            .from("events")
            .update({ current_enrolled: (eventData.current_enrolled ?? 0) + 1 })
            .eq("id", eventId)
            .eq("gym_id", gymId);

        return {
            success: true,
            intent: "register_event",
            event_id: eventId,
            event_name: (eventData as any).name ?? (eventData as any).title ?? "Evento",
            event_start: eventData.start_time,
        };
    }

    if (intent === "quick_buy") {
        return { success: true, message: "¡Pedido realizado!" };
    }

    if (intent === "feedback") {
        return { success: true, message: "¡Gracias por tu feedback!" };
    }

    if (intent === "add_exercise") {
        const exercise = formData.get("exercise") as string;
        if (!exercise) return { error: "Ejercicio requerido" };

        await supabaseAdmin.from("personal_records").upsert({
            user_id: profile.id,
            gym_id: gymId,
            exercise,
            value: 0,
            unit: "kg",
            previous: 0,
            max_visual: 150,
            history: [],
        }, { onConflict: "user_id,gym_id,exercise" });

        return { success: true };
    }

    if (intent === "remove_exercise") {
        const exercise = formData.get("exercise") as string;
        await supabaseAdmin
            .from("personal_records")
            .delete()
            .eq("user_id", profile.id)
            .eq("gym_id", gymId)
            .eq("exercise", exercise);
        return { success: true };
    }

    if (intent === "add_pr_data") {
        const exercise = formData.get("exercise") as string;
        const val = parseFloat(formData.get("value") as string);
        if (!exercise || isNaN(val) || val <= 0) return { error: "Datos inválidos" };

        // Get current record
        const { data: current } = await supabaseAdmin
            .from("personal_records")
            .select("value, previous, max_visual, history")
            .eq("user_id", profile.id)
            .eq("gym_id", gymId)
            .eq("exercise", exercise)
            .single();

        if (!current) return { error: "Ejercicio no encontrado" };

        const currentVal = Number(current.value);
        const newHistory = [
            { val, date: new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short" }) },
            ...((current.history as any[]) || []),
        ].slice(0, 5);

        let newValue = currentVal;
        let newPrevious = Number(current.previous);
        let newMax = Number(current.max_visual);

        if (val > currentVal) {
            newPrevious = currentVal;
            newValue = val;
            if (val > newMax) newMax = val + 20;
        }

        await supabaseAdmin
            .from("personal_records")
            .update({
                value: newValue,
                previous: newPrevious,
                max_visual: newMax,
                history: newHistory,
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", profile.id)
            .eq("gym_id", gymId)
            .eq("exercise", exercise);

        return { success: true };
    }

    if (intent === "add_body_stat") {
        const weight = parseFloat(formData.get("weight") as string);
        const height = parseFloat(formData.get("height") as string);

        if (isNaN(weight) && isNaN(height)) return { error: "Datos inválidos" };

        await supabaseAdmin.from("body_measurements").insert({
            user_id: profile.id,
            gym_id: gymId,
            weight: isNaN(weight) ? null : weight,
            height: isNaN(height) ? null : height,
        });

        return { success: true };
    }

    return {};
}

// ─── Radar Chart SVG Component ───────────────────────────────────
function RadarChart({ stats }: { stats: Record<string, number> }) {
    const labels = Object.keys(stats);
    const values = Object.values(stats);

    const humanAverage: Record<string, number> = {
        Cardio: 60, Fuerza: 55, Flexibilidad: 50, Mente: 65, Resistencia: 60,
    };
    const avgValues = labels.map(label => humanAverage[label] || 50);

    const n = labels.length;
    const cx = 120, cy = 120, maxR = 90;
    const angleStep = (2 * Math.PI) / n;
    const startAngle = -Math.PI / 2;

    const getPoint = (i: number, r: number) => ({
        x: cx + r * Math.cos(startAngle + i * angleStep),
        y: cy + r * Math.sin(startAngle + i * angleStep),
    });

    const rings = [0.25, 0.5, 0.75, 1.0];
    const gridPaths = rings.map((frac) => {
        const pts = Array.from({ length: n }, (_, i) => getPoint(i, maxR * frac));
        return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + "Z";
    });

    const dataPts = values.map((v, i) => getPoint(i, (v / 100) * maxR));
    const dataPath = dataPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + "Z";

    const avgPts = avgValues.map((v, i) => getPoint(i, (v / 100) * maxR));
    const avgPath = avgPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + "Z";

    return (
        <div className="flex flex-col items-center w-full">
            <svg viewBox="0 0 240 240" className="w-full max-w-[260px] mx-auto">
                {gridPaths.map((d, i) => (
                    <path key={i} d={d} fill="none" stroke="#e5e7eb" strokeWidth="1" />
                ))}
                {Array.from({ length: n }, (_, i) => {
                    const p = getPoint(i, maxR);
                    return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e5e7eb" strokeWidth="1" />;
                })}
                <path d={avgPath} fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" strokeWidth="2" strokeDasharray="4 4" />
                {avgPts.map((p, i) => (
                    <circle key={`avg-${i}`} cx={p.x} cy={p.y} r="3" fill="#10b981" />
                ))}
                <path d={dataPath} fill="rgba(59,130,246,0.15)" stroke="#3b82f6" strokeWidth="2" />
                {dataPts.map((p, i) => (
                    <circle key={`usr-${i}`} cx={p.x} cy={p.y} r="4" fill="#3b82f6" />
                ))}
                {labels.map((label, i) => {
                    const p = getPoint(i, maxR + 20);
                    return (
                        <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
                            className="text-[10px] fill-gray-500 font-medium">
                            {label}
                        </text>
                    );
                })}
            </svg>
            <div className="flex gap-4 items-center justify-center -mt-2 text-[11px] font-medium text-gray-500">
                <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded border border-blue-500 bg-blue-500/50"></span> Tú
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded border border-emerald-500 border-dashed bg-emerald-500/20"></span> Promedio humano
                </div>
            </div>
        </div>
    );
}

// ─── Upcoming Item Card ──────────────────────────────────────────
function UpcomingItemCard({ item, index }: {
    item: { id: string; name: string; startTime: string; instructor: string; location: string; isEvent: boolean };
    index: number;
    th: ThemeTokens;
}) {
    const [open, setOpen] = useState(false);
    const isEv = item.isEvent;

    const dateStr = new Date(item.startTime).toLocaleString("es-MX", {
        weekday: "long", day: "numeric", month: "long",
        hour: "2-digit", minute: "2-digit",
    });

    return (
        <>
            <div className={`
            flex-shrink-0 snap-start
            w-[85vw] md:w-full
            backdrop-blur-md border rounded-2xl p-5 relative overflow-hidden group transition-all text-white
            ${isEv ? "bg-violet-500/10 border-violet-500/30 hover:bg-violet-500/15" : "bg-white/5 border-white/10 hover:bg-white/10"}
        `}>
                {/* Decorative icon */}
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-all pointer-events-none">
                    {isEv
                        ? <Sparkles className="w-16 h-16 text-violet-400 -rotate-12" />
                        : <Rocket className="w-16 h-16 text-lime-400 -rotate-12" />
                    }
                </div>

                <div className="relative z-10 flex items-center justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                        {/* Badge */}
                        {isEv ? (
                            <div className="flex items-center gap-1.5 text-violet-300 font-bold text-[10px] uppercase tracking-tighter bg-violet-500/20 w-fit px-2 py-0.5 rounded-lg">
                                <Sparkles className="w-2.5 h-2.5" />
                                {index === 0 ? "Próximo evento inscrito" : "Evento inscrito"}
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 text-lime-400 font-bold text-[10px] uppercase tracking-tighter bg-lime-400/10 w-fit px-2 py-0.5 rounded-lg">
                                <Star className="w-2.5 h-2.5 fill-lime-400" />
                                {index === 0 ? "Próxima clase reservada" : "Clase reservada"}
                            </div>
                        )}

                        {/* Name */}
                        <p className="text-xl font-black text-white leading-tight truncate">{item.name}</p>

                        {/* Meta */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-white/60">
                            <div className="flex items-center gap-1.5">
                                <Clock className={`w-3.5 h-3.5 flex-shrink-0 ${isEv ? "text-violet-400" : "text-lime-400"}`} />
                                <span className="text-xs font-medium">{dateStr}</span>
                            </div>
                            {item.location && (
                                <div className="flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                                    <span className="text-xs">{item.location}</span>
                                </div>
                            )}
                            {item.instructor && (
                                <div className="flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                                    <span className="text-xs">con {item.instructor}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* CTA */}
                    <button
                        onClick={() => setOpen(true)}
                        className={`flex-shrink-0 px-4 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 shadow-lg ${isEv ? "bg-violet-500 hover:bg-violet-600 text-white shadow-violet-500/20" : "bg-lime-400 hover:bg-lime-500 text-slate-900 shadow-lime-400/20"}`}
                    >
                        {isEv
                            ? <><Ticket className="w-3.5 h-3.5" /> Ver</>
                            : <>Ver <ArrowRight className="w-3.5 h-3.5" /></>
                        }
                    </button>
                </div>
            </div>

            {/* Detail Modal */}
            {open && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
                    onClick={() => setOpen(false)}
                >
                    <div
                        className={`relative w-full max-w-md bg-slate-900 rounded-2xl border shadow-2xl flex flex-col text-white ${isEv ? "border-violet-500/30" : "border-white/10"}`}
                        style={{ maxHeight: "min(88dvh, 88vh)", marginBottom: "env(safe-area-inset-bottom, 0px)" }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className={`shrink-0 flex items-start justify-between p-6 pb-4 border-b ${isEv ? "border-violet-500/20" : "border-white/[0.06]"}`}>
                            <div className="flex-1 min-w-0 pr-3">
                                {isEv && (
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                                        <span className="text-xs font-semibold text-violet-300 uppercase tracking-wider">Evento exclusivo · Inscrito</span>
                                    </div>
                                )}
                                <h3 className="text-xl font-black text-white leading-tight">{item.name}</h3>
                            </div>
                            <button
                                onClick={() => setOpen(false)}
                                className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-4">
                            <div className="flex items-start gap-3">
                                <Clock className={`w-5 h-5 shrink-0 mt-0.5 ${isEv ? "text-violet-400" : "text-lime-400"}`} />
                                <div>
                                    <p className="text-xs text-white/50 mb-0.5">Horario</p>
                                    <p className="font-semibold text-sm text-white capitalize">{dateStr}</p>
                                </div>
                            </div>

                            {item.location && (
                                <div className="flex items-start gap-3">
                                    <MapPin className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-white/50 mb-0.5">Ubicación</p>
                                        <p className="font-semibold text-sm text-white">{item.location}</p>
                                    </div>
                                </div>
                            )}

                            {item.instructor && (
                                <div className="flex items-start gap-3">
                                    <Users className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-white/50 mb-0.5">Instructor</p>
                                        <p className="font-semibold text-sm text-white">{item.instructor}</p>
                                    </div>
                                </div>
                            )}

                            {/* Countdown */}
                            {(() => {
                                const diff = new Date(item.startTime).getTime() - Date.now();
                                const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
                                const daysLeft = Math.floor(diff / (1000 * 60 * 60 * 24));
                                if (diff <= 0) return null;
                                const label = daysLeft >= 1
                                    ? `En ${daysLeft} día${daysLeft > 1 ? "s" : ""}`
                                    : `En ${hoursLeft} hora${hoursLeft !== 1 ? "s" : ""}`;
                                return (
                                    <div className={`rounded-xl px-4 py-3 flex items-center gap-3 ${isEv ? "bg-violet-500/10 border border-violet-500/20" : "bg-lime-400/10 border border-lime-400/20"}`}>
                                        <Clock className={`w-4 h-4 shrink-0 ${isEv ? "text-violet-400" : "text-lime-400"}`} />
                                        <p className={`text-sm font-bold ${isEv ? "text-violet-300" : "text-lime-400"}`}>{label}</p>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Footer */}
                        <div className={`shrink-0 px-6 pb-6 pt-4 border-t bg-slate-900 ${isEv ? "border-violet-500/20" : "border-white/[0.06]"}`}>
                            <Link
                                to={isEv ? "/dashboard/packages" : "/dashboard/schedule"}
                                onClick={() => setOpen(false)}
                                className={`block w-full text-center py-3.5 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95 ${isEv ? "bg-violet-500 hover:bg-violet-600 text-white" : "bg-lime-400 hover:bg-lime-500 text-slate-900"}`}
                            >
                                {isEv ? "Ver evento completo" : "Ver agenda completa"}
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// ─── Weekly Calendar Component ───────────────────────────────────
interface WeeklyCalendarProps {
    classes: ClassEvent[];
    viewYear: number;
    viewMonth: number;
    calendarView: "week" | "month";
    onViewChange: (view: "week" | "month") => void;
    onMonthChange: (year: number, month: number) => void;
    onClassSelect: (classEvent: ClassEvent | null) => void;
    selectedClass: ClassEvent | null;
    onBook: (classId: string) => void;
    userCredits: number;
    th: ThemeTokens;
    registeredEventIds?: string[];
}

function WeeklyCalendar({
    classes,
    viewYear,
    viewMonth,
    calendarView,
    onViewChange,
    onMonthChange,
    onClassSelect,
    selectedClass,
    onBook,
    userCredits,
    th,
    registeredEventIds = [],
}: WeeklyCalendarProps) {
    const [dayModalItems, setDayModalItems] = useState<ClassEvent[] | null>(null);
    const today = new Date();

    // Get current week days
    const getWeekDays = () => {
        const curr = new Date();
        const first = curr.getDate() - curr.getDay() + 1; // Monday
        const days: Date[] = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(curr);
            day.setDate(first + i);
            days.push(day);
        }
        return days;
    };

    const weekDays = getWeekDays();

    // Get month days
    const getMonthDays = () => {
        const daysInMonth = getDaysInMonth(viewYear, viewMonth);
        const startDay = getStartDayOfWeek(viewYear, viewMonth);
        const days: (Date | null)[] = [];

        for (let i = 0; i < startDay; i++) {
            days.push(null);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            days.push(new Date(viewYear, viewMonth, i));
        }

        return days;
    };

    const monthDays = getMonthDays();

    // Filter classes by date
    const getClassesForDate = (date: Date) => {
        return classes.filter(c => {
            const classDate = new Date(c.start_time);
            return isSameDay(classDate, date);
        });
    };

    const goToPrevMonth = () => {
        if (viewMonth === 0) {
            onMonthChange(viewYear - 1, 11);
        } else {
            onMonthChange(viewYear, viewMonth - 1);
        }
    };

    const goToNextMonth = () => {
        if (viewMonth === 11) {
            onMonthChange(viewYear + 1, 0);
        } else {
            onMonthChange(viewYear, viewMonth + 1);
        }
    };

    return (
        <div className={`backdrop-blur-md rounded-2xl p-6 ${th.card}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className={`text-xl font-bold ${th.title} mb-1`}>Agenda de Clases</h2>
                    <p className={`${th.muted} text-sm`}>Reserva tus próximas clases</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onViewChange("week")}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${calendarView === "week"
                                ? "bg-lime-400 text-slate-900"
                                : "bg-white/5 text-white/60 hover:bg-white/10"
                            }`}
                    >
                        Semana
                    </button>
                    <button
                        onClick={() => onViewChange("month")}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${calendarView === "month"
                                ? "bg-lime-400 text-slate-900"
                                : "bg-white/5 text-white/60 hover:bg-white/10"
                            }`}
                    >
                        Mes
                    </button>
                </div>
            </div>

            {/* Month Navigation */}
            {calendarView === "month" && (
                <div className="flex items-center justify-between mb-4">
                    <button
                        onClick={goToPrevMonth}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white transition-all"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h3 className="text-lg font-bold text-white">
                        {MONTH_NAMES[viewMonth]} {viewYear}
                    </h3>
                    <button
                        onClick={goToNextMonth}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white transition-all"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Week View */}
            {calendarView === "week" && (
                <div className="overflow-x-auto pb-2 -mx-6 px-6">
                    <div className="grid grid-cols-7 gap-2 min-w-[560px]">
                        {weekDays.map((day, idx) => {
                            const dayClasses = getClassesForDate(day);
                            const isToday = isSameDay(day, today);

                            return (
                                <div
                                    key={idx}
                                    className={`p-3 rounded-xl border ${isToday
                                            ? "bg-lime-400/10 border-lime-400/30"
                                            : "bg-white/5 border-white/10"
                                        } min-h-[120px]`}
                                >
                                    <div className="text-center mb-2">
                                        <p className={`text-xs ${th.faint} font-medium`}>{DAY_NAMES[idx]}</p>
                                        <p
                                            className={`text-lg font-bold ${isToday ? "text-lime-400" : th.title
                                                }`}
                                        >
                                            {day.getDate()}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        {dayClasses.slice(0, 2).map((classEvent) => {
                                            const isEv = (classEvent as any).isEvent;
                                            const classType = inferClassType(classEvent.title);
                                            const colors = CLASS_COLORS[classType];
                                            const startTime = new Date(classEvent.start_time).toLocaleTimeString("es-MX", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            });

                                            if (isEv) {
                                                return (
                                                    <button
                                                        key={classEvent.id}
                                                        onClick={() => onClassSelect(classEvent)}
                                                        className="w-full text-left p-2 rounded-lg bg-violet-500/20 border border-violet-500/30 hover:scale-105 transition-all"
                                                    >
                                                        <p className="text-[10px] font-bold text-violet-300 flex items-center gap-1">
                                                            <Sparkles className="w-2.5 h-2.5 inline" />{startTime}
                                                        </p>
                                                        <p className={`text-[9px] ${th.body} truncate opacity-80`}>
                                                            {classEvent.title}
                                                        </p>
                                                    </button>
                                                );
                                            }

                                            return (
                                                <button
                                                    key={classEvent.id}
                                                    onClick={() => onClassSelect(classEvent)}
                                                    className={`w-full text-left p-2 rounded-lg ${colors.bg} border border-white/10 hover:scale-105 transition-all`}
                                                >
                                                    <p className={`text-[10px] font-bold ${colors.text}`}>
                                                        {startTime}
                                                    </p>
                                                    <p className={`text-[9px] ${th.body} truncate opacity-80`}>
                                                        {classEvent.title}
                                                    </p>
                                                </button>
                                            );
                                        })}
                                        {dayClasses.length > 2 && (
                                            <button
                                                onClick={() => setDayModalItems(dayClasses)}
                                                className="text-[9px] text-lime-400/80 hover:text-lime-400 text-center w-full transition-colors font-medium"
                                            >
                                                +{dayClasses.length - 2} más
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Month View */}
            {calendarView === "month" && (
                <div className="overflow-x-auto pb-2 -mx-6 px-6">
                    <div className="min-w-[360px]">
                        <div className="grid grid-cols-7 gap-1 mb-2">
                            {DAY_NAMES.map((name) => (
                                <div key={name} className={`text-center text-xs ${th.faint} font-medium py-2`}>
                                    {name}
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {monthDays.map((day, idx) => {
                                if (!day) {
                                    return <div key={`empty-${idx}`} className="aspect-square" />;
                                }

                                const dayClasses = getClassesForDate(day);
                                const isToday = isSameDay(day, today);

                                return (
                                    <div
                                        key={idx}
                                        className={`aspect-square p-1 rounded-lg border ${isToday
                                                ? "bg-lime-400/10 border-lime-400/30"
                                                : "bg-white/5 border-white/10"
                                            } hover:bg-white/10 transition-all`}
                                    >
                                        <p
                                            className={`text-xs font-bold mb-0.5 ${isToday ? "text-lime-400" : th.title
                                                }`}
                                        >
                                            {day.getDate()}
                                        </p>
                                        <div className="space-y-0.5">
                                            {dayClasses.slice(0, 2).map((classEvent) => {
                                                const isEv = (classEvent as any).isEvent;
                                                const classType = inferClassType(classEvent.title);
                                                const colors = CLASS_COLORS[classType];

                                                return (
                                                    <button
                                                        key={classEvent.id}
                                                        onClick={() => onClassSelect(classEvent)}
                                                        className={`w-full h-1 rounded-full ${isEv ? "bg-violet-400" : colors.dot}`}
                                                        title={classEvent.title}
                                                    />
                                                );
                                            })}
                                            {dayClasses.length > 2 && (
                                                <button
                                                    onClick={() => setDayModalItems(dayClasses)}
                                                    className="w-full h-1 rounded-full bg-white/30"
                                                    title={`+${dayClasses.length - 2} más`}
                                                />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Day All-Items Modal — shows when "+X más" is clicked */}
            {dayModalItems && (
                <div
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-md"
                    onClick={() => setDayModalItems(null)}
                >
                    <div
                        className="relative w-full sm:max-w-sm bg-slate-900 sm:rounded-2xl rounded-t-2xl border border-white/10 shadow-2xl flex flex-col text-white"
                        style={{ maxHeight: "min(80dvh, 80vh)" }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="shrink-0 flex items-center justify-between p-5 pb-4 border-b border-white/[0.06]">
                            <h3 className="text-lg font-bold text-white">
                                {dayModalItems[0] && new Date(dayModalItems[0].start_time).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
                            </h3>
                            <button
                                onClick={() => setDayModalItems(null)}
                                className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-2">
                            {dayModalItems.map((item) => {
                                const isEv = (item as any).isEvent;
                                const classType = inferClassType(item.title);
                                const colors = CLASS_COLORS[classType];
                                const startTime = new Date(item.start_time).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => { setDayModalItems(null); onClassSelect(item); }}
                                        className={`w-full text-left p-3 rounded-xl border transition-all hover:scale-[1.02] ${isEv ? "bg-violet-500/15 border-violet-500/30" : `${colors.bg} border-white/10`}`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            {isEv && <Sparkles className="w-3.5 h-3.5 text-violet-300 shrink-0" />}
                                            <p className={`text-xs font-bold ${isEv ? "text-violet-300" : colors.text}`}>{startTime}</p>
                                            {isEv && <span className="text-[9px] bg-violet-500/30 text-violet-200 px-1.5 py-0.5 rounded-full font-medium">Evento</span>}
                                        </div>
                                        <p className="text-sm text-white font-medium truncate">{item.title}</p>
                                        {item.location && <p className="text-xs text-white/50 mt-0.5">{item.location}</p>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Class Detail Modal — flex-col so button never gets clipped */}
            {selectedClass && (() => {
                const isSelEv = (selectedClass as any).isEvent;
                const isRegistered = isSelEv && registeredEventIds.includes(selectedClass.id);
                return (
                    <div
                        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-md"
                        onClick={() => onClassSelect(null)}
                    >
                        <div
                            className={`relative w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border shadow-2xl flex flex-col text-white ${isSelEv ? "bg-slate-900 border-violet-500/30" : "bg-slate-900 border-white/10"}`}
                            style={{ maxHeight: "min(92dvh, 92vh)", color: "white" }}
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Sticky header */}
                            <div className={`shrink-0 flex items-start justify-between p-6 pb-4 border-b ${isSelEv ? "border-violet-500/20" : "border-white/[0.06]"}`}>
                                <div className="flex-1 min-w-0 pr-3">
                                    {isSelEv && (
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                                            <span className="text-xs font-semibold text-violet-300 uppercase tracking-wider">Evento Exclusivo</span>
                                        </div>
                                    )}
                                    <h3 className="text-xl font-bold !text-white leading-tight">{selectedClass.title}</h3>
                                    {selectedClass.description && (
                                        <p className="text-white/60 text-sm mt-1 line-clamp-2">{selectedClass.description}</p>
                                    )}
                                </div>
                                <button
                                    onClick={() => onClassSelect(null)}
                                    className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div
                                className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 space-y-3"
                                style={{ color: "white" }}
                            >
                                <div className="flex items-center gap-3">
                                    <Clock className={`w-5 h-5 shrink-0 ${isSelEv ? "text-violet-400" : "text-lime-400"}`} />
                                    <div>
                                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>Horario</p>
                                        <p className="font-semibold text-sm" style={{ color: "white" }}>
                                            {new Date(selectedClass.start_time).toLocaleString("es-MX", {
                                                weekday: "long",
                                                day: "numeric",
                                                month: "long",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </p>
                                    </div>
                                </div>

                                {selectedClass.location && (
                                    <div className="flex items-center gap-3">
                                        <MapPin className="w-5 h-5 text-blue-400 shrink-0" />
                                        <div>
                                            <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>Ubicación</p>
                                            <p className="font-semibold text-sm" style={{ color: "white" }}>{selectedClass.location}</p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-3">
                                    <Users className="w-5 h-5 text-purple-400 shrink-0" />
                                    <div>
                                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>Disponibilidad</p>
                                        <p className="font-semibold text-sm" style={{ color: "white" }}>
                                            {selectedClass.bookedCount} / {selectedClass.capacity} {isSelEv ? "inscritos" : "reservados"}
                                        </p>
                                    </div>
                                </div>

                                {isSelEv && (selectedClass as any).price !== undefined && (
                                    <div className="flex items-center gap-3">
                                        <Ticket className="w-5 h-5 text-amber-400 shrink-0" />
                                        <div>
                                            <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>Precio</p>
                                            <p className="font-semibold text-sm" style={{ color: "white" }}>
                                                {(selectedClass as any).price === 0 ? "Gratis" : `$${(selectedClass as any).price} MXN`}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Sticky footer — always visible */}
                            <div className={`shrink-0 px-6 pb-6 pt-3 border-t bg-slate-900 ${isSelEv ? "border-violet-500/20" : "border-white/[0.06]"}`} style={{ color: "white" }}>
                                {isSelEv ? (
                                    isRegistered ? (
                                        <div className="w-full py-3.5 bg-violet-500/20 border border-violet-500/30 text-violet-300 rounded-xl font-bold text-center min-h-[48px] flex items-center justify-center gap-2">
                                            <Sparkles className="w-4 h-4" /> Ya estás inscrito
                                        </div>
                                    ) : (
                                        <Link
                                            to="/dashboard/packages"
                                            onClick={() => onClassSelect(null)}
                                            className="block w-full py-3.5 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-bold shadow-xl shadow-violet-500/20 transition-all active:scale-95 min-h-[48px] text-center"
                                        >
                                            Ver evento e inscribirme
                                        </Link>
                                    )
                                ) : (
                                    <>
                                        <button
                                            onClick={() => {
                                                onBook(selectedClass.id);
                                                onClassSelect(null);
                                            }}
                                            disabled={userCredits < 1 || selectedClass.bookedCount >= selectedClass.capacity}
                                            className="w-full py-3.5 bg-lime-400 hover:bg-lime-500 disabled:bg-white/10 disabled:text-white/40 text-slate-900 rounded-xl font-bold shadow-xl shadow-lime-400/20 transition-all active:scale-95 min-h-[48px]"
                                        >
                                            {userCredits < 1
                                                ? "Sin créditos suficientes"
                                                : selectedClass.bookedCount >= selectedClass.capacity
                                                    ? "Clase llena"
                                                    : "Reservar clase (1 crédito)"}
                                        </button>
                                        {userCredits < 1 && (
                                            <p className="text-xs text-red-400 text-center mt-2">
                                                <Link to="/dashboard/packages" className="underline">Comprar más créditos →</Link>
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

// ─── Smart Hero Component ────────────────────────────────────────
function SmartHero({
    userState, profile, nextClass, streak,
}: {
    userState: string;
    profile: { full_name: string };
    nextClass: { id: string; name: string; startTime: string; instructor: string; location: string };
    streak: number;
}) {
    const fetcher = useFetcher();
    const firstName = profile.full_name.split(" ")[0];

    if (userState === "before_class") {
        const startMs = new Date(nextClass.startTime).getTime();
        const hoursLeft = Math.max(0, Math.floor((startMs - Date.now()) / (1000 * 60 * 60)));
        const minsLeft = Math.max(0, Math.floor(((startMs - Date.now()) % (1000 * 60 * 60)) / (1000 * 60)));

        return (
            <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 rounded-2xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
                <div className="relative z-10">
                    <p className="text-blue-200 text-sm font-medium uppercase tracking-wider">Tu próxima clase</p>
                    <h2 className="text-2xl md:text-3xl font-black mt-2 leading-tight">{nextClass.name}</h2>
                    <p className="text-blue-100 mt-1 text-sm">con {nextClass.instructor} • {nextClass.location}</p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-6">
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-3 text-center w-fit">
                            <p className="text-3xl font-black">{hoursLeft}h {minsLeft}m</p>
                            <p className="text-blue-200 text-xs mt-1">para tu clase</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Link to="/dashboard/schedule"
                                className="flex items-center justify-center bg-white text-blue-600 px-5 py-3 rounded-xl font-bold text-sm active:scale-95 transition-all min-h-[44px]">
                                Ver detalles
                            </Link>
                            <fetcher.Form method="post">
                                <input type="hidden" name="intent" value="quick_buy" />
                                <button type="submit"
                                    className="w-full sm:w-auto bg-amber-400 text-amber-900 px-5 py-3 rounded-xl font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2 min-h-[44px]">
                                    <Coffee className="w-4 h-4" />
                                    Pre-ordenar batido
                                </button>
                            </fetcher.Form>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (userState === "during_class") {
        return (
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
                <div className="relative z-10">
                    <div className="flex items-center gap-2 text-emerald-200 text-sm font-medium uppercase tracking-wider">
                        <Activity className="w-4 h-4 animate-pulse" />
                        EN SESIÓN
                    </div>
                    <h2 className="text-3xl font-black mt-2">{nextClass.name}</h2>
                    <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-xl p-5">
                        <p className="text-sm text-emerald-200 font-medium mb-3">WOD – Workout del Día</p>
                        <ul className="space-y-2 text-white font-medium">
                            <li className="flex items-center gap-2"><Dumbbell className="w-4 h-4 text-emerald-300" /> 21-15-9: Thrusters (43kg)</li>
                            <li className="flex items-center gap-2"><Dumbbell className="w-4 h-4 text-emerald-300" /> Pull-ups</li>
                            <li className="flex items-center gap-2"><Timer className="w-4 h-4 text-emerald-300" /> Cap: 12 min</li>
                        </ul>
                    </div>
                </div>
            </div>
        );
    }

    // after_class (Streak Card)
    const getStreakMessage = (s: number, name: string) => {
        if (s === 0) return {
            title: "¡Es un gran día para empezar!",
            message: "Hoy es el mejor momento para reactivar tu rutina. ¡Te esperamos en el gym!"
        };
        if (s <= 3) return {
            title: `¡Buen inicio, ${name}!`,
            message: `Tienes una racha de ${s} días. ¡La constancia es la clave del éxito!`
        };
        if (s <= 7) return {
            title: "¡Vas con todo!",
            message: `Llevas ${s} días seguidos. ¡Tu cuerpo te lo agradecerá, no bajes el ritmo!`
        };
        if (s <= 14) return {
            title: "¡Nivel leyenda!",
            message: `${s} días de puro esfuerzo. Eres una inspiración para la comunidad.`
        };
        return {
            title: "¡Eres imparable!",
            message: `¡Increíble! ${s} días consecutivos. Has convertido la disciplina en un estilo de vida.`
        };
    };

    const streakInfo = getStreakMessage(streak, firstName);

    return (
        <div className="bg-lime-400 rounded-2xl p-8 text-slate-900 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-1/2 w-48 h-48 bg-white/20 rounded-full -translate-y-1/3" />
            <div className="relative z-10">
                <h2 className="text-3xl font-black">{streakInfo.title}</h2>
                <p className="text-slate-800 mt-2 text-lg font-medium">
                    {streakInfo.message}
                </p>
            </div>
        </div>
    );
}

// ─── Calendar Helpers ─────────────────────────────────────────────
const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTH_NAMES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function getStartDayOfWeek(year: number, month: number) {
    const d = new Date(year, month, 1).getDay();
    return d === 0 ? 6 : d - 1;
}

function isSameDay(d1: Date, d2: Date) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function inferClassType(title: string): ClassType {
    const t = title.toLowerCase();
    if (t.includes("hyrox")) return "hyrox";
    if (t.includes("full") || t.includes("muv")) return "fullMuv";
    if (t.includes("upper")) return "upperBody";
    if (t.includes("lower")) return "lowerBody";
    if (t.includes("open")) return "openGym";
    return "fullMuv";
}

const CLASS_COLORS: Record<ClassType, { bg: string; text: string; dot: string }> = {
    hyrox: { bg: "bg-red-500/20", text: "text-red-400", dot: "bg-red-500" },
    fullMuv: { bg: "bg-blue-500/20", text: "text-blue-400", dot: "bg-blue-500" },
    upperBody: { bg: "bg-orange-500/20", text: "text-orange-400", dot: "bg-orange-500" },
    lowerBody: { bg: "bg-emerald-500/20", text: "text-emerald-400", dot: "bg-emerald-500" },
    openGym: { bg: "bg-gray-500/20", text: "text-gray-400", dot: "bg-gray-600" },
};


// ─── Main Component ──────────────────────────────────────────────
export default function DashboardIndex({ loaderData }: Route.ComponentProps) {
    const { gymContext, profile, userState, nextClass, streak, classesMonth, gymOccupancy, radarStats, initialPrs, initialBodyStats, quickBuy, recentActivity, classes, registeredEventIds = [], upcomingItems = [], stravaEnabled = false, stravaConnected = false, stravaActivities = [], stravaStats = { weeklyMinutes: 0, totalMinutes: 0, avgHR: 0 }, stravaParam } = loaderData;
    const brandColor = gymContext?.brandColor || "#7c3aed";
    const th = useDashboardThemeHook();
    const fetcher = useFetcher();
    const [prs, setPrs] = useState(initialPrs);
    const [selectedExercise, setSelectedExercise] = useState("");
    const [addingDataTo, setAddingDataTo] = useState<string | null>(null);
    const [newDataValue, setNewDataValue] = useState<string>("");

    const [bodyStats, setBodyStats] = useState(initialBodyStats);
    const [newWeight, setNewWeight] = useState("");
    const [newHeight, setNewHeight] = useState("");

    // Calendar state
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [calendarView, setCalendarView] = useState<"week" | "month">("week");
    const [selectedClass, setSelectedClass] = useState<ClassEvent | null>(null);

    // Confirmation popup state
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [confirmedBooking, setConfirmedBooking] = useState<{
        title: string;
        startTime: string;
        creditsRemaining: number;
    } | null>(null);

    // Monitor booking success
    useEffect(() => {
        if (fetcher.data && (fetcher.data as any).success && (fetcher.data as any).booking_id) {
            const bookedClassId = (fetcher.data as any).class_id || selectedClass?.id;
            const bookedClass = classes.find(c => c.id === bookedClassId) || selectedClass;

            if (bookedClass) {
                setConfirmedBooking({
                    title: bookedClass.title,
                    startTime: bookedClass.start_time,
                    creditsRemaining: (fetcher.data as any).credits_remaining ?? profile.credits - 1,
                });
                setShowConfirmation(true);
                setSelectedClass(null);
            }
        }
    }, [fetcher.data, selectedClass, classes, profile.credits]);
    const [isAddingBodyStat, setIsAddingBodyStat] = useState(false);

    const handleAddExercise = () => {
        if (!selectedExercise) return;
        if (prs.find(pr => pr.exercise === selectedExercise)) return;

        // Optimistic UI update
        setPrs([...prs, {
            exercise: selectedExercise, value: 0, unit: "kg", max: 150, previous: 0, history: []
        }]);

        // Persist to Supabase
        const fd = new FormData();
        fd.set("intent", "add_exercise");
        fd.set("exercise", selectedExercise);
        fetcher.submit(fd, { method: "post" });

        setSelectedExercise("");
    };

    const handleRemoveExercise = (exerciseToRemove: string) => {
        setPrs(prs.filter(pr => pr.exercise !== exerciseToRemove));

        const fd = new FormData();
        fd.set("intent", "remove_exercise");
        fd.set("exercise", exerciseToRemove);
        fetcher.submit(fd, { method: "post" });
    };

    const handleAddData = (exercise: string) => {
        const val = parseFloat(newDataValue);
        if (isNaN(val) || val <= 0) return;

        // Optimistic UI update
        setPrs(prs.map(pr => {
            if (pr.exercise !== exercise) return pr;
            const newHistory = [{ val, date: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) }, ...pr.history].slice(0, 5);
            let newValue = pr.value;
            let newPrevious = pr.previous;
            let newMax = pr.max;
            if (val > pr.value) {
                newPrevious = pr.value;
                newValue = val;
                if (val > pr.max) newMax = val + 20;
            }
            return { ...pr, value: newValue, previous: newPrevious, max: newMax, history: newHistory };
        }));

        // Persist to Supabase
        const fd = new FormData();
        fd.set("intent", "add_pr_data");
        fd.set("exercise", exercise);
        fd.set("value", String(val));
        fetcher.submit(fd, { method: "post" });

        setAddingDataTo(null);
        setNewDataValue("");
    };

    const handleAddBodyStat = () => {
        const weight = parseFloat(newWeight);
        const height = parseFloat(newHeight);
        if (isNaN(weight) && isNaN(height)) return;

        const currentLatest = bodyStats[0];
        const newStat = {
            date: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
            weight: !isNaN(weight) ? weight : currentLatest?.weight ?? 0,
            height: !isNaN(height) ? height : currentLatest?.height ?? 0,
        };

        setBodyStats([newStat, ...bodyStats]);

        // Persist to Supabase
        const fd = new FormData();
        fd.set("intent", "add_body_stat");
        fd.set("weight", String(!isNaN(weight) ? weight : ""));
        fd.set("height", String(!isNaN(height) ? height : ""));
        fetcher.submit(fd, { method: "post" });

        setIsAddingBodyStat(false);
        setNewWeight("");
        setNewHeight("");
    };

    const occupancyConfig = {
        low: { label: "Bajo", color: "bg-green-400", text: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
        medium: { label: "Medio", color: "bg-yellow-400", text: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200" },
        high: { label: "Alto", color: "bg-red-400", text: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
    };
    const occ = occupancyConfig[gymOccupancy];

    // Boost Cardio + Resistencia radar axes when Strava activities exist outside gym
    const enrichedRadar = { ...radarStats };
    if (stravaConnected && stravaStats.totalMinutes > 0) {
        const cardioBoost = Math.min(20, Math.round((stravaStats.totalMinutes / 60) * 2));
        enrichedRadar.Cardio     = Math.min(100, enrichedRadar.Cardio + cardioBoost);
        enrichedRadar.Resistencia = Math.min(100, enrichedRadar.Resistencia + Math.round(cardioBoost * 0.6));
    }
    const weakest = Object.entries(enrichedRadar).sort((a, b) => a[1] - b[1])[0];
    const classSuggestions: Record<string, string> = {
        Cardio: "Spinning", Fuerza: "CrossFit Fundamentals", Flexibilidad: "Yoga Flow",
        Mente: "Yoga Flow", Resistencia: "HIIT Morning",
    };

    const firstName = profile.full_name.split(" ")[0];

    return (
        <div className="space-y-6 pb-20 md:pb-6">
            {/* Header Welcome */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold flex flex-wrap gap-x-2 gap-y-0">
                        <span className={th.title}>¡Hola,</span>
                        <span className={`${th.title} break-all`}>{firstName}</span>
                    </h1>
                    <p className={`${th.muted} mt-1 text-sm md:text-base`}>¡Hoy es un gran día para entrenar!</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link to="/dashboard/schedule" className={`relative p-3 ${th.surface} ${th.cardHover} rounded-xl border ${th.border} transition-all`} title="Ver agenda de clases">
                        <Calendar className={`w-5 h-5 ${th.title}`} />
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-lime-400 rounded-full animate-pulse" />
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">
                {/* Clases este mes */}
                <div className={`${th.card} backdrop-blur-md rounded-2xl p-5 ${th.cardHover} transition-all`}>
                    <div className="flex items-center gap-2 mb-3">
                        <Droplet className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className={`text-3xl font-bold ${th.title} mb-1`}>{classesMonth}</div>
                    <div className={`${th.muted} text-sm`}>Clases este mes</div>
                </div>

                {/* Racha */}
                <div className={`${th.card} backdrop-blur-md rounded-2xl p-5 ${th.cardHover} transition-all`}>
                    <div className="flex items-center gap-2 mb-3">
                        <Flame className="w-5 h-5 text-orange-400" />
                    </div>
                    <div className={`text-3xl font-bold ${th.title} mb-1`}>{streak}</div>
                    <div className={`${th.muted} text-sm`}>Racha de días</div>
                </div>

                {/* Créditos */}
                <div className={`${th.card} backdrop-blur-md rounded-2xl p-5 ${th.cardHover} transition-all`}>
                    <div className="flex items-center gap-2 mb-3">
                        <Heart className="w-5 h-5 text-red-400" />
                    </div>
                    <div className={`text-3xl font-bold ${th.title} mb-1`}>{profile.credits}</div>
                    <div className={`${th.muted} text-sm`}>Créditos disponibles</div>
                </div>
            </div>

            {/* Gym Status Indicator */}
            <div className={`flex items-center justify-between px-6 py-4 rounded-2xl border backdrop-blur-md ${occ.bg} ${occ.border} bg-opacity-10`}>
                <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${occ.color} animate-pulse`} />
                    <div>
                        <p className={`text-sm font-semibold ${occ.text}`}>Tráfico en el gym: {occ.label}</p>
                        <p className={`text-xs ${th.faint}`}>Conectado a torniquetes de acceso</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${occ.bg} ${occ.text}`}>
                        {occ.label}
                    </span>
                </div>
            </div>

            {/* Próximas reservas — carrusel en móvil, stack en desktop */}
            {(upcomingItems as any[]).length > 0 && (
                <>
                    {/* Mobile: scroll horizontal */}
                    <div className="md:hidden -mx-4 px-4">
                        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-none">
                            {(upcomingItems as any[]).map((item, i) => (
                                <UpcomingItemCard key={item.id + i} item={item} index={i} th={th} />
                            ))}
                        </div>
                    </div>
                    {/* Desktop: stack vertical */}
                    <div className="hidden md:flex flex-col gap-3">
                        {(upcomingItems as any[]).map((item, i) => (
                            <UpcomingItemCard key={item.id + i} item={item} index={i} th={th} />
                        ))}
                    </div>
                </>
            )}

            {/* Next Class / Smart Hero */}
            <SmartHero userState={userState} profile={profile} nextClass={nextClass} streak={streak} />

            {/* Calendar Widget */}
            <WeeklyCalendar
                classes={classes}
                viewYear={viewYear}
                viewMonth={viewMonth}
                calendarView={calendarView}
                onViewChange={setCalendarView}
                onMonthChange={(year, month) => {
                    setViewYear(year);
                    setViewMonth(month);
                }}
                onClassSelect={setSelectedClass}
                selectedClass={selectedClass}
                onBook={(classId) => {
                    const fd = new FormData();
                    fd.set("intent", "book_class");
                    fd.set("classId", classId);
                    fetcher.submit(fd, { method: "post" });
                }}
                userCredits={profile.credits ?? 0}
                th={th}
                registeredEventIds={registeredEventIds as string[]}
            />

            {/* Booking Confirmation Popup */}
            {confirmedBooking && (
                <BookingConfirmationPopup
                    isOpen={showConfirmation}
                    onClose={() => setShowConfirmation(false)}
                    classTitle={confirmedBooking.title}
                    startTime={confirmedBooking.startTime}
                    creditsRemaining={confirmedBooking.creditsRemaining}
                />
            )}

            {/* Progress Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Workout Progress Card */}
                <div className={`${th.card} backdrop-blur-md rounded-2xl p-6`}>
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className={`text-xl font-bold ${th.title} mb-1`}>Progreso</h2>
                            <p className={`${th.muted} text-sm`}>Tu trayectoria fitness</p>
                        </div>
                        <Link to={stravaConnected ? "/dashboard/progreso" : "/dashboard/schedule"}
                            className="text-lime-500 hover:text-lime-400 text-sm font-medium flex items-center gap-1">
                            {stravaConnected ? "Ver progreso" : "Ver agenda"} <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                    {/* Progress Stats */}
                    <div className="space-y-4">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className={`${th.body} text-sm font-medium`}>Actividad semanal</span>
                                <span className={`${th.title} font-semibold`}>
                                    {stravaConnected ? `${stravaStats.weeklyMinutes} min` : `${classesMonth} clases`}
                                </span>
                            </div>
                            <div className={`w-full ${th.track} rounded-full h-2`}>
                                <div className="bg-gradient-to-r from-lime-400 to-emerald-500 h-2 rounded-full transition-all duration-700"
                                    style={{ width: stravaConnected ? `${Math.min(100, (stravaStats.weeklyMinutes / 300) * 100)}%` : `${Math.min(100, (classesMonth / 20) * 100)}%` }} />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className={`${th.body} text-sm font-medium`}>Tiempo total acumulado</span>
                                <span className={`${th.title} font-semibold`}>
                                    {stravaConnected ? `${Math.round(stravaStats.totalMinutes / 60)} hrs` : `${streak} días`}
                                </span>
                            </div>
                            <div className={`w-full ${th.track} rounded-full h-2`}>
                                <div className="bg-gradient-to-r from-blue-400 to-indigo-500 h-2 rounded-full transition-all duration-700"
                                    style={{ width: stravaConnected ? `${Math.min(100, (stravaStats.totalMinutes / 600) * 100)}%` : `${Math.min(100, (streak / 30) * 100)}%` }} />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className={`${th.body} text-sm font-medium`}>
                                    {stravaConnected && stravaStats.avgHR > 0 ? "Frec. cardíaca promedio" : "Cardio fuera del gym"}
                                </span>
                                <span className={`${th.title} font-semibold`}>
                                    {stravaConnected && stravaStats.avgHR > 0
                                        ? `${stravaStats.avgHR} bpm`
                                        : stravaConnected
                                            ? `${Math.round(stravaStats.totalMinutes / 60)} hrs`
                                            : "—"}
                                </span>
                            </div>
                            <div className={`w-full ${th.track} rounded-full h-2`}>
                                <div className="bg-gradient-to-r from-orange-400 to-rose-500 h-2 rounded-full transition-all duration-700"
                                    style={{ width: stravaConnected && stravaStats.avgHR > 0 ? `${Math.min(100, ((stravaStats.avgHR - 60) / 120) * 100)}%` : stravaConnected ? `${Math.min(100, (stravaStats.totalMinutes / 300) * 100)}%` : '0%' }} />
                            </div>
                        </div>
                    </div>

                    {/* Strava Widget */}
                    {stravaEnabled && (
                        <div className="mt-6 pointer-events-auto">
                            {!stravaConnected ? (
                                /* ── Not connected: CTA ── */
                                <div className="flex items-center justify-between p-4 bg-[#FC4C02]/10 border border-[#FC4C02]/20 rounded-xl group hover:bg-[#FC4C02]/20 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-[#FC4C02] p-2 rounded-lg group-hover:scale-110 transition-transform">
                                            <Activity className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <p className={`${th.title} font-bold text-sm`}>Strava Sync</p>
                                            <p className={`${th.faint} text-[10px] uppercase font-bold tracking-wider`}>Conectar cuenta</p>
                                        </div>
                                    </div>
                                    <Link
                                        to="/dashboard/strava/connect"
                                        className="bg-[#FC4C02] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#FC4C02]/90 transition-all shadow-lg shadow-[#FC4C02]/20"
                                    >
                                        Conectar
                                    </Link>
                                </div>
                            ) : (
                                /* ── Connected: activity list ── */
                                <div className="p-4 bg-[#FC4C02]/10 border border-[#FC4C02]/20 rounded-xl space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-[#FC4C02] p-1.5 rounded-lg">
                                                <Activity className="w-4 h-4 text-white" />
                                            </div>
                                            <p className={`${th.title} font-bold text-sm`}>Strava Sync</p>
                                        </div>
                                        <span className="text-[10px] text-[#FC4C02] font-bold uppercase tracking-wider">Conectado</span>
                                    </div>

                                    {stravaActivities.length === 0 ? (
                                        <p className={`${th.muted} text-xs text-center py-2`}>Sin actividades recientes</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {stravaActivities.map((act: any) => (
                                                <div key={act.strava_activity_id} className="flex items-center justify-between py-2 border-b border-[#FC4C02]/10 last:border-0">
                                                    <div className="min-w-0">
                                                        <p className={`${th.title} text-xs font-semibold truncate max-w-[130px]`}>{act.name}</p>
                                                        <p className={`${th.muted} text-[10px]`}>
                                                            {new Date(act.start_date).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                                                            {" · "}
                                                            {Math.round(act.moving_time / 60)} min
                                                        </p>
                                                    </div>
                                                    <div className="text-right shrink-0 ml-2 space-y-0.5">
                                                        {act.calories != null && (
                                                            <p className="text-[10px] text-[#FC4C02] font-bold">{Math.round(act.calories)} kcal</p>
                                                        )}
                                                        {act.has_heartrate && act.average_heartrate != null && (
                                                            <p className={`${th.muted} text-[10px] flex items-center gap-0.5 justify-end`}>
                                                                <Heart className="w-2.5 h-2.5 text-red-400" />
                                                                {Math.round(act.average_heartrate)} bpm
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Attributes Radar Chart */}
                <div className={`${th.card} backdrop-blur-md rounded-2xl p-6`}>
                    <h2 className={`text-xl font-bold ${th.title} mb-1`}>Tus Atributos</h2>
                    <p className={`${th.muted} text-sm mb-4`}>Basado en tus clases recientes</p>
                    <RadarChart stats={enrichedRadar} />
                </div>
            </div>

            {/* Personal Records Section */}
            <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">

                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex flex-col">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-white mb-1">Récords Personales</h2>
                            <p className="text-white/60 text-sm">Tus mejores marcas registradas</p>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <select value={selectedExercise} onChange={(e) => setSelectedExercise(e.target.value)}
                                className="flex-1 sm:flex-initial bg-white/5 border border-white/10 text-white text-sm rounded-xl focus:ring-lime-400 focus:border-lime-400 block p-2 backdrop-blur-md">
                                <option value="" className="bg-slate-800">Seleccionar ejercicio...</option>
                                {PREDEFINED_EXERCISES.filter(opt => !prs.find(p => p.exercise === opt)).map(opt => (
                                    <option key={opt} value={opt} className="bg-slate-800">{opt}</option>
                                ))}
                            </select>
                            <button onClick={handleAddExercise} disabled={!selectedExercise}
                                className="p-2 bg-lime-400 text-slate-900 rounded-xl font-bold hover:bg-lime-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1">
                        {/* Desktop Table Header (Hidden on Mobile) */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead>
                                    <tr className="border-b border-white/10 text-white/60">
                                        <th className="font-semibold py-3 px-2">Exercise</th>
                                        <th className="font-semibold py-3 px-2 text-right">PR Actual</th>
                                        <th className="font-semibold py-3 px-2 text-right">PR Anterior</th>
                                        <th className="font-semibold py-3 px-4">Historial</th>
                                        <th className="font-semibold py-3 px-2 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {prs.map((pr) => {
                                        const gain = pr.value - pr.previous;
                                        return (
                                            <tr key={pr.exercise} className="hover:bg-white/5 transition-colors">
                                                <td className="py-4 px-2">
                                                    <p className="font-semibold text-white">{pr.exercise}</p>
                                                    <div className="w-24 mt-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
                                                        <div className="bg-lime-400 h-full rounded-full"
                                                            style={{ width: `${Math.round((pr.value / pr.max) * 100)}%` }} />
                                                    </div>
                                                </td>
                                                {addingDataTo === pr.exercise ? (
                                                    <td colSpan={4} className="py-4 px-2">
                                                        <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/10 w-fit">
                                                            <input type="number" value={newDataValue}
                                                                onChange={(e) => setNewDataValue(e.target.value)}
                                                                className="w-20 bg-white/10 border border-white/20 text-white text-sm rounded-lg cursor-text focus:ring-lime-400 focus:border-lime-400 p-1.5 text-right font-medium placeholder-white/40"
                                                                placeholder={`e.g. ${pr.value}`} autoFocus />
                                                            <span className="text-white/60 text-xs font-semibold mr-2">{pr.unit}</span>
                                                            <button onClick={() => handleAddData(pr.exercise)} title="Save"
                                                                className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors">
                                                                <Check className="w-4 h-4" />
                                                            </button>
                                                            <button onClick={() => { setAddingDataTo(null); setNewDataValue(""); }} title="Cancel"
                                                                className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                ) : (
                                                    <>
                                                        <td className="py-4 px-2 text-right">
                                                            <span className="text-xl font-black text-white">{pr.value}</span>
                                                            <span className="text-xs text-white/60 ml-1">{pr.unit}</span>
                                                        </td>
                                                        <td className="py-4 px-2 text-right">
                                                            {pr.previous > 0 ? (
                                                                <div>
                                                                    <span className="text-white/80 font-medium">{pr.previous}{pr.unit}</span>
                                                                    {gain > 0 && <span className="text-xs text-lime-400 ml-2 block">+{gain}{pr.unit} ↑</span>}
                                                                </div>
                                                            ) : <span className="text-white/40">-</span>}
                                                        </td>
                                                        <td className="py-4 px-4">
                                                            <div className="flex gap-2 items-center text-xs">
                                                                <History className="w-4 h-4 text-white/40" />
                                                                {pr.history.length > 0 ? pr.history.map((h, i) => (
                                                                    <span key={i} className="bg-white/5 text-white/80 px-2 py-1 rounded-lg border border-white/10">
                                                                        {h.val}{pr.unit} <span className="text-white/40 ml-1 block text-[10px] uppercase text-center">{h.date}</span>
                                                                    </span>
                                                                )) : <span className="text-white/40 italic">Sin registros</span>}
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-2 text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <button onClick={() => { setAddingDataTo(pr.exercise); setNewDataValue(""); }}
                                                                    className="text-white/40 hover:text-lime-400 transition-colors p-1.5 rounded-lg hover:bg-white/5"
                                                                    title="Add mark">
                                                                    <Plus className="w-4 h-4" />
                                                                </button>
                                                                <button onClick={() => handleRemoveExercise(pr.exercise)}
                                                                    className="text-white/40 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-white/5"
                                                                    title="Delete exercise">
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile List View (Hidden on Desktop) */}
                        <div className="sm:hidden space-y-4">
                            {prs.map((pr) => {
                                const gain = pr.value - pr.previous;
                                return (
                                    <div key={pr.exercise} className="bg-white/5 border border-white/10 rounded-xl p-4">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <p className="font-bold text-white">{pr.exercise}</p>
                                                <div className="w-24 mt-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
                                                    <div className="bg-lime-400 h-full rounded-full"
                                                        style={{ width: `${Math.round((pr.value / pr.max) * 100)}%` }} />
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={() => { setAddingDataTo(pr.exercise); setNewDataValue(""); }}
                                                    className="p-2 bg-white/5 text-white/40 rounded-lg hover:text-lime-400"
                                                    title="Add mark">
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleRemoveExercise(pr.exercise)}
                                                    className="p-2 bg-white/5 text-white/40 rounded-lg hover:text-red-400"
                                                    title="Delete exercise">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        {addingDataTo === pr.exercise ? (
                                            <div className="flex items-center gap-2 bg-white/10 p-2 rounded-lg mt-2 border border-white/10">
                                                <input type="number" value={newDataValue}
                                                    onChange={(e) => setNewDataValue(e.target.value)}
                                                    className="flex-1 bg-transparent text-white text-sm focus:outline-none p-1 text-right"
                                                    placeholder={pr.value.toString()} autoFocus />
                                                <span className="text-white/40 text-xs font-medium">{pr.unit}</span>
                                                <button onClick={() => handleAddData(pr.exercise)} className="p-1.5 bg-green-500 text-white rounded-md">
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => setAddingDataTo(null)} className="p-1.5 bg-white/10 text-white rounded-md">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-1">PR Actual</p>
                                                    <p className="text-xl font-black text-white">{pr.value} <span className="text-xs font-normal text-white/60">{pr.unit}</span></p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-1">Previous</p>
                                                    <p className="text-sm font-bold text-white/80">
                                                        {pr.previous > 0 ? `${pr.previous}${pr.unit}` : "-"}
                                                        {gain > 0 && <span className="text-lime-400 ml-1">+{gain}↑</span>}
                                                    </p>
                                                </div>
                                                <div className="col-span-2 pt-2 border-t border-white/5">
                                                    <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-2">Historial</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {pr.history.length > 0 ? pr.history.map((h, i) => (
                                                            <span key={i} className="text-[11px] bg-white/5 text-white/60 px-2 py-1 rounded-md border border-white/5">
                                                                {h.val}{pr.unit} <span className="text-[9px] ml-1">{h.date}</span>
                                                            </span>
                                                        )) : <span className="text-white/20 italic text-xs">Sin registros</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {prs.length === 0 && (
                            <div className="text-center py-8 text-white/40 border-2 border-dashed border-white/10 rounded-xl mt-4">
                                Sin ejercicios registrados aún.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Body Stats and Recent Activity Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Body Stats */}
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-white mb-1">Medidas Corporales</h2>
                            <p className="text-white/60 text-sm">Tu historial de progreso físico</p>
                        </div>
                        <button onClick={() => setIsAddingBodyStat(!isAddingBodyStat)}
                            className={`p-2 rounded-xl transition-all flex items-center justify-center ${isAddingBodyStat ? "bg-white/10 text-white" : "bg-lime-400 hover:bg-lime-500 text-slate-900"}`}
                            title={isAddingBodyStat ? "Cancel" : "New record"}>
                            {isAddingBodyStat ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                        </button>
                    </div>

                    <div className="flex-1">
                        {isAddingBodyStat && (
                            <div className="bg-white/5 border border-white/10 p-4 rounded-xl mb-6">
                                <h3 className="text-sm font-semibold text-white mb-3">Registrar nuevas medidas</h3>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="text-xs text-white/60 block mb-1">Peso (kg)</label>
                                        <div className="relative">
                                            <Scale className="w-4 h-4 text-white/40 absolute left-2.5 top-2" />
                                            <input type="number" value={newWeight} onChange={(e) => setNewWeight(e.target.value)}
                                                placeholder={bodyStats[0]?.weight?.toString() ?? "70"}
                                                className="w-full pl-8 pr-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:ring-lime-400 focus:border-lime-400" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-white/60 block mb-1">Altura (m)</label>
                                        <div className="relative">
                                            <Ruler className="w-4 h-4 text-white/40 absolute left-2.5 top-2" />
                                            <input type="number" value={newHeight} step="0.01" onChange={(e) => setNewHeight(e.target.value)}
                                                placeholder={bodyStats[0]?.height?.toString() ?? "1.70"}
                                                className="w-full pl-8 pr-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:ring-lime-400 focus:border-lime-400" />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => { setIsAddingBodyStat(false); setNewWeight(""); setNewHeight(""); }}
                                        className="px-3 py-1.5 text-sm bg-white/10 text-white border border-white/20 rounded-lg hover:bg-white/20 min-h-[44px]">
                                        Cancelar
                                    </button>
                                    <button onClick={handleAddBodyStat} disabled={!newWeight && !newHeight}
                                        className="px-3 py-1.5 text-sm bg-lime-400 text-slate-900 font-medium rounded-lg hover:bg-lime-500 disabled:opacity-50 min-h-[44px]">
                                        Guardar
                                    </button>
                                </div>
                            </div>
                        )}

                        {bodyStats.length > 0 ? (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex flex-col items-center justify-center">
                                        <Scale className="w-6 h-6 text-lime-400 mb-2" />
                                        <span className="text-2xl font-black text-white">{bodyStats[0].weight} <span className="text-sm font-medium text-white/60">kg</span></span>
                                        <span className="text-xs text-white/40 mt-1">Último peso</span>
                                    </div>
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex flex-col items-center justify-center">
                                        <Ruler className="w-6 h-6 text-lime-400 mb-2" />
                                        <span className="text-2xl font-black text-white">{bodyStats[0].height} <span className="text-sm font-medium text-white/60">m</span></span>
                                        <span className="text-xs text-white/40 mt-1">Altura</span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold text-white">Historial</h3>
                                    <div className="divide-y divide-white/5 border border-white/10 bg-white/5 rounded-xl">
                                        {bodyStats.map((stat, i) => {
                                            const prevStat = bodyStats[i + 1];
                                            let weightDiff = 0;
                                            if (prevStat) weightDiff = Number((stat.weight - prevStat.weight).toFixed(1));
                                            return (
                                                <div key={i} className="flex items-center justify-between p-3 text-sm">
                                                    <span className="text-white/60 font-medium w-20">{stat.date}</span>
                                                    <div className="flex-1 text-center">
                                                        <span className="font-semibold text-white">{stat.weight} kg</span>
                                                        {weightDiff !== 0 && (
                                                            <span className={`text-xs ml-2 ${weightDiff > 0 ? 'text-orange-400' : 'text-lime-400'}`}>
                                                                {weightDiff > 0 ? '+' : ''}{weightDiff} kg
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-white/60 text-right w-16">{stat.height}m</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-8 text-white/40 border-2 border-dashed border-white/10 rounded-xl">
                                Sin medidas registradas. Agrega la primera.
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden h-fit text-white">
                    <div className="p-6 border-b border-white/10 flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white">Actividad Reciente</h2>
                        <Link to="/dashboard/schedule" className="text-sm text-lime-400 hover:text-lime-300 font-medium flex items-center gap-1">
                            Ver agenda <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                    {recentActivity.length > 0 ? (
                        <div className="divide-y divide-white/5">
                            {recentActivity.map((item, i) => (
                                <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
                                            {item.type === "booking"
                                                ? <Dumbbell className="w-5 h-5 text-lime-400" />
                                                : <CreditCard className="w-5 h-5 text-blue-400" />}
                                        </div>
                                        <div>
                                            <p className="font-medium text-white">{item.name}</p>
                                            <p className="text-sm text-white/40">{item.date}</p>
                                        </div>
                                    </div>
                                    <span className={`text-sm font-semibold ${item.amount.startsWith("+") || item.amount.startsWith("$") ? "text-lime-400" : "text-white/60"}`}>
                                        {item.amount}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-white/40 text-sm">
                            No recent activity.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
