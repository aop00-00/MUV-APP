// app/types/database.ts
// ─── Domain types for the GrindProject gym management platform ───
// Expanded for SaaS multi-tenant: subscriptions, gamification, access control, CRM.

// ─── Roles ───────────────────────────────────────────────────────
export type UserRole = "admin" | "member" | "coach";

// ─── Profile ─────────────────────────────────────────────────────
export interface Profile {
    id: string; // uuid — matches auth.users.id
    email: string;
    full_name: string;
    role: UserRole;
    avatar_url: string | null;
    credits: number; // class credits remaining
    phone: string | null;
    gym_id: string; // The tenant this profile belongs to
    created_at: string;
    updated_at: string;
}

// ─── Memberships ─────────────────────────────────────────────────
export type MembershipStatus = "active" | "expired" | "cancelled";

export interface Membership {
    id: string;
    user_id: string;
    plan_name: string; // e.g. "Plan Básico", "Plan Premium"
    status: MembershipStatus;
    price: number;
    credits_included: number;
    start_date: string;
    end_date: string;
    created_at: string;
}

// ─── Classes / Schedule ──────────────────────────────────────────
export interface ClassSchedule {
    id: string;
    title: string; // e.g. "CrossFit", "Yoga", "Spinning"
    description: string | null;
    coach_id: string; // FK → profiles.id
    capacity: number;
    start_time: string; // ISO datetime
    end_time: string;
    location: string | null;
    created_at: string;
}

// ─── Bookings ────────────────────────────────────────────────────
export type BookingStatus = "confirmed" | "cancelled" | "completed";

export interface Booking {
    id: string;
    user_id: string;
    class_id: string;
    status: BookingStatus;
    created_at: string;
    updated_at: string;
}

// ─── Products (Store / POS) ──────────────────────────────────────
export type ProductCategory = "beverage" | "supplement" | "merch" | "package";

export interface Product {
    id: string;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
    category: ProductCategory;
    stock: number;
    is_active: boolean;
    created_at: string;
}

// ─── Orders ──────────────────────────────────────────────────────
export type OrderStatus = "pending" | "paid" | "failed" | "refunded";
export type PaymentMethod = "mercado_pago" | "cash" | "card";

export interface OrderItem {
    id: string;
    order_id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
}

export interface Order {
    id: string;
    user_id: string;
    status: OrderStatus;
    payment_method: PaymentMethod;
    total: number;
    mp_preference_id: string | null; // Mercado Pago preference ID
    mp_payment_id: string | null; // Mercado Pago payment ID
    items: OrderItem[];
    created_at: string;
    updated_at: string;
}

// ─── Subscriptions ────────────────────────────────────────────────────────────
export type BillingCycle = "monthly" | "quarterly" | "annual";
export type SubscriptionStatus = "active" | "frozen" | "expired" | "cancelled";

export interface Subscription {
    id: string;
    user_id: string;
    plan_id?: string;
    plan_name: string;
    billing_cycle?: BillingCycle;
    status: SubscriptionStatus;
    price?: number;              // DB column name
    price_per_cycle?: number;    // alias used in some UI code
    credits_included?: number;   // DB column name
    credits_per_cycle?: number;  // alias
    start_date: string;
    end_date: string;
    freeze_until?: string | null;
    auto_renew?: boolean;
    tax_region?: "MX" | "AR" | "CL";
    gym_id?: string;
    created_at: string;
    updated_at?: string;
    // Joined fields
    user?: { full_name: string; email: string; phone: string | null; avatar_url: string | null };
}

export interface SubscriptionPlan {
    id: string;
    name: string;
    description?: string;
    billing_cycle?: BillingCycle;
    billing?: string;   // alias used by PLAN_CATALOG
    price: number;
    credits?: number;           // PLAN_CATALOG alias
    credits_included?: number;
    features?: string[];
    is_popular?: boolean;
    color?: string;             // for UI color coding
}

// ─── FitCoins (Gamification) ──────────────────────────────────────────────────
export type FitCoinSource =
    | "attendance"      // +10 per class attended
    | "referral"        // +100 per converted referral
    | "purchase"        // +5 per $ spent in store
    | "streak_bonus"    // +50 for 7-day streak
    | "redemption"      // negative – used for rewards
    | "bonus"           // generic bonus
    | "admin_grant";    // manual adjustment by admin

export interface FitCoin {
    id: string;
    user_id: string;
    amount: number;               // Positive = earned, negative = redeemed
    source: FitCoinSource;
    balance_after: number;        // Running total after this tx
    description: string;          // Human-readable label
    reference_id: string | null;  // booking_id, order_id, referral_id, etc.
    created_at: string;
}

export interface FitCoinReward {
    id: string;
    name: string;
    description: string;
    cost: number;                 // Points required
    category?: "discount" | "merch" | "access" | "experience";
    icon?: string;                // Emoji for display
    available?: boolean;          // Alias for is_available
    is_available?: boolean;
}

// ─── Waitlist ─────────────────────────────────────────────────────────────────
export interface WaitlistEntry {
    id: string;
    user_id: string;
    class_id: string;
    position: number;             // 1 = next to be promoted
    notified_at: string | null;   // When promotion notification was sent
    created_at: string;
}

// ─── Fiscal / Invoicing ───────────────────────────────────────────────────────
export type TaxRegion = "MX" | "AR" | "CL";
export type InvoiceStatus = "pending" | "issued" | "cancelled" | "error";

export interface InvoiceRecord {
    id: string;
    order_id: string;
    user_id: string;
    tax_region: TaxRegion;
    status: InvoiceStatus;
    cfdi_uuid: string | null;     // MX: UUID del CFDI 4.0
    afip_cae: string | null;      // AR: CAE de AFIP
    sii_folio: string | null;     // CL: Folio SII
    subtotal: number;
    tax_amount: number;
    total: number;
    pdf_url: string | null;
    xml_url: string | null;
    issued_at: string | null;
    created_at: string;
}

// ─── Access Control (QR) ─────────────────────────────────────────────────────
export type AccessType = "entry" | "exit";

export interface AccessLog {
    id: string;
    user_id: string;
    access_type: AccessType;
    qr_token: string | null;     // Token scanned
    validated: boolean;
    created_at: string;
}

export interface QRAccessToken {
    qrUrl: string;
    token: string;
    expiresAt: string;           // ISO datetime
}

// ─── CRM – Leads ──────────────────────────────────────────────────────────────
export type LeadStage =
    | "new"          // just captured, no contact
    | "contacted"    // first outreach done
    | "trial"        // doing free trial class
    | "converted"    // became paying member
    | "lost";        // decided not to join

export type LeadSource =
    | "instagram"
    | "referral"
    | "web"
    | "walk_in"
    | "facebook"
    | "google";

export interface Lead {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    source: LeadSource;
    stage: LeadStage;
    notes: string | null;
    assigned_to: string | null;  // profiles.id of sales rep
    gym_id: string;              // multi-tenant FK
    days_in_stage: number;
    created_at: string;
    updated_at: string;
}
