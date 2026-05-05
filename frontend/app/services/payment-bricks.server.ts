// payment-bricks.server.ts
// Mercado Pago Checkout Bricks — pagos embebidos con tarjetas guardadas.
//
// Flujo:
//   1. getOrCreateMpCustomer()  → crea/recupera customer en MP y guarda mp_customer_id en profiles
//   2. processCardPayment()     → cobra con el token generado por CardPaymentBrick en el frontend
//   3. saveCardToCustomer()     → guarda la tarjeta del pago para futuros cobros (opt-in del usuario)
//   4. getCustomerCards()       → lista tarjetas guardadas para mostrar en el modal
//
// El token de tarjeta lo genera el SDK de MP en el browser (CardPaymentBrick).
// El número de tarjeta NUNCA toca este servidor — solo el token de un solo uso.

interface MpCustomer {
    id: string;
    email: string;
}

interface MpCard {
    id: string;
    last_four_digits: string;
    expiration_month: number;
    expiration_year: number;
    payment_method: { name: string };
    issuer: { name: string };
}

interface MpPaymentResult {
    id: number;
    status: "approved" | "in_process" | "rejected" | "pending";
    status_detail: string;
    transaction_amount: number;
    currency_id: string;
}

// ── Customers ──────────────────────────────────────────────────────────────

export async function getOrCreateMpCustomer(
    userId: string,
    email: string,
    name: string,
    mpAccessToken: string
): Promise<string> {
    const { supabaseAdmin } = await import("./supabase.server");

    // Si ya tiene customer_id guardado, usarlo directo
    const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("mp_customer_id")
        .eq("id", userId)
        .single();

    if (profile?.mp_customer_id) return profile.mp_customer_id;

    // Buscar si ya existe en MP por email
    const searchRes = await fetch(
        `https://api.mercadopago.com/v1/customers/search?email=${encodeURIComponent(email)}`,
        { headers: { Authorization: `Bearer ${mpAccessToken}` } }
    );
    const searchData = await searchRes.json();
    let customerId: string | null = searchData?.results?.[0]?.id ?? null;

    // Si no existe, crearlo
    if (!customerId) {
        const createRes = await fetch("https://api.mercadopago.com/v1/customers", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${mpAccessToken}`,
            },
            body: JSON.stringify({ email, first_name: name }),
        });
        if (!createRes.ok) {
            const err = await createRes.text();
            throw new Error(`Error al crear customer en MP: ${err}`);
        }
        const customer: MpCustomer = await createRes.json();
        customerId = customer.id;
    }

    // Guardar en el perfil del usuario
    await supabaseAdmin
        .from("profiles")
        .update({ mp_customer_id: customerId })
        .eq("id", userId);

    return customerId;
}

// ── Tarjetas guardadas ─────────────────────────────────────────────────────

export async function getCustomerCards(
    customerId: string,
    mpAccessToken: string
): Promise<MpCard[]> {
    const res = await fetch(
        `https://api.mercadopago.com/v1/customers/${customerId}/cards`,
        { headers: { Authorization: `Bearer ${mpAccessToken}` } }
    );
    if (!res.ok) return [];
    return res.json();
}

export async function saveCardToCustomer(
    cardToken: string,
    customerId: string,
    mpAccessToken: string
): Promise<MpCard> {
    const res = await fetch(
        `https://api.mercadopago.com/v1/customers/${customerId}/cards`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${mpAccessToken}`,
            },
            body: JSON.stringify({ token: cardToken }),
        }
    );
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Error al guardar tarjeta: ${err}`);
    }
    return res.json();
}

// ── Procesar pago ──────────────────────────────────────────────────────────

interface ProcessPaymentOptions {
    token: string;               // token generado por CardPaymentBrick
    amount: number;
    description: string;
    paymentMethodId: string;     // "visa", "master", etc. (viene del Brick)
    installments: number;        // cuotas
    customerId?: string;         // para asociar el pago al customer (tarjetas guardadas)
    savedCardId?: string;        // si el usuario elige tarjeta guardada
    issuerId?: string;
    email: string;
    externalReference?: string;
    mpAccessToken: string;
    currency?: string;
}

export async function processCardPayment(opts: ProcessPaymentOptions): Promise<MpPaymentResult> {
    const body: Record<string, unknown> = {
        transaction_amount: opts.amount,
        token: opts.token,
        description: opts.description,
        installments: opts.installments,
        payment_method_id: opts.paymentMethodId,
        payer: {
            email: opts.email,
            ...(opts.customerId ? { id: opts.customerId } : {}),
        },
        ...(opts.externalReference ? { external_reference: opts.externalReference } : {}),
        ...(opts.currency ? { currency_id: opts.currency } : {}),
        ...(opts.issuerId ? { issuer_id: opts.issuerId } : {}),
    };

    const res = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Idempotency-Key": `${opts.externalReference ?? ""}-${Date.now()}`,
            Authorization: `Bearer ${opts.mpAccessToken}`,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Error al procesar pago: ${err}`);
    }

    return res.json();
}
