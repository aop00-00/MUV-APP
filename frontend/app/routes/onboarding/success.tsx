// onboarding/success.tsx
// Pantalla de retorno después de pagar un plan SaaS en Mercado Pago.
// MP regresa al usuario aquí con ?payment_id=X&status=approved&external_reference=...
// El loader provisiona user+gym directamente (no depende del webhook para mostrar éxito).

import { useSearchParams, Link } from "react-router";
import { CheckCircle, Clock, AlertCircle, ArrowRight } from "lucide-react";
import type { Route } from "./+types/success";

function parseRef(ref: string): Record<string, string> {
    const result: Record<string, string> = {};
    const parts = ref.split(":");
    for (let i = 0; i < parts.length - 1; i += 2) {
        result[parts[i]] = parts[i + 1];
    }
    return result;
}

export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const collection_status = url.searchParams.get("collection_status");
    const paymentId = url.searchParams.get("payment_id");
    const externalRef = url.searchParams.get("external_reference") ?? "";

    const isApproved = status === "approved" || collection_status === "approved";
    const isPending = !isApproved && (status === "pending" || status === "in_process");

    // Provisionar directamente si pago aprobado — claim atómico para evitar race con webhook
    if (isApproved && externalRef.includes("pending:")) {
        try {
            const parsed = parseRef(externalRef);
            const pendingId = parsed["pending"];
            const planId = parsed["plan"] ?? "starter";
            const months = parseInt(parsed["months"] ?? "0", 10);

            if (pendingId) {
                const { supabaseAdmin } = await import("~/services/supabase.server");

                const TIMEZONE_MAP: Record<string, string> = {
                    MX: "America/Mexico_City", AR: "America/Argentina/Buenos_Aires",
                    CL: "America/Santiago", CO: "America/Bogota", PE: "America/Lima", otro: "UTC",
                };

                // Claim atómico: solo el primer proceso continúa
                const { data: reg } = await supabaseAdmin
                    .from("pending_registrations")
                    .update({ status: "processing" })
                    .eq("id", pendingId)
                    .eq("status", "pending")
                    .select("*")
                    .single();

                if (reg) {
                    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
                        email: reg.email,
                        password: reg.password_hash,
                        email_confirm: true,
                        user_metadata: { full_name: reg.owner_name, role: "admin" },
                    });

                    if (authErr || !authData.user) {
                        await supabaseAdmin.from("pending_registrations")
                            .update({ status: "pending" }).eq("id", pendingId);
                        throw new Error(authErr?.message ?? "createUser failed");
                    }

                    const userId = authData.user.id;
                    const slugBase = reg.studio_name.toLowerCase().trim()
                        .replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
                    let gymSlug = slugBase + "-" + Math.random().toString(36).substring(2, 7);
                    const { data: slugExists } = await supabaseAdmin.from("gyms").select("id").eq("slug", gymSlug).maybeSingle();
                    if (slugExists) gymSlug = slugBase + "-" + Math.random().toString(36).substring(2, 9);

                    const expiresAt = months > 0
                        ? new Date(Date.now() + months * 30 * 86400_000).toISOString()
                        : undefined;
                    const gymTimezone = TIMEZONE_MAP[reg.country_code] ?? "America/Mexico_City";
                    const currency = reg.country_code === "MX" ? "MXN" : "USD";

                    const { data: gymData, error: gymErr } = await supabaseAdmin.from("gyms").insert({
                        name: reg.studio_name, slug: gymSlug, owner_id: userId,
                        plan_id: planId, plan_status: "active",
                        tax_region: reg.country_code, country_code: reg.country_code,
                        city: reg.city, studio_type: reg.studio_type,
                        timezone: gymTimezone, currency,
                        features: { fiscal: true, fitcoins: true, qrAccess: true, waitlist: true },
                        primary_color: "#7c3aed", accent_color: "#2563eb",
                        metadata: { landingPageUpsell: reg.landing_page_upsell },
                        saas_mp_payment_id: paymentId,
                        ...(expiresAt ? { plan_expires_at: expiresAt } : {}),
                    }).select().single();

                    if (gymErr || !gymData) {
                        await supabaseAdmin.auth.admin.deleteUser(userId);
                        await supabaseAdmin.from("pending_registrations")
                            .update({ status: "pending" }).eq("id", pendingId);
                        throw new Error(gymErr?.message ?? "createGym failed");
                    }

                    await supabaseAdmin.from("profiles").upsert({
                        id: userId, email: reg.email, full_name: reg.owner_name,
                        phone: reg.phone, role: "admin", gym_id: gymData.id, credits: 0,
                    }, { onConflict: "id" });

                    await supabaseAdmin.from("pending_registrations")
                        .update({ status: "completed" }).eq("id", pendingId);

                    console.log("[Success] Provisionado:", userId, gymData.id);
                }
            }
        } catch (e: any) {
            console.error("[Success] Error provisionando:", e.message);
        }
    }

    return { isApproved, isPending, paymentId };
}

export default function OnboardingSuccess({ loaderData }: Route.ComponentProps) {
    const { isApproved, isPending } = loaderData;
    const [searchParams] = useSearchParams();
    const errorParam = searchParams.get("error");

    if (errorParam === "pago_fallido") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
                <div className="max-w-md w-full text-center space-y-6">
                    <div className="w-20 h-20 rounded-full bg-red-500/15 flex items-center justify-center mx-auto">
                        <AlertCircle className="w-10 h-10 text-red-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white">Pago no completado</h1>
                        <p className="text-white/50 text-sm mt-2">
                            Hubo un problema al procesar tu pago. Por favor intenta de nuevo.
                        </p>
                    </div>
                    <Link
                        to="/onboarding"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-500 transition-colors"
                    >
                        Intentar de nuevo <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        );
    }

    if (isPending) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
                <div className="max-w-md w-full text-center space-y-6">
                    <div className="w-20 h-20 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto">
                        <Clock className="w-10 h-10 text-amber-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white">Pago en proceso</h1>
                        <p className="text-white/50 text-sm mt-2">
                            Tu pago está siendo procesado (puede tardar unos minutos con OXXO o transferencia).
                            Una vez confirmado activaremos tu cuenta automáticamente.
                        </p>
                    </div>
                    <Link
                        to="/auth/login"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-500 transition-colors"
                    >
                        Ir a iniciar sesión <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        );
    }

    // Pago aprobado (trimestral/anual — MP redirige aquí con status=approved)
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="relative w-20 h-20 mx-auto">
                    <div className="w-20 h-20 rounded-full bg-violet-500/20 flex items-center justify-center">
                        <CheckCircle className="w-10 h-10 text-violet-400" />
                    </div>
                    <span className="absolute -top-1 -right-1 text-2xl">🎉</span>
                </div>

                <div>
                    <h1 className="text-3xl font-black text-white">¡Bienvenido a Grind!</h1>
                    <p className="text-white/50 text-sm mt-2">
                        Tu pago fue confirmado y tu plan está activo. Ya puedes iniciar sesión.
                    </p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left space-y-3">
                    <div className="flex items-center gap-2 text-sm text-white/70">
                        <span className="text-green-400">✓</span> Cuenta creada
                    </div>
                    <div className="flex items-center gap-2 text-sm text-white/70">
                        <span className="text-green-400">✓</span> Pago confirmado
                    </div>
                    <div className="flex items-center gap-2 text-sm text-white/70">
                        <span className="text-green-400">✓</span> Plan activado
                    </div>
                </div>

                <Link
                    to="/auth/login"
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-500 transition-colors"
                >
                    Iniciar sesión <ArrowRight className="w-4 h-4" />
                </Link>
            </div>
        </div>
    );
}
