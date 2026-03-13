// admin/studio.tsx — Mi Estudio > General (branding & studio info)
import { useState, useRef } from "react";
import { Upload, Globe, Instagram, Twitter, Check } from "lucide-react";

interface StudioForm {
    name: string;
    slug: string;
    description: string;
    phone: string;
    email: string;
    website: string;
    instagram: string;
    twitter: string;
    logo: string | null;
    primaryColor: string;
    timezone: string;
}

const TIMEZONES = [
    "America/Mexico_City", "America/Bogota", "America/Lima",
    "America/Santiago", "America/Argentina/Buenos_Aires",
];

const PALETTE = ["#F59E0B", "#3B82F6", "#10B981", "#EF4444", "#8B5CF6", "#EC4899", "#6B7280"];

import { useTenant } from "~/context/TenantContext";

export default function StudioGeneral() {
    const { config, updateTenant } = useTenant();
    const [form, setForm] = useState<StudioForm>({
        name: config.name,
        slug: "aop",
        description: "Estudio boutique de Pilates y Yoga en el corazón de la ciudad. Clases pequeñas, atención personalizada.",
        phone: "+52 55 1234 5678",
        email: "hola@grindproject.mx",
        website: "https://grindproject.mx",
        instagram: "@grindproject",
        twitter: "@grindproject",
        logo: config.logo,
        primaryColor: config.primaryColor,
        timezone: config.timezone,
    });
    const [saved, setSaved] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const logo = ev.target?.result as string;
            setForm(f => ({ ...f, logo }));
            updateTenant({ logo }); // Live update
        };
        reader.readAsDataURL(file);
    }

    function updateColor(color: string) {
        setForm(f => ({ ...f, primaryColor: color }));
        updateTenant({ primaryColor: color }); // Live update
    }

    function save(e: React.FormEvent) {
        e.preventDefault();
        setSaved(true);
        updateTenant({
            name: form.name,
            logo: form.logo ?? "",
            primaryColor: form.primaryColor,
            timezone: form.timezone
        });
        setTimeout(() => setSaved(false), 2500);
    }

    const slugUrl = `koreo.mx/join/${form.slug}`;

    return (
        <form onSubmit={save} className="space-y-6 max-w-3xl">
            <div>
                <h1 className="text-2xl font-black text-white">Mi Estudio — General</h1>
                <p className="text-white/50 text-sm mt-0.5">Información pública y configuración de marca de tu estudio.</p>
            </div>

            {/* Logo & Color */}
            <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl p-6 space-y-5">
                <h2 className="font-bold text-white">Identidad visual</h2>
                <div className="flex items-start gap-6">
                    {/* Logo upload */}
                    <div className="flex flex-col items-center gap-2">
                        <div
                            onClick={() => fileRef.current?.click()}
                            className="w-24 h-24 rounded-2xl border-2 border-dashed border-white/[0.08] hover:border-amber-400 flex items-center justify-center cursor-pointer transition-colors overflow-hidden bg-white/5"
                            style={{ backgroundColor: form.logo ? "transparent" : undefined }}
                        >
                            {form.logo
                                ? <img src={form.logo} alt="Logo" className="w-full h-full object-contain" />
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
                            <span className="pl-3 pr-1 text-white/40 text-xs shrink-0">koreo.mx/join/</span>
                            <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))} className="flex-1 pr-3 py-2.5 text-sm focus:outline-none bg-transparent" />
                        </div>
                        <p className="text-xs text-white/40 mt-1">{slugUrl}</p>
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
                    {[
                        ["Teléfono / WhatsApp", "phone", "tel", "+52 55 1234 5678"],
                        ["Correo de contacto", "email", "email", "hola@estudio.mx"],
                    ].map(([label, key, type, ph]) => (
                        <div key={key}>
                            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">{label}</label>
                            <input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400 transition-colors" />
                        </div>
                    ))}
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
                <button type="submit" className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${saved ? "bg-green-500 text-white" : "bg-amber-400 hover:bg-amber-500 text-black hover:scale-105 active:scale-95"}`}>
                    {saved ? <><Check className="w-4 h-4" /> Guardado</> : "Guardar cambios"}
                </button>
                {saved && <p className="text-sm text-green-600 font-medium">Los cambios se guardaron correctamente.</p>}
            </div>
        </form>
    );
}
