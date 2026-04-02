// app/routes/onboarding/setup/identity.tsx
// Step 3: Brand Identity — Studio name, country, city, phone, brand color

import { useState, useEffect } from "react";
import { useFetcher, Link, useNavigate, useRouteLoaderData } from "react-router";
import { ArrowRight, ArrowLeft, MapPin } from "lucide-react";
import type { Route } from "./+types/identity";

// ─── Server Action ───────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requireGymAdmin(request);

    const formData = await request.formData();
    const name = (formData.get("name") as string || "").trim();
    const country = formData.get("country") as string;
    const city = (formData.get("city") as string || "").trim();
    const phone = (formData.get("phone") as string || "").trim();
    const brandColor = formData.get("brand_color") as string;

    if (!name || name.length < 2) {
        return { success: false, error: "El nombre debe tener al menos 2 caracteres" };
    }
    if (!country) {
        return { success: false, error: "Selecciona un país" };
    }

    // Derive timezone from country
    const timezoneMap: Record<string, string> = {
        MX: "America/Mexico_City",
        CO: "America/Bogota",
        AR: "America/Argentina/Buenos_Aires",
        CL: "America/Santiago",
        PE: "America/Lima",
    };

    const { error } = await supabaseAdmin
        .from("gyms")
        .update({
            name,
            country,
            country_code: country,   // keep legacy field in sync
            city: city || null,
            phone: phone || null,
            timezone: timezoneMap[country] || "America/Mexico_City",
            brand_color: brandColor || null,
            primary_color: brandColor || "#7c3aed",
            onboarding_step: 3,
        })
        .eq("id", gymId);

    if (error) {
        console.error("[onboarding/identity] Failed to save:", error);
        return { success: false, error: "Error al guardar. Intenta de nuevo." };
    }

    return { success: true };
}

// ─── Country & Color Definitions ─────────────────────────────────────────────

const COUNTRIES = [
    { code: "MX", name: "México", flag: "🇲🇽" },
    { code: "CO", name: "Colombia", flag: "🇨🇴" },
    { code: "AR", name: "Argentina", flag: "🇦🇷" },
    { code: "CL", name: "Chile", flag: "🇨🇱" },
    { code: "PE", name: "Perú", flag: "🇵🇪" },
];

const BRAND_COLORS = [
    { id: "dark", hex: "#1a1a2e", label: "Oscuro" },
    { id: "forest", hex: "#1b4332", label: "Forest" },
    { id: "navy", hex: "#1e3a5f", label: "Navy" },
    { id: "wine", hex: "#722f37", label: "Vino" },
    { id: "terracotta", hex: "#c2703e", label: "Terracotta" },
    { id: "sage", hex: "#6b8f71", label: "Sage" },
    { id: "arena", hex: "#c9b99a", label: "Arena" },
    { id: "blush", hex: "#c97b84", label: "Blush" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function StepIdentity() {
    const fetcher = useFetcher<typeof action>();
    const navigate = useNavigate();
    const parentData = useRouteLoaderData("routes/onboarding/setup/layout") as any;

    const [name, setName] = useState(parentData?.gymInfo?.name || "");
    const [country, setCountry] = useState(parentData?.gymInfo?.country_code || "");
    const [city, setCity] = useState(parentData?.gymInfo?.city || "");
    const [phone, setPhone] = useState(parentData?.profile?.phone || "");
    const [brandColor, setBrandColor] = useState("#7c3aed");

    const isSubmitting = fetcher.state !== "idle";
    const canAdvance = name.trim().length >= 2 && country;

    // Navigate on success
    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data?.success) {
            navigate("/onboarding/setup/room");
        }
    }, [fetcher.state, fetcher.data, navigate]);

    function handleSubmit() {
        if (!canAdvance) return;
        const fd = new FormData();
        fd.set("name", name);
        fd.set("country", country);
        fd.set("city", city);
        fd.set("phone", phone);
        fd.set("brand_color", brandColor);
        fetcher.submit(fd, { method: "post" });
    }

    // Get studio type for dynamic placeholder
    const studioType = parentData?.progress?.studio_type;
    const placeholderMap: Record<string, string> = {
        pilates: "Ej: Core Pilates Studio",
        cycling: "Ej: Velocity Cycling CDMX",
        yoga: "Ej: Shanti Yoga Studio",
        barre: "Ej: Barre & Balance",
        hiit: "Ej: Iron Box Gym",
        martial: "Ej: Fight Club MMA",
        dance: "Ej: Urban Dance Academy",
    };
    const namePlaceholder = placeholderMap[studioType || ""] || "Ej: Mi Estudio Fitness";

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Title */}
            <div className="text-center">
                <h1 className="text-3xl md:text-4xl font-black text-white mb-3">
                    Identidad de tu estudio
                </h1>
                <p className="text-white/50">
                    Tus alumnos verán esta información al registrarse
                </p>
            </div>

            {/* Form */}
            <div className="space-y-6">
                {/* Studio Name */}
                <div>
                    <label className="block text-sm font-bold text-white/70 mb-2">
                        Nombre del estudio <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={namePlaceholder}
                        className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/25 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25 focus:outline-none transition-all"
                    />
                </div>

                {/* Country */}
                <div>
                    <label className="block text-sm font-bold text-white/70 mb-2">
                        País <span className="text-red-400">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {COUNTRIES.map((c) => (
                            <button
                                key={c.code}
                                onClick={() => setCountry(c.code)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all text-sm font-medium ${
                                    country === c.code
                                        ? "border-violet-500 bg-violet-500/15 text-white"
                                        : "border-white/[0.08] bg-white/[0.03] text-white/60 hover:border-white/20"
                                }`}
                            >
                                <span className="text-lg">{c.flag}</span>
                                {c.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* City + Phone (2 columns on desktop) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-white/70 mb-2">Ciudad</label>
                        <input
                            type="text"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="Ej: Ciudad de México"
                            className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/25 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25 focus:outline-none transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-white/70 mb-2">WhatsApp</label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+52 55 1234 5678"
                            className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/25 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25 focus:outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Brand Color */}
                <div>
                    <label className="block text-sm font-bold text-white/70 mb-2">Color de marca</label>
                    <div className="flex flex-wrap gap-3">
                        {BRAND_COLORS.map((c) => (
                            <button
                                key={c.id}
                                onClick={() => setBrandColor(c.hex)}
                                title={c.label}
                                className={`w-10 h-10 rounded-lg transition-all duration-200 ${
                                    brandColor === c.hex
                                        ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110"
                                        : "hover:scale-105"
                                }`}
                                style={{ backgroundColor: c.hex }}
                            />
                        ))}
                    </div>
                </div>

                {/* Live Preview */}
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-5">
                    <p className="text-[10px] uppercase tracking-wider text-white/30 font-bold mb-3">
                        Vista previa
                    </p>
                    <div className="flex items-center gap-4">
                        {/* Logo placeholder */}
                        <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-xl shrink-0"
                            style={{ backgroundColor: brandColor }}
                        >
                            {name ? name.charAt(0).toUpperCase() : "E"}
                        </div>
                        <div className="min-w-0">
                            <p className="text-white font-bold truncate">
                                {name || "Mi Estudio"}
                            </p>
                            <p className="text-xs text-white/40 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {city || "Ciudad"}, {COUNTRIES.find(c => c.code === country)?.name || "País"}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error message */}
            {fetcher.data && !fetcher.data.success && fetcher.data.error && (
                <p className="text-sm text-red-400 text-center">{fetcher.data.error}</p>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4">
                <Link
                    to="/onboarding/setup/studio-type"
                    className="inline-flex items-center gap-2 text-white/50 hover:text-white font-medium text-sm transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Atrás
                </Link>

                <button
                    onClick={handleSubmit}
                    disabled={!canAdvance || isSubmitting}
                    className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed text-white font-bold px-6 py-3 rounded-xl transition-all duration-200"
                >
                    {isSubmitting ? "Guardando..." : "Siguiente"}
                    <ArrowRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
