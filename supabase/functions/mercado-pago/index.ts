// supabase/functions/mercado-pago/index.ts
// Webhook de Mercado Pago — reemplaza n8n por completo.
//
// Cubre dos flujos:
//   SaaS  — gym owner paga un plan de software → activa gyms.plan_status
//   Tenant — miembro compra producto/membresía  → marca order como paid + FitCoins
//
// Env vars requeridas en Supabase Dashboard → Edge Functions → Secrets:
//   MERCADO_PAGO_WEBHOOK_SECRET   — clave HMAC que MP usa para firmar (opcional en dev)
//   MERCADO_PAGO_ACCESS_TOKEN_SAAS — token de tu cuenta concentradora (Flow SaaS)
//   SUPABASE_URL                  — inyectada automáticamente por Supabase
//   SUPABASE_SERVICE_ROLE_KEY     — inyectada automáticamente por Supabase

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ─── HMAC verification ────────────────────────────────────────────────────
async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
    const secret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET");
    if (!secret) return true; // en dev sin secret se omite la verificación

    const xSignature = req.headers.get("x-signature") ?? "";
    const xRequestId = req.headers.get("x-request-id") ?? "";

    // Extraer ts y v1 del header x-signature: "ts=...,v1=..."
    const parts = Object.fromEntries(
        xSignature.split(",").map(p => p.split("=").map(s => s.trim()) as [string, string])
    );
    const ts = parts["ts"];
    const v1 = parts["v1"];
    if (!ts || !v1) return false;

    // El dataId viene en el body como notification.data.id
    let dataId = "";
    try {
        const body = JSON.parse(rawBody);
        dataId = body?.data?.id ?? "";
    } catch {
        return false;
    }

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const keyData = new TextEncoder().encode(secret);
    const msgData = new TextEncoder().encode(manifest);

    const cryptoKey = await crypto.subtle.importKey(
        "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
    const computed = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

    return computed === v1;
}

// ─── Fetch payment details from MP ───────────────────────────────────────
async function fetchPayment(paymentId: string, accessToken: string) {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`MP payment fetch failed: ${res.status}`);
    return res.json();
}

// ─── Fetch preapproval details from MP ───────────────────────────────────
async function fetchPreapproval(preapprovalId: string, accessToken: string) {
    const res = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`MP preapproval fetch failed: ${res.status}`);
    return res.json();
}

// ─── Tabla de precios SaaS — fuente única de verdad ──────────────────────
// Debe mantenerse sincronizada con payment.server.ts (SAAS_PLAN_PRICES).
const SAAS_PLAN_PRICES: Record<string, Record<string, number>> = {
    starter: { monthly: 999,  quarterly: 2697,  annual: 9588  },
    pro:     { monthly: 2099, quarterly: 5667,  annual: 20148 },
    elite:   { monthly: 3499, quarterly: 9447,  annual: 33588 },
};

function getExpectedSaasPrice(planId: string, cycle: string): number | null {
    return SAAS_PLAN_PRICES[planId]?.[cycle] ?? null;
}

// ─── Parse external_reference ────────────────────────────────────────────
// Formatos soportados:
//   ONBOARDING pago único:   flow:saas:plan:{cycle}:pending:{id}:plan:{planId}:months:{n}
//   ONBOARDING suscripción:  flow:saas:sub:monthly:pending:{id}:plan:{planId}
//   UPGRADE (nuevo):         flow:saas:upgrade:gym:{gymId}:plan:{planId}:cycle:{cycle}
//   LEGACY onboarding:       flow:saas:plan:{cycle}:user:{userId}:gym:{gymId}:plan:{planId}:months:{n}
//   LEGACY suscripción:      flow:saas:sub:monthly:user:{userId}:gym:{gymId}:plan:{planId}
//   TENANT:                  flow:tenant:order:pending:user:{userId}:gym:{gymId}
//   STORE:                   store:gym:{gymId}:user:{userId}
function parseRef(ref: string) {
    const result: Record<string, string> = {};
    const parts = ref.split(":");
    for (let i = 0; i < parts.length - 1; i += 2) {
        result[parts[i]] = parts[i + 1];
    }
    if (ref.startsWith("flow:saas")) result["flowType"] = "saas";
    else if (ref.startsWith("flow:tenant")) result["flowType"] = "tenant";
    else if (ref.startsWith("store:")) result["flowType"] = "tenant";

    // Detectar subtipo de flujo SaaS
    if (ref.startsWith("flow:saas:upgrade:")) result["saasSubtype"] = "upgrade";
    else if (ref.startsWith("flow:saas:sub:monthly:")) result["saasSubtype"] = "subscription";
    else if (ref.startsWith("flow:saas:plan:")) result["saasSubtype"] = "onetime";

    return result;
}

// ─── Crear user + gym desde pending_registration ─────────────────────────
async function provisionFromPending(pendingId: string, planStatus: string, extraGymFields: Record<string, unknown> = {}) {
    // Claim atómico: solo el primer proceso que cambie status a "processing" continúa
    const { data: reg, error: regErr } = await supabase
        .from("pending_registrations")
        .update({ status: "processing" })
        .eq("id", pendingId)
        .eq("status", "pending")
        .select("*")
        .single();

    if (regErr || !reg) {
        console.log("pending_registration ya procesado o no encontrado:", pendingId);
        return null;
    }

    // Crear usuario en Auth
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: reg.email,
        password: reg.password_hash,
        email_confirm: true,
        user_metadata: { full_name: reg.owner_name, role: "admin" },
    });

    if (authError || !authData.user) {
        console.error("Error creando usuario desde pending:", authError);
        return null;
    }

    const userId = authData.user.id;

    // Generar slug
    const slug = reg.studio_name.toLowerCase().trim()
        .replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "")
        + "-" + Math.random().toString(36).substring(2, 6);

    const { data: gymData, error: gymError } = await supabase
        .from("gyms")
        .insert({
            name: reg.studio_name,
            slug,
            owner_id: userId,
            plan_id: reg.plan_id,
            plan_status: planStatus,
            tax_region: reg.country_code,
            country_code: reg.country_code,
            city: reg.city,
            studio_type: reg.studio_type,
            timezone: "America/Mexico_City",
            currency: reg.country_code === "MX" ? "MXN" : "USD",
            features: { fiscal: true, fitcoins: true, qrAccess: true, waitlist: true },
            primary_color: "#7c3aed",
            accent_color: "#2563eb",
            metadata: { landingPageUpsell: reg.landing_page_upsell },
            ...extraGymFields,
        })
        .select()
        .single();

    if (gymError) {
        console.error("Error creando gym desde pending:", gymError);
        await adminClient.auth.admin.deleteUser(userId);
        // Revertir claim para que pueda reintentarse
        await supabase.from("pending_registrations")
            .update({ status: "pending" })
            .eq("id", pendingId);
        return null;
    }

    await supabase.from("profiles").upsert({
        id: userId,
        email: reg.email,
        full_name: reg.owner_name,
        phone: reg.phone,
        role: "admin",
        gym_id: gymData.id,
        credits: 0,
    }, { onConflict: "id" });

    await supabase.from("pending_registrations")
        .update({ status: "completed" })
        .eq("id", pendingId);

    console.log(`Provisioned gym ${gymData.id} (slug: ${slug}) for user ${userId} from pending ${pendingId}`);
    return { userId, gymId: gymData.id, slug };
}

// ─── SaaS flow: upgrade de plan para gym existente ───────────────────────
// external_reference: flow:saas:upgrade:gym:{gymId}:plan:{planId}:cycle:{cycle}
async function handleSaasUpgrade(parsed: Record<string, string>, paymentId: string, paidAmount: number) {
    const gymId = parsed["gym"];
    const planId = parsed["plan"];
    const cycle = parsed["cycle"] ?? "monthly";

    if (!gymId || !planId) {
        console.error("SaaS upgrade: gymId o planId ausente", parsed);
        return;
    }

    // Validar que el monto pagado corresponde al plan+ciclo declarado
    const expectedPrice = getExpectedSaasPrice(planId, cycle);
    if (expectedPrice === null) {
        console.error(`FRAUD_OR_CONFIG_ERROR: plan/ciclo desconocido en upgrade`, { planId, cycle, paidAmount });
        return;
    }
    if (Math.abs(paidAmount - expectedPrice) > 1) {
        console.error(`FRAUD_ATTEMPT: monto incorrecto en upgrade`, { planId, cycle, expected: expectedPrice, got: paidAmount, gymId });
        return;
    }

    const monthsMap: Record<string, number> = { monthly: 1, quarterly: 3, annual: 12 };
    const months = monthsMap[cycle] ?? 1;
    const expiresAt = months > 1 ? (() => {
        const d = new Date(); d.setMonth(d.getMonth() + months); return d.toISOString();
    })() : undefined;

    const { error } = await supabase.from("gyms").update({
        plan_id: planId,
        plan_status: "active",
        saas_mp_payment_id: paymentId,
        updated_at: new Date().toISOString(),
        ...(expiresAt ? { plan_expires_at: expiresAt } : { plan_expires_at: null }),
    }).eq("id", gymId);

    if (error) throw new Error(`Error en upgrade: ${error.message}`);
    console.log(`Upgrade completado: gym ${gymId} → plan ${planId} (${cycle}), pagado $${paidAmount}`);
}

// ─── SaaS flow: pago único (trimestral/anual) ─────────────────────────────
async function handleSaasPayment(parsed: Record<string, string>, paymentId: string, paidAmount: number) {
    const pendingId = parsed["pending"];
    const planId = parsed["plan"] ?? "starter";
    const months = parseInt(parsed["months"] ?? "0", 10);
    const cycle = months === 12 ? "annual" : months === 3 ? "quarterly" : "monthly";

    // Validar monto pagado vs precio esperado para el plan+ciclo
    const expectedPrice = getExpectedSaasPrice(planId, cycle);
    if (expectedPrice !== null && Math.abs(paidAmount - expectedPrice) > 1) {
        console.error(`FRAUD_ATTEMPT: monto incorrecto en onetime`, { planId, cycle, expected: expectedPrice, got: paidAmount, pendingId });
        return;
    }

    const expiresAt = months > 0 ? (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + months);
        return d.toISOString();
    })() : undefined;

    // Nuevo flujo: pending_registration → provisionar user+gym
    if (pendingId) {
        const result = await provisionFromPending(pendingId, "active", {
            saas_mp_payment_id: paymentId,
            ...(expiresAt ? { plan_expires_at: expiresAt } : {}),
        });
        if (!result) console.error("handleSaasPayment: provisioning falló para pending", pendingId);
        else console.log(`Plan ${planId} activado para gym ${result.gymId} — expira en ${months} meses`);
        return;
    }

    // Legacy: gymId directo en external_reference
    const gymId = parsed["gym"];
    if (!gymId) { console.error("SaaS webhook: gymId y pendingId ambos ausentes", parsed); return; }

    const update: Record<string, unknown> = {
        plan_id: planId, plan_status: "active",
        saas_mp_payment_id: paymentId, updated_at: new Date().toISOString(),
        ...(expiresAt ? { plan_expires_at: expiresAt } : {}),
    };
    const { error } = await supabase.from("gyms").update(update).eq("id", gymId);
    if (error) throw new Error(`Error activando plan: ${error.message}`);
    console.log(`Plan ${planId} activado (legacy) para gym ${gymId}`);
}

// ─── SaaS flow: preapproval autorizado (suscripción mensual) ─────────────
async function handleSaasPreapproval(preapprovalId: string, accessToken: string) {
    const preapproval = await fetchPreapproval(preapprovalId, accessToken);
    const externalRef: string = preapproval.external_reference ?? "";
    const parsed = parseRef(externalRef);

    const pendingId = parsed["pending"];
    const planId = parsed["plan"] ?? "starter";
    const isStarter = planId === "starter";

    // Validar monto de la suscripción mensual contra el precio esperado
    const paidAmount: number = preapproval.auto_recurring?.transaction_amount ?? 0;
    const expectedPrice = getExpectedSaasPrice(planId, "monthly");
    if (expectedPrice !== null && paidAmount > 0 && Math.abs(paidAmount - expectedPrice) > 1) {
        console.error(`FRAUD_ATTEMPT: monto incorrecto en preapproval`, { planId, expected: expectedPrice, got: paidAmount, preapprovalId });
        return;
    }

    // Nuevo flujo: pending_registration → provisionar user+gym
    if (pendingId) {
        const trialEnds = isStarter ? (() => {
            const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString();
        })() : undefined;

        const result = await provisionFromPending(
            pendingId,
            isStarter ? "trial" : "active",
            {
                saas_mp_preapproval_id: preapprovalId,
                ...(trialEnds ? { trial_ends_at: trialEnds } : {}),
            }
        );
        if (!result) console.error("handleSaasPreapproval: provisioning falló para pending", pendingId);
        else console.log(`Preapproval ${preapprovalId} procesado — gym ${result.gymId}, status ${isStarter ? "trial" : "active"}`);
        return;
    }

    // Legacy: gymId directo
    const gymId = parsed["gym"];
    if (!gymId) { console.error("SaaS preapproval: gymId y pendingId ambos ausentes", parsed); return; }

    const { data: gym } = await supabase.from("gyms").select("plan_status").eq("id", gymId).single();
    const newStatus = isStarter ? (gym?.plan_status ?? "trial") : "active";
    const { error } = await supabase.from("gyms").update({
        plan_id: planId, plan_status: newStatus,
        saas_mp_preapproval_id: preapprovalId, updated_at: new Date().toISOString(),
    }).eq("id", gymId);
    if (error) throw new Error(`Error actualizando preapproval: ${error.message}`);
    console.log(`Preapproval ${preapprovalId} (legacy) procesado para gym ${gymId} — status ${newStatus}`);
}

// ─── SaaS flow: cobro autorizado de suscripción (pago mensual confirmado) ─
async function handleSaasSubscriptionPayment(preapprovalId: string, paymentId: string, planId: string) {
    // Buscar gym por saas_mp_preapproval_id (nuevo flujo) o gymId (legacy)
    const { data: gym, error: gymLookupErr } = await supabase
        .from("gyms")
        .select("id")
        .eq("saas_mp_preapproval_id", preapprovalId)
        .maybeSingle();

    if (gymLookupErr || !gym) {
        console.error("SaaS subscription payment: gym no encontrado para preapproval", preapprovalId);
        return;
    }

    const { error } = await supabase
        .from("gyms")
        .update({
            plan_id: planId, plan_status: "active",
            trial_ends_at: null, saas_mp_payment_id: paymentId,
            updated_at: new Date().toISOString(),
        })
        .eq("id", gym.id);

    if (error) throw new Error(`Error en subscription payment: ${error.message}`);
    console.log(`Subscription payment ${paymentId} confirmado para gym ${gym.id}`);
}

// ─── Tenant flow: marcar orden como pagada ────────────────────────────────
async function handleTenantPayment(
    parsed: Record<string, string>,
    paymentId: string,
    amount: number
) {
    const userId = parsed["user"];
    const gymId = parsed["gym"];

    if (!userId || !gymId) {
        console.error("Tenant webhook: userId o gymId missing", parsed);
        return;
    }

    // Actualizar orden pendiente → pagada
    const { data: order, error: orderError } = await supabase
        .from("orders")
        .update({
            status: "paid",
            mp_payment_id: paymentId,
            updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("gym_id", gymId)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

    if (orderError) {
        console.error("Error actualizando orden:", orderError.message);
    }

    // Otorgar FitCoins: 1 por cada $10 MXN
    const coins = Math.floor(amount / 10);
    if (coins > 0) {
        const { error: coinError } = await supabase.from("fitcoins").insert({
            user_id: userId,
            gym_id: gymId,
            amount: coins,
            source: "purchase",
            description: `Pago MP confirmado $${amount}`,
            reference_id: order?.id ?? paymentId,
        });
        if (coinError) {
            console.error("Error otorgando FitCoins:", coinError.message);
        }
    }

    console.log(`Tenant pago confirmado — user ${userId}, gym ${gymId}, $${amount}`);
}

// ─── Handler principal ────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    const rawBody = await req.text();

    // Verificar firma HMAC
    const valid = await verifySignature(req, rawBody);
    if (!valid) {
        console.warn("Firma HMAC inválida — request rechazado");
        return new Response("Unauthorized", { status: 401 });
    }

    let notification: any;
    try {
        notification = JSON.parse(rawBody);
    } catch {
        return new Response("Bad request", { status: 400 });
    }

    const eventType: string = notification.type ?? "";
    const resourceId = String(notification.data?.id ?? "");

    if (!resourceId) {
        return new Response("OK", { status: 200 });
    }

    try {
        const saasToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN_SAAS");
        if (!saasToken) throw new Error("MERCADO_PAGO_ACCESS_TOKEN_SAAS no configurado");

        // ── Suscripción mensual: preapproval autorizado ───────────────────
        if (eventType === "subscription_preapproval") {
            await handleSaasPreapproval(resourceId, saasToken);
            return new Response("OK", { status: 200 });
        }

        // ── Cobro mensual confirmado de suscripción ───────────────────────
        // data.id en este evento es el authorized_payment_id, no un payment_id
        if (eventType === "subscription_authorized_payment") {
            const authRes = await fetch(`https://api.mercadopago.com/authorized_payments/${resourceId}`, {
                headers: { Authorization: `Bearer ${saasToken}` },
            });
            if (!authRes.ok) {
                console.error(`Error fetching authorized_payment ${resourceId}: ${authRes.status}`);
                return new Response("OK", { status: 200 });
            }
            const authPayment = await authRes.json();
            if (authPayment.status !== "approved") {
                console.log(`Authorized payment ${resourceId} no aprobado: ${authPayment.status}`);
                return new Response("OK", { status: 200 });
            }
            // Obtener preapproval_id para extraer external_reference
            const preapprovalId: string = authPayment.preapproval_id ?? "";
            if (preapprovalId) {
                const preapproval = await fetchPreapproval(preapprovalId, saasToken);
                const parsed = parseRef(preapproval.external_reference ?? "");
                if (parsed["flow"] === "saas" && parsed["sub"] === "monthly") {
                    const planId = parsed["plan"] ?? "starter";
                    await handleSaasSubscriptionPayment(preapprovalId, resourceId, planId);
                }
            }
            return new Response("OK", { status: 200 });
        }

        // ── Pago único (trimestral/anual + tenant) ────────────────────────
        if (eventType === "payment") {
            const payment = await fetchPayment(resourceId, saasToken);

            if (payment.status !== "approved") {
                console.log(`Pago ${resourceId} no aprobado: ${payment.status}`);
                return new Response("OK", { status: 200 });
            }

            const externalRef: string = payment.external_reference ?? "";
            const amount: number = payment.transaction_amount ?? 0;
            const parsed = parseRef(externalRef);

            if (parsed["flowType"] === "saas") {
                if (parsed["saasSubtype"] === "upgrade") {
                    await handleSaasUpgrade(parsed, resourceId, amount);
                } else {
                    await handleSaasPayment(parsed, resourceId, amount);
                }
            } else if (parsed["flowType"] === "tenant") {
                await handleTenantPayment(parsed, resourceId, amount);
            } else {
                console.warn("external_reference no reconocido:", externalRef);
            }
        }

        return new Response("OK", { status: 200 });
    } catch (err: any) {
        console.error("Error procesando webhook:", err.message);
        // Devolver 200 para que MP no reintente — loguear el error internamente
        return new Response("OK", { status: 200 });
    }
});
