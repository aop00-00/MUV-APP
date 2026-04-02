// admin/studio.tsx — Mi Estudio > General (branding & studio info)
import { useState, useRef } from "react";
import { Upload, Globe, Instagram, Check } from "lucide-react";
import { useFetcher } from "react-router";
import type { Route } from "./+types/studio";

const TIMEZONES = [
    "America/Mexico_City", "America/Bogota", "America/Lima",
    "America/Santiago", "America/Argentina/Buenos_Aires",
];

const PALETTE = ["#F59E0B", "#3B82F6", "#10B981", "#EF4444", "#8B5CF6", "#EC4899", "#6B7280"];

// ─── Loader: fetch gym data from Supabase ────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requireGymAdmin(request);

    const { data: gym } = await supabaseAdmin
        .from("gyms")
        .select("name, slug, logo_url, primary_color, timezone")
        .eq("id", gymId)
        .single();

    return {
        gym: {
            name: gym?.name || "",
            slug: gym?.slug || "",
            logoUrl: gym?.logo_url || "",
            primaryColor: gym?.primary_color || "#7c3aed",
            timezone: gym?.timezone || "America/Mexico_City",
        }
    };
}

// ─── Action: persist gym settings to Supabase ────────────────────
export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "save") {
        const updates: Record<string, any> = {};
        const name = formData.get("name") as string;
        const slug = formData.get("slug") as string;
        const primaryColor = formData.get("primaryColor") as string;
        const timezone = formData.get("timezone") as string;
        const logoUrl = formData.get("logoUrl") as string;
        const logoFile = formData.get("logoFile") as File | null;

        let finalLogoUrl = logoUrl;
        
        // If a real file was uploaded, send it to Supabase Storage 'logos' bucket
        if (logoFile && logoFile.size > 0) {
            const fileExt = logoFile.name.split('.').pop() || 'png';
            const fileName = `${gymId}_${Date.now()}.${fileExt}`;
            
            const { error: uploadError } = await supabaseAdmin.storage
                .from('logos')
                .upload(fileName, logoFile, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) {
                console.error("[studio.tsx] Error subiendo logo:", uploadError);
                return { success: false, error: "Error subiendo el logo: " + uploadError.message };
            }

            const { data: publicUrlData } = supabaseAdmin.storage
                .from('logos')
                .getPublicUrl(fileName);
            
            finalLogoUrl = publicUrlData.publicUrl;
        }

        if (name) updates.name = name;
        if (slug) updates.slug = slug;
        if (primaryColor) updates.primary_color = primaryColor;
        if (timezone) updates.timezone = timezone;
        if (finalLogoUrl !== undefined) updates.logo_url = finalLogoUrl || null;

        const { error } = await supabaseAdmin
            .from("gyms")
            .update(updates)
            .eq("id", gymId);

        if (error) return { success: false, error: error.message };
        return { success: true };
    }

    return { success: true };
}

// ─── Main Component ──────────────────────────────────────────────
export default function StudioGeneral({ loaderData }: Route.ComponentProps) {
    const { gym } = loaderData;
    const fetcher = useFetcher();
    const fileRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState({
        name: gym.name,
        slug: gym.slug,
        description: "",
        phone: "",
        email: "",
        website: "",
        instagram: "",
        logoUrl: gym.logoUrl,
        logoFile: null as File | null,
        primaryColor: gym.primaryColor,
        timezone: gym.timezone,
    });

    const saved = fetcher.data?.success && fetcher.state === "idle";

    function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        
        // Generate a temporary local URL for preview
        const localPreviewUrl = URL.createObjectURL(file);
        setForm(f => ({ ...f, logoFile: file, logoUrl: localPreviewUrl }));
    }

    function updateColor(color: string) {
        setForm(f => ({ ...f, primaryColor: color }));
    }

    function save(e: React.FormEvent) {
        e.preventDefault();
        const fd = new FormData();
        fd.set("intent", "save");
        fd.set("name", form.name);
        fd.set("slug", form.slug);
        fd.set("primaryColor", form.primaryColor);
        fd.set("timezone", form.timezone);
        
        if (form.logoFile) {
            fd.set("logoFile", form.logoFile);
        } else {
            fd.set("logoUrl", form.logoUrl);
        }
        
        fetcher.submit(fd, { method: "post" });
    }

    const [urlCopied, setUrlCopied] = useState(false);
    const fullSlugUrl = typeof window !== "undefined" && form.slug
        ? `${window.location.origin}/${form.slug}`
        : form.slug ? `/${form.slug}` : null;

    function copyGymUrl() {
        if (fullSlugUrl) {
            navigator.clipboard.writeText(fullSlugUrl).then(() => {
                setUrlCopied(true);
                setTimeout(() => setUrlCopied(false), 2000);
            });
        }
    }

    return (
        <form onSubmit={save} className="space-y-6 max-w-3xl">
            <div>
                <h1 className="text-2xl font-black text-white">Mi Estudio — General</h1>
                <p className="text-white/50 text-sm mt-0.5">Información pública y configuración de marca de tu estudio.</p>
            </div>

            {/* Personalized URL */}
            {fullSlugUrl && (
                <div className="bg-amber-400/5 border border-amber-400/20 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="font-bold text-amber-400 text-sm uppercase tracking-wider">URL personalizada de tu estudio</h2>
                    </div>
                    <div className="flex items-center gap-3 bg-black/30 rounded-xl p-3">
                        <code className="text-white font-mono text-sm flex-1 break-all">{fullSlugUrl}</code>
                        <button
                            type="button"
                            onClick={copyGymUrl}
                            className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-all flex-shrink-0"
                        >
                            {urlCopied ? "Copiado!" : "Copiar"}
                        </button>
                    </div>
                    <p className="text-xs text-white/40 mt-2">Comparte esta URL con tus alumnos para que se registren directamente.</p>
                </div>
            )}

            {/* Logo & Color */}
            <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl p-6 space-y-5">
                <h2 className="font-bold text-white">Identidad visual</h2>
                <div className="flex items-start gap-6">
                    {/* Logo upload */}
                    <div className="flex flex-col items-center gap-2">
                        <div
                            onClick={() => fileRef.current?.click()}
                            className="w-24 h-24 rounded-2xl border-2 border-dashed border-white/[0.08] hover:border-amber-400 flex items-center justify-center cursor-pointer transition-colors overflow-hidden bg-white/5"
                            style={{ backgroundColor: form.logoUrl ? "transparent" : undefined }}
                        >
                            {form.logoUrl
                                ? <img src={form.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                                : <div className="text-center"><Upload className="w-6 h-6 text-white/30 mx-auto mb-1" /><span className="text-xs text-white/40">Logo</span></div>
                            }
                        </div>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
                        <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-amber-600 font-semibold hover:underline">Subir logo</button>
                    </div>

                    {/* Color picker */}
                    <div className="flex-1">
                        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Color principal</label>
                        <div className="flex flex-wrap gap-2">
                            {PALETTE.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => updateColor(color)}
                                    className="w-9 h-9 rounded-xl border-2 transition-all flex items-center justify-center"
                                    style={{ backgroundColor: color, borderColor: form.primaryColor === color ? "#111" : "transparent" }}
                                >
                                    {form.primaryColor === color && <Check className="w-4 h-4 text-white drop-shadow" />}
                                </button>
                            ))}
                            <div className="flex items-center gap-2 ml-1">
                                <input type="color" value={form.primaryColor} onChange={e => updateColor(e.target.value)} className="w-9 h-9 rounded-xl cursor-pointer border-0" />
                                <span className="text-xs text-white/40 font-mono">{form.primaryColor}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Basic info */}
            <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl p-6 space-y-5">
                <h2 className="font-bold text-white">Información del estudio</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Nombre del estudio *</label>
                        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400 transition-colors" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Slug (URL pública)</label>
                        <div className="flex items-center border border-white/[0.08] rounded-xl overflow-hidden focus-within:border-amber-400 transition-colors">
                            <span className="pl-3 pr-1 text-white/40 text-xs shrink-0">/</span>
                            <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))} className="flex-1 pr-3 py-2.5 text-sm focus:outline-none bg-transparent" />
                        </div>
                        {fullSlugUrl && <p className="text-xs text-white/40 mt-1">{fullSlugUrl}</p>}
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Zona horaria</label>
                        <select value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm bg-white/5 focus:outline-none focus:border-amber-400 transition-colors">
                            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace("America/", "").replace("_", " ")}</option>)}
                        </select>
                    </div>
                    <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Descripción pública</label>
                        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400 transition-colors resize-none" />
                    </div>
                </div>
            </div>

            {/* Contact */}
            <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl p-6 space-y-4">
                <h2 className="font-bold text-white">Contacto y redes</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Teléfono / WhatsApp</label>
                        <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+52 55 1234 5678" className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400 transition-colors" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Correo de contacto</label>
                        <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="hola@estudio.mx" className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400 transition-colors" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Sitio web</label>
                        <div className="flex items-center border border-white/[0.08] rounded-xl overflow-hidden focus-within:border-amber-400 transition-colors">
                            <Globe className="ml-3 w-4 h-4 text-white/40 shrink-0" />
                            <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://..." className="flex-1 pl-2 pr-3 py-2.5 text-sm focus:outline-none bg-transparent" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Instagram</label>
                        <div className="flex items-center border border-white/[0.08] rounded-xl overflow-hidden focus-within:border-amber-400 transition-colors">
                            <Instagram className="ml-3 w-4 h-4 text-white/40 shrink-0" />
                            <input value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))} placeholder="@usuario" className="flex-1 pl-2 pr-3 py-2.5 text-sm focus:outline-none bg-transparent" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Save */}
            <div className="flex items-center gap-3">
                <button type="submit" disabled={fetcher.state !== "idle"} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${saved ? "bg-green-500 text-white" : "bg-amber-400 hover:bg-amber-500 text-black hover:scale-105 active:scale-95"} disabled:opacity-60`}>
                    {fetcher.state !== "idle" ? "Guardando..." : saved ? <><Check className="w-4 h-4" /> Guardado</> : "Guardar cambios"}
                </button>
                {saved && <p className="text-sm text-green-600 font-medium">Los cambios se guardaron correctamente.</p>}
                {fetcher.data?.error && <p className="text-sm text-red-500 font-medium">{fetcher.data.error}</p>}
            </div>
        </form>
    );
}
