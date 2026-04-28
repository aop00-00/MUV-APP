// app/routes/staff/checkin.tsx
// Front Desk QR check-in — camera scanner + manual search + Supabase validation.

import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { useFetcher } from "react-router";
import {
    Search, CheckCircle2, XCircle, AlertTriangle,
    QrCode, User, Calendar, CreditCard, Loader2,
    Camera, UserSearch,
} from "lucide-react";
import type { Route } from "./+types/checkin";

// Lazy-load scanner — never runs on SSR
const QRScanner = lazy(() => import("~/components/staff/QRScanner"));

// ─── Types ───────────────────────────────────────────────────────────────────

interface CheckinResult {
    status: "allowed" | "denied" | "warning";
    reason?: string;
    profile?: {
        id: string;
        full_name: string;
        email: string;
        avatar_url: string | null;
        credits: number;
    };
    membership?: {
        id: string;
        plan_name: string;
        status: string;
        end_date: string;
        credits_included: number;
    };
    booking?: {
        id: string;
        class_title: string;
        start_time: string;
        room_name?: string;
    } | null;
    warnings?: string[];
    checkinId?: string;
}

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymFrontDesk } = await import("~/services/gym.server");
    const { gymId } = await requireGymFrontDesk(request);
    return { gymId };
}

// ─── Action ──────────────────────────────────────────────────────────────────
// Handles both QR validation and manual check-in confirmation.

export async function action({ request }: Route.ActionArgs) {
    const { requireGymFrontDesk } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId, profile: staffProfile } = await requireGymFrontDesk(request);

    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "validate") {
        const raw = formData.get("qrData") as string;

        // Parse QR format: "GRIND:{uuid}" or plain UUID
        let memberId: string;
        if (raw.startsWith("GRIND:")) {
            memberId = raw.slice(6).trim();
        } else {
            memberId = raw.trim();
        }

        if (!memberId || !/^[0-9a-f-]{36}$/i.test(memberId)) {
            return { status: "denied", reason: "Código QR inválido o no reconocido." } as CheckinResult;
        }

        // 1. Fetch profile — must belong to same gym
        const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("id, full_name, email, avatar_url, credits, gym_id")
            .eq("id", memberId)
            .eq("gym_id", gymId)
            .single();

        if (!profile) {
            return { status: "denied", reason: "Socio no encontrado en este estudio." } as CheckinResult;
        }

        // 2. Fetch active membership
        const { data: membership } = await supabaseAdmin
            .from("memberships")
            .select("id, plan_name, status, end_date, credits_included, gym_id")
            .eq("user_id", memberId)
            .eq("gym_id", gymId)
            .in("status", ["active", "frozen"])
            .order("end_date", { ascending: false })
            .limit(1)
            .maybeSingle();

        // 3. Fetch today's booking
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const { data: bookings } = await supabaseAdmin
            .from("bookings")
            .select(`
                id,
                class_id,
                status,
                classes!inner(
                    title,
                    start_time,
                    rooms(name)
                )
            `)
            .eq("user_id", memberId)
            .eq("gym_id", gymId)
            .in("status", ["confirmed"])
            .gte("classes.start_time", todayStart.toISOString())
            .lte("classes.start_time", todayEnd.toISOString())
            .order("classes.start_time", { ascending: true })
            .limit(1);

        const booking = bookings?.[0] ?? null;
        const bookingFormatted = booking
            ? {
                id: booking.id,
                class_title: (booking.classes as any)?.title ?? "Clase",
                start_time: (booking.classes as any)?.start_time ?? "",
                room_name: (booking.classes as any)?.rooms?.name ?? undefined,
            }
            : null;

        // 4. Determine access status
        const warnings: string[] = [];
        let status: "allowed" | "denied" | "warning" = "allowed";
        let reason: string | undefined;

        if (!membership) {
            status = "denied";
            reason = "Sin membresía activa en este estudio.";
        } else if (membership.status === "frozen") {
            status = "denied";
            reason = "Membresía congelada.";
        } else {
            const endDate = new Date(membership.end_date);
            const now = new Date();
            const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / 86400000);

            if (endDate < now) {
                status = "denied";
                reason = `Membresía vencida el ${endDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}.`;
            } else {
                if (daysLeft <= 3) {
                    status = "warning";
                    warnings.push(`Membresía vence en ${daysLeft} día${daysLeft === 1 ? "" : "s"}.`);
                }
                if (profile.credits === 1) {
                    status = status === "allowed" ? "warning" : status;
                    warnings.push("Último crédito disponible.");
                }
            }
        }

        return {
            status,
            reason,
            profile: {
                id: profile.id,
                full_name: profile.full_name,
                email: profile.email,
                avatar_url: profile.avatar_url,
                credits: profile.credits,
            },
            membership: membership
                ? {
                    id: membership.id,
                    plan_name: membership.plan_name,
                    status: membership.status,
                    end_date: membership.end_date,
                    credits_included: membership.credits_included,
                }
                : undefined,
            booking: bookingFormatted,
            warnings,
        } as CheckinResult;
    }

    if (intent === "checkin") {
        const profileId = formData.get("profileId") as string;
        const bookingId = formData.get("bookingId") as string | null;
        const qrToken = formData.get("qrToken") as string;

        const { error: logError } = await supabaseAdmin.from("access_logs").insert({
            user_id: profileId,
            gym_id: gymId,
            access_type: "entry",
            qr_token: qrToken || null,
        });

        if (logError) {
            return { status: "denied", reason: `Error al registrar check-in: ${logError.message}` } as CheckinResult;
        }

        // Decrement credits by 1 (floor at 0)
        const { data: memberProfile } = await supabaseAdmin
            .from("profiles")
            .select("credits")
            .eq("id", profileId)
            .single();

        if (memberProfile && memberProfile.credits > 0) {
            await supabaseAdmin
                .from("profiles")
                .update({ credits: memberProfile.credits - 1 })
                .eq("id", profileId);
        }

        return { status: "allowed", checkinId: "registered" } as CheckinResult;
    }

    if (intent === "search") {
        const query = (formData.get("query") as string).trim().toLowerCase();
        const { data: profiles } = await supabaseAdmin
            .from("profiles")
            .select("id, full_name, email, phone, avatar_url")
            .eq("gym_id", gymId)
            .eq("role", "member")
            .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
            .limit(5);

        return { searchResults: profiles ?? [] };
    }

    return {};
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── Component ───────────────────────────────────────────────────────────────

export default function StaffCheckin({ loaderData }: Route.ComponentProps) {
    const { gymId } = loaderData;
    const fetcher = useFetcher<typeof action>();

    const [mode, setMode] = useState<"scanner" | "manual">("scanner");
    const [scannerActive, setScannerActive] = useState(true);
    const [lastQrData, setLastQrData] = useState("");
    const [checkinDone, setCheckinDone] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    // Snapshot of the validated member — cleared on reset so stale data never shows
    const [validationResult, setValidationResult] = useState<CheckinResult | null>(null);

    const data = fetcher.data as any;
    const isLoading = fetcher.state !== "idle";
    const searchResults: any[] | null = data?.searchResults ?? null;
    const result: CheckinResult | null = validationResult;

    // Sync fetcher → validationResult only for validate responses
    useEffect(() => {
        if (data?.status && !checkinDone) {
            setValidationResult(data as CheckinResult);
        }
    }, [data]);

    // Called by QR scanner when code detected
    const handleScan = useCallback((qrData: string) => {
        setScannerActive(false);
        setCheckinDone(false);
        setValidationResult(null);
        setLastQrData(qrData);
        const fd = new FormData();
        fd.set("intent", "validate");
        fd.set("qrData", qrData);
        fetcher.submit(fd, { method: "post" });
    }, [fetcher]);

    // Manual validation from search result
    const handleManualValidate = (profileId: string) => {
        setCheckinDone(false);
        setValidationResult(null);
        setLastQrData(profileId);
        const fd = new FormData();
        fd.set("intent", "validate");
        fd.set("qrData", profileId);
        fetcher.submit(fd, { method: "post" });
    };

    // Confirm check-in (INSERT access_log)
    const handleConfirmCheckin = () => {
        if (!result?.profile) return;
        const fd = new FormData();
        fd.set("intent", "checkin");
        fd.set("profileId", result.profile.id);
        fd.set("qrToken", lastQrData);
        if (result.booking) fd.set("bookingId", result.booking.id);
        fetcher.submit(fd, { method: "post" });
        setCheckinDone(true);
    };

    // Reset — reactivate scanner and clear all state
    const handleReset = () => {
        setCheckinDone(false);
        setLastQrData("");
        setValidationResult(null);
        setScannerActive(true);
    };

    // Search handler
    const handleSearch = () => {
        if (!searchQuery.trim()) return;
        const fd = new FormData();
        fd.set("intent", "search");
        fd.set("query", searchQuery);
        fetcher.submit(fd, { method: "post" });
    };

    return (
        <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
            {/* Mode toggle */}
            <div className="flex rounded-xl bg-gray-900 border border-white/10 p-1 gap-1">
                <button
                    onClick={() => { setMode("scanner"); setScannerActive(true); handleReset(); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        mode === "scanner" ? "bg-amber-400 text-black" : "text-white/50 hover:text-white"
                    }`}
                >
                    <Camera className="w-4 h-4" /> Escáner QR
                </button>
                <button
                    onClick={() => { setMode("manual"); setScannerActive(false); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        mode === "manual" ? "bg-amber-400 text-black" : "text-white/50 hover:text-white"
                    }`}
                >
                    <UserSearch className="w-4 h-4" /> Búsqueda manual
                </button>
            </div>

            {/* ── SCANNER MODE ── */}
            {mode === "scanner" && (
                <>
                    {/* Scanner — lazy loaded, no SSR */}
                    {!result && !isLoading && (
                        <Suspense fallback={
                            <div className="w-full aspect-square max-w-sm mx-auto rounded-2xl bg-gray-900 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                            </div>
                        }>
                            <QRScanner onScan={handleScan} active={scannerActive} />
                        </Suspense>
                    )}

                    {/* Loading state */}
                    {isLoading && (
                        <div className="w-full aspect-square max-w-sm mx-auto rounded-2xl bg-gray-900 flex flex-col items-center justify-center gap-3">
                            <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
                            <p className="text-white/50 text-sm">Verificando membresía…</p>
                        </div>
                    )}
                </>
            )}

            {/* ── MANUAL SEARCH MODE ── */}
            {mode === "manual" && (
                <div className="space-y-3">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleSearch()}
                            placeholder="Nombre, email o teléfono…"
                            className="flex-1 bg-gray-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-amber-400"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={isLoading}
                            className="bg-amber-400 text-black font-bold px-4 rounded-xl disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                        </button>
                    </div>

                    {searchResults && searchResults.length === 0 && (
                        <p className="text-white/40 text-sm text-center py-4">Sin resultados</p>
                    )}

                    {searchResults && searchResults.length > 0 && (
                        <div className="space-y-2">
                            {searchResults.map((p: any) => (
                                <button
                                    key={p.id}
                                    onClick={() => handleManualValidate(p.id)}
                                    className="w-full flex items-center gap-3 bg-gray-900 border border-white/10 rounded-xl p-3 text-left hover:border-amber-400/50 transition-colors"
                                >
                                    <div className="w-9 h-9 rounded-full bg-amber-400/20 flex items-center justify-center shrink-0">
                                        <User className="w-5 h-5 text-amber-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-white font-semibold text-sm truncate">{p.full_name}</p>
                                        <p className="text-white/40 text-xs truncate">{p.email}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── VALIDATION RESULT ── */}
            {result && !checkinDone && (
                <ValidationCard
                    result={result}
                    onConfirm={handleConfirmCheckin}
                    onDeny={handleReset}
                />
            )}

            {/* ── CHECK-IN CONFIRMED ── */}
            {checkinDone && (
                <div className="bg-green-900/40 border border-green-500/50 rounded-2xl p-6 text-center space-y-4">
                    <CheckCircle2 className="w-14 h-14 text-green-400 mx-auto" />
                    <p className="text-green-300 font-bold text-xl">¡Check-in registrado!</p>
                    {result?.profile && (
                        <p className="text-white/60 text-sm">{result.profile.full_name}</p>
                    )}
                    <button
                        onClick={() => {
                            setMode("scanner");
                            setScannerActive(true);
                            setCheckinDone(false);
                            setLastQrData("");
                        }}
                        className="mt-2 bg-amber-400 text-black font-black px-6 py-4 rounded-xl text-base w-full flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    >
                        <Camera className="w-5 h-5" />
                        Escanear siguiente
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Validation Result Card ───────────────────────────────────────────────────

function ValidationCard({
    result,
    onConfirm,
    onDeny,
}: {
    result: CheckinResult;
    onConfirm: () => void;
    onDeny: () => void;
}) {
    const isAllowed = result.status === "allowed" || result.status === "warning";
    const isDenied = result.status === "denied";

    const cardColor = isDenied
        ? "border-red-500/50 bg-red-900/20"
        : result.status === "warning"
        ? "border-yellow-500/50 bg-yellow-900/20"
        : "border-green-500/50 bg-green-900/20";

    const iconColor = isDenied ? "text-red-400" : result.status === "warning" ? "text-yellow-400" : "text-green-400";

    return (
        <div className={`rounded-2xl border ${cardColor} p-5 space-y-4`}>
            {/* Status header */}
            <div className="flex items-center gap-3">
                {isDenied ? (
                    <XCircle className={`w-8 h-8 ${iconColor} shrink-0`} />
                ) : result.status === "warning" ? (
                    <AlertTriangle className={`w-8 h-8 ${iconColor} shrink-0`} />
                ) : (
                    <CheckCircle2 className={`w-8 h-8 ${iconColor} shrink-0`} />
                )}
                <div>
                    <p className={`font-black text-lg ${iconColor}`}>
                        {isDenied ? "ACCESO DENEGADO" : result.status === "warning" ? "ADVERTENCIA" : "ACCESO PERMITIDO"}
                    </p>
                    {result.reason && (
                        <p className="text-white/60 text-sm">{result.reason}</p>
                    )}
                </div>
            </div>

            {/* Member info */}
            {result.profile && (
                <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {result.profile.avatar_url ? (
                            <img src={result.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <User className="w-6 h-6 text-white/40" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="text-white font-bold truncate">{result.profile.full_name}</p>
                        <p className="text-white/50 text-xs truncate">{result.profile.email}</p>
                        <p className="text-amber-400 text-xs font-semibold mt-0.5">{result.profile.credits} crédito{result.profile.credits !== 1 ? "s" : ""}</p>
                    </div>
                </div>
            )}

            {/* Membership info */}
            {result.membership && (
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm text-white/70">
                        <CreditCard className="w-4 h-4 text-white/40" />
                        <span className="font-semibold">{result.membership.plan_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-white/50">
                        <Calendar className="w-4 h-4 text-white/30" />
                        <span>Vence: {formatDate(result.membership.end_date)}</span>
                    </div>
                </div>
            )}

            {/* Today's booking */}
            {result.booking && (
                <div className="bg-white/5 rounded-xl p-3 text-sm">
                    <p className="text-white/40 text-xs uppercase font-semibold mb-1">Clase reservada hoy</p>
                    <p className="text-white font-semibold">{result.booking.class_title}</p>
                    <p className="text-white/50 text-xs">
                        {formatTime(result.booking.start_time)}
                        {result.booking.room_name ? ` · ${result.booking.room_name}` : ""}
                    </p>
                </div>
            )}

            {/* Warnings */}
            {result.warnings && result.warnings.length > 0 && (
                <ul className="space-y-1">
                    {result.warnings.map((w, i) => (
                        <li key={i} className="text-yellow-300 text-xs flex items-start gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {w}
                        </li>
                    ))}
                </ul>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 pt-1">
                {isAllowed && (
                    <button
                        onClick={onConfirm}
                        className="flex-1 bg-green-500 hover:bg-green-400 text-white font-bold py-3 rounded-xl text-sm transition-colors"
                    >
                        Confirmar Check-in
                    </button>
                )}
                <button
                    onClick={onDeny}
                    className={`${isAllowed ? "flex-none px-4" : "flex-1"} bg-white/10 hover:bg-white/20 text-white/60 font-semibold py-3 rounded-xl text-sm transition-colors`}
                >
                    {isDenied ? "Volver" : "Cancelar"}
                </button>
            </div>
        </div>
    );
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}
