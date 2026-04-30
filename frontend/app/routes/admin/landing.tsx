// admin/landing.tsx — Editor de la web pública del gym
// Permite al admin editar logo, colores, texto hero, secciones visibles y dominio custom.

import { useFetcher } from "react-router";
import { useState } from "react";
import { Globe, Eye, Check, Info } from "lucide-react";
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
            customDomain: gym?.custom_domain || "",
        },
        appDomain,
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
            updated_at: new Date().toISOString(),
        };

        // Custom domain: store lowercased, strip protocol/www
        const customDomain = (formData.get("customDomain") as string || "")
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//i, "")
            .replace(/^www\./i, "")
            .replace(/\/.*$/, "");
        updates.custom_domain = customDomain || null;

        const { error } = await supabaseAdmin
            .from("gyms")
            .update(updates)
            .eq("id", gymId);

        if (error) return { ok: false, error: error.message };
        return { ok: true };
    }

    return { ok: false, error: "Intent desconocido" };
}

// ─── Component ───────────────────────────────────────────────────
export default function AdminLanding({ loaderData, actionData }: Route.ComponentProps) {
    const { gym, appDomain } = loaderData;
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
                        <div>
                            <label className="label">URL automática (subdominio)</label>
                            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                                <span className="text-white/40 text-sm">{appDomain}/</span>
                                <span className="text-white font-medium text-sm">{gym.slug}</span>
                            </div>
                        </div>
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
                            <p className="text-white/30 text-xs mt-2 flex items-start gap-1.5">
                                <Info className="size-3 mt-0.5 shrink-0" />
                                Apunta un CNAME de tu dominio a <code className="bg-white/10 px-1 rounded">cname.vercel-dns.com</code> y escribe aquí tu dominio sin www.
                            </p>
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

                {/* Save */}
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    {fetcher.data?.error && (
                        <p className="text-red-400 text-sm">{fetcher.data.error}</p>
                    )}
                    {saved && !saving && (
                        <p className="text-green-400 text-sm flex items-center gap-1.5">
                            <Check className="size-4" /> Guardado
                        </p>
                    )}
                    {!saved && !saving && <div />}
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition-all"
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
