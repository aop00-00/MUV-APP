// admin/landing.tsx — Editor de la web pública del gym

import { useFetcher } from "react-router";
import { useState } from "react";
import { Globe, Eye, Check, Info, AlertCircle, CheckCircle2, Clock, X } from "lucide-react";
import type { Route } from "./+types/landing";

const SECTIONS_OPTIONS = [
    { id: "hero", label: "Hero (portada)" },
    { id: "classes", label: "Disciplinas / Clases" },
    { id: "schedule", label: "Horario próximo" },
    { id: "coaches", label: "Coaches" },
    { id: "pricing", label: "Planes y precios" },
    { id: "cta", label: "Call to action final" },
];

// ─── Loader ──────────────────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requireGymAdmin(request);

    const { data: gym } = await supabaseAdmin
        .from("gyms")
        .select(`
            name, slug, logo_url, primary_color,
            tagline, description, phone, email, address, city,
            maps_url, instagram_url, facebook_url, whatsapp_url,
            hero_image_url, landing_sections, custom_domain
        `)
        .eq("id", gymId)
        .single();

    const appDomain = process.env.APP_DOMAIN || "grindproject.com";
    const customDomain = gym?.custom_domain || "";

    // Check Vercel domain verification status if a custom domain is set
    let domainStatus: { verified: boolean; configured: boolean; cname?: string; aRecords?: string[]; error?: string } | null = null;
    if (customDomain) {
        try {
            const { getDomainStatus } = await import("~/services/vercel-domains.server");
            domainStatus = await getDomainStatus(customDomain);
        } catch {
            // Vercel env vars not configured — skip status check
        }
    }

    return {
        gym: {
            name: gym?.name || "",
            slug: gym?.slug || "",
            logoUrl: gym?.logo_url || "",
            primaryColor: gym?.primary_color || "#7c3aed",
            tagline: gym?.tagline || "",
            description: gym?.description || "",
            phone: gym?.phone || "",
            email: gym?.email || "",
            address: gym?.address || "",
            city: gym?.city || "",
            mapsUrl: gym?.maps_url || "",
            instagramUrl: gym?.instagram_url || "",
            facebookUrl: gym?.facebook_url || "",
            whatsappUrl: gym?.whatsapp_url || "",
            heroImageUrl: gym?.hero_image_url || "",
            landingSections: (gym?.landing_sections as string[]) ?? ["hero", "classes", "schedule", "coaches", "pricing", "cta"],
            customDomain,
        },
        appDomain,
        domainStatus,
    };
}

// ─── Action ──────────────────────────────────────────────────────
export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "save") {
        const sections = formData.getAll("sections") as string[];

        // Normalize custom domain: strip protocol, www, trailing slashes
        const rawDomain = (formData.get("customDomain") as string || "").trim();
        const customDomain = rawDomain
            .toLowerCase()
            .replace(/^https?:\/\//i, "")
            .replace(/^www\./i, "")
            .replace(/\/.*$/, "");

        const updates: Record<string, any> = {
            tagline: (formData.get("tagline") as string) || null,
            description: (formData.get("description") as string) || null,
            phone: (formData.get("phone") as string) || null,
            email: (formData.get("email") as string) || null,
            address: (formData.get("address") as string) || null,
            city: (formData.get("city") as string) || null,
            maps_url: (formData.get("mapsUrl") as string) || null,
            instagram_url: (formData.get("instagramUrl") as string) || null,
            facebook_url: (formData.get("facebookUrl") as string) || null,
            whatsapp_url: (formData.get("whatsappUrl") as string) || null,
            hero_image_url: (formData.get("heroImageUrl") as string) || null,
            landing_sections: sections.length > 0 ? sections : ["hero", "classes", "schedule", "coaches", "pricing", "cta"],
            custom_domain: customDomain || null,
            updated_at: new Date().toISOString(),
        };

        // Get previous domain to detect changes
        const { data: prevGym } = await supabaseAdmin
            .from("gyms")
            .select("custom_domain")
            .eq("id", gymId)
            .single();

        const prevDomain = prevGym?.custom_domain || "";

        // Register / remove domain on Vercel automatically
        let vercelResult: { ok: boolean; error?: string; alreadyExists?: boolean } = { ok: true };
        let vercelWarning: string | null = null;

        try {
            const { addDomainToVercel, removeDomainFromVercel } = await import("~/services/vercel-domains.server");

            if (customDomain && customDomain !== prevDomain) {
                // Remove old domain first if it existed
                if (prevDomain) await removeDomainFromVercel(prevDomain);
                vercelResult = await addDomainToVercel(customDomain);
            } else if (!customDomain && prevDomain) {
                // Domain was cleared — remove from Vercel
                vercelResult = await removeDomainFromVercel(prevDomain);
            }
        } catch (err: any) {
            // Vercel API not configured — save to DB but warn
            vercelWarning = "Dominio guardado, pero no se pudo registrar en Vercel automáticamente. Agrégalo manualmente en el panel de Vercel.";
        }

        // Always save to DB regardless of Vercel result
        const { error: dbError } = await supabaseAdmin
            .from("gyms")
            .update(updates)
            .eq("id", gymId);

        if (dbError) return { ok: false, error: dbError.message };

        if (!vercelResult.ok) {
            return {
                ok: true,
                warning: `Dominio guardado, pero hubo un error al registrarlo en Vercel: ${vercelResult.error}. Agrégalo manualmente en vercel.com.`,
            };
        }

        return {
            ok: true,
            warning: vercelWarning,
            domainAdded: !!(customDomain && customDomain !== prevDomain),
        };
    }

    return { ok: false, error: "Intent desconocido" };
}

// ─── Component ───────────────────────────────────────────────────
export default function AdminLanding({ loaderData, actionData }: Route.ComponentProps) {
    const { gym, appDomain, domainStatus } = loaderData;
    const fetcher = useFetcher();
    const saving = fetcher.state !== "idle";
    const saved = fetcher.data?.ok === true;

    const [sections, setSections] = useState<string[]>(gym.landingSections);

    const toggleSection = (id: string) => {
        setSections((prev) =>
            prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
        );
    };

    const previewUrl = gym.customDomain
        ? `https://${gym.customDomain}`
        : `https://${appDomain}/${gym.slug}`;

    return (
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Mi Web Pública</h1>
                    <p className="text-white/50 text-sm mt-1">
                        Esta es la página que ven tus clientes antes de registrarse.
                    </p>
                </div>
                <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-white/60 hover:text-white border border-white/10 hover:border-white/20 rounded-xl px-4 py-2 transition-all"
                >
                    <Eye className="size-4" /> Ver mi web
                </a>
            </div>

            <fetcher.Form method="post" className="space-y-8">
                <input type="hidden" name="intent" value="save" />
                {sections.map((s) => (
                    <input key={s} type="hidden" name="sections" value={s} />
                ))}

                {/* Dominio */}
                <Section title="Dominio" icon={Globe}>
                    <div className="space-y-4">
                        {/* Auto URL */}
                        <div>
                            <label className="label">URL automática</label>
                            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                                <span className="text-white/40 text-sm">{appDomain}/</span>
                                <span className="text-white font-medium text-sm">{gym.slug}</span>
                            </div>
                            <p className="text-white/30 text-xs mt-1.5">Esta URL siempre funciona aunque no tengas dominio propio.</p>
                        </div>

                        {/* Custom domain */}
                        <div>
                            <label className="label" htmlFor="customDomain">
                                Dominio propio (opcional)
                            </label>
                            <input
                                id="customDomain"
                                name="customDomain"
                                type="text"
                                defaultValue={gym.customDomain}
                                placeholder="ej. estudioyoga.com"
                                className="field"
                            />

                            {/* Domain status badge */}
                            {gym.customDomain && domainStatus && (
                                <div className={`mt-2 flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
                                    domainStatus.verified
                                        ? "bg-green-500/10 border-green-500/30 text-green-400"
                                        : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                }`}>
                                    {domainStatus.verified
                                        ? <><CheckCircle2 className="size-3.5" /> Dominio activo y con SSL</>
                                        : <><Clock className="size-3.5" /> Esperando configuración DNS</>
                                    }
                                </div>
                            )}

                            {/* Instructions */}
                            <div className="mt-3 bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                                <p className="text-white/50 text-xs font-semibold uppercase tracking-widest">
                                    Pasos para conectar tu dominio
                                </p>
                                <ol className="space-y-2 text-white/40 text-xs">
                                    <li className="flex gap-2">
                                        <span className="shrink-0 w-4 h-4 rounded-full bg-white/10 text-white/60 flex items-center justify-center text-[10px]">1</span>
                                        Ve a tu proveedor de dominio (GoDaddy, Namecheap, etc.) → DNS
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="shrink-0 w-4 h-4 rounded-full bg-white/10 text-white/60 flex items-center justify-center text-[10px]">2</span>
                                        Agrega un registro CNAME:
                                        <div className="ml-1 space-y-0.5">
                                            <div><span className="text-white/60">Host:</span> <code className="bg-white/10 px-1 rounded text-white/70">www</code></div>
                                            <div><span className="text-white/60">Valor:</span> <code className="bg-white/10 px-1 rounded text-white/70">cname.vercel-dns.com</code></div>
                                        </div>
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="shrink-0 w-4 h-4 rounded-full bg-white/10 text-white/60 flex items-center justify-center text-[10px]">3</span>
                                        Escribe tu dominio arriba y guarda. El SSL se activa automáticamente en ~10 min.
                                    </li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </Section>

                {/* Hero */}
                <Section title="Portada (Hero)">
                    <div className="space-y-4">
                        <Field label="Tagline" name="tagline" defaultValue={gym.tagline}
                            placeholder="ej. Tu mejor versión empieza aquí" />
                        <Field label="Descripción breve" name="description" defaultValue={gym.description}
                            placeholder="ej. Studio boutique de pilates reformer y yoga en CDMX" multiline />
                        <Field label="URL imagen de fondo (hero)" name="heroImageUrl" defaultValue={gym.heroImageUrl}
                            placeholder="https://..." />
                    </div>
                </Section>

                {/* Contacto */}
                <Section title="Contacto y ubicación">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <Field label="Teléfono" name="phone" defaultValue={gym.phone} placeholder="+52 55 0000 0000" />
                        <Field label="Email de contacto" name="email" defaultValue={gym.email} placeholder="hola@estudio.com" />
                        <Field label="Dirección" name="address" defaultValue={gym.address} placeholder="Calle y número" />
                        <Field label="Ciudad" name="city" defaultValue={gym.city} placeholder="CDMX" />
                        <Field label="URL Google Maps" name="mapsUrl" defaultValue={gym.mapsUrl} placeholder="https://maps.google.com/..." />
                    </div>
                </Section>

                {/* Redes sociales */}
                <Section title="Redes sociales">
                    <div className="space-y-4">
                        <Field label="Instagram" name="instagramUrl" defaultValue={gym.instagramUrl} placeholder="https://instagram.com/tuestudio" />
                        <Field label="Facebook" name="facebookUrl" defaultValue={gym.facebookUrl} placeholder="https://facebook.com/tuestudio" />
                        <Field label="WhatsApp (link directo)" name="whatsappUrl" defaultValue={gym.whatsappUrl} placeholder="https://wa.me/521234567890" />
                    </div>
                </Section>

                {/* Secciones visibles */}
                <Section title="Secciones visibles">
                    <p className="text-white/40 text-sm mb-4">
                        Elige qué secciones aparecen en tu web pública.
                    </p>
                    <div className="space-y-2">
                        {SECTIONS_OPTIONS.map((opt) => {
                            const active = sections.includes(opt.id);
                            return (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => toggleSection(opt.id)}
                                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-sm"
                                    style={
                                        active
                                            ? { backgroundColor: "rgba(124,58,237,0.15)", borderColor: "rgba(124,58,237,0.4)", color: "white" }
                                            : { backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }
                                    }
                                >
                                    <span>{opt.label}</span>
                                    {active && <Check className="size-4 text-violet-400" />}
                                </button>
                            );
                        })}
                    </div>
                </Section>

                {/* Feedback */}
                {fetcher.data?.error && (
                    <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
                        <AlertCircle className="size-4 shrink-0" /> {fetcher.data.error}
                    </div>
                )}
                {fetcher.data?.warning && (
                    <div className="flex items-start gap-2 text-amber-400 text-sm bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-3">
                        <Info className="size-4 shrink-0 mt-0.5" /> {fetcher.data.warning}
                    </div>
                )}
                {saved && !saving && !fetcher.data?.warning && !fetcher.data?.error && (
                    <div className="flex items-center gap-2 text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-xl px-4 py-3">
                        <CheckCircle2 className="size-4 shrink-0" />
                        {fetcher.data?.domainAdded
                            ? "Guardado. Dominio registrado en Vercel — el SSL se activa en ~10 min."
                            : "Cambios guardados correctamente."}
                    </div>
                )}

                {/* Save */}
                <div className="flex justify-end pt-2">
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold px-8 py-3 rounded-xl transition-all"
                    >
                        {saving ? "Guardando..." : "Guardar cambios"}
                    </button>
                </div>
            </fetcher.Form>
        </div>
    );
}

// ─── Subcomponents ────────────────────────────────────────────────
function Section({ title, icon: Icon, children }: { title: string; icon?: React.ElementType; children: React.ReactNode }) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-white font-semibold flex items-center gap-2">
                {Icon && <Icon className="size-4 text-white/50" />}
                {title}
            </h2>
            {children}
        </div>
    );
}

function Field({
    label, name, defaultValue, placeholder, multiline,
}: {
    label: string;
    name: string;
    defaultValue?: string;
    placeholder?: string;
    multiline?: boolean;
}) {
    return (
        <div>
            <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-1.5">
                {label}
            </label>
            {multiline ? (
                <textarea
                    name={name}
                    defaultValue={defaultValue}
                    placeholder={placeholder}
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-white/30 resize-none text-sm"
                />
            ) : (
                <input
                    type="text"
                    name={name}
                    defaultValue={defaultValue}
                    placeholder={placeholder}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-white/30 text-sm"
                />
            )}
        </div>
    );
}
