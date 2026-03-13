// app/components/landing/FAQ.tsx
// Footer-style two-column layout: left = contact header + FAQ accordion, right = contact form.

import React, { useState } from "react";
import { Mail, Instagram, Twitter } from "lucide-react";
import { ScrollReveal } from "~/components/ui/scroll-reveal";

// ─── Data ─────────────────────────────────────────────────────────────────────

const FAQS = [
    {
        q: "¿Necesito contratar a alguien para implementar el sistema?",
        a: "No. El onboarding es guiado y lo puedes hacer en menos de 30 minutos sin conocimientos técnicos. Sin embargo, ofrecemos sesiones de configuración asistida si lo prefieres.",
    },
    {
        q: "¿Cómo funciona la facturación CFDI 4.0 en México?",
        a: "Cuando un alumno paga (en línea o en efectivo), el sistema timbra automáticamente el comprobante fiscal ante el SAT y lo envía al correo del cliente. No necesitas Facturama ni ningún otro servicio externo.",
    },
    {
        q: "¿Puedo migrar mis datos desde Mindbody o Vagaro?",
        a: "Sí. Ofrecemos importación de clientes, historial de membresías y paquetes desde CSV o directamente por API. El soporte te ayuda en el proceso sin costo adicional.",
    },
    {
        q: "¿Funciona sin internet en el estudio?",
        a: "El lector de QR guarda una caché local de usuarios válidos, por lo que puede operar hasta 4 horas sin conexión. Las reservas y pagos se sincronizan al reconectarse.",
    },
    {
        q: "¿Cuántos estudios puedo gestionar con un plan?",
        a: "El plan Starter incluye 1 sede. El plan Pro incluye hasta 3 sedes. El plan Elite no tiene límite de sedes. Puedes escalar en cualquier momento.",
    },
    {
        q: "¿Qué métodos de pago aceptan?",
        a: "Mercado Pago, Kushki, Conekta y transferencia bancaria SPEI/CLABE. Próximamente Stripe. Los pagos recurrentes (membresías) son 100% automáticos.",
    },
    {
        q: "¿Project Studio guarda los datos de mis clientes?",
        a: "Tus datos son tuyos. Project Studio actúa solo como procesador. Puedes exportar toda tu base de datos en cualquier momento en formato CSV. Cumplimos con LGPD, LFPDPPP y GDPR.",
    },
    {
        q: "¿Qué pasa si cancelo mi suscripción?",
        a: "Puedes cancelar con 1 día de anticipación. Tienes 30 días adicionales de acceso de solo lectura para exportar tus datos. No hay penalizaciones ni cargos ocultos.",
    },
];

const INTERESTS = [
    "Gestión de reservas",
    "Facturación automática",
    "Control de acceso QR",
    "Reportes financieros",
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function FAQ() {
    const [open, setOpen] = useState<number | null>(null);
    const [checked, setChecked] = useState<string[]>([]);
    const [sent, setSent] = useState(false);

    function toggleCheck(label: string) {
        setChecked((prev) =>
            prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
        );
    }

    return (
        <section id="faq" className="px-4 pb-0 text-white">
            {/* ── Two-column grid ── */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* ── LEFT COLUMN ── */}
                <div className="flex flex-col gap-5">

                    {/* Contact header card */}
                    <ScrollReveal className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-8">
                        <p className="text-white/40 font-semibold text-xs tracking-widest uppercase mb-4">
                            Contáctanos
                        </p>
                        <h2 className="text-3xl md:text-4xl font-black text-white leading-snug">
                            Hablemos sobre
                            <br />
                            tu estudio.
                        </h2>
                    </ScrollReveal>

                    {/* Email card */}
                    <ScrollReveal delay={0.1} className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-5 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                            <Mail className="w-4 h-4 text-white/70" />
                        </div>
                        <div>
                            <p className="text-white/40 text-xs font-medium mb-0.5">¿En qué podemos ayudarte?</p>
                            <a
                                href="mailto:ventas@projectstudio.mx"
                                className="text-white font-semibold text-sm hover:text-white/70 transition-colors"
                            >
                                ventas@projectstudio.mx
                            </a>
                        </div>
                        {/* Social icons */}
                        <div className="ml-auto flex items-center gap-2">
                            {[
                                { href: "https://instagram.com/projectstudio", icon: <Instagram className="w-4 h-4" /> },
                                { href: "https://twitter.com/projectstudio", icon: <Twitter className="w-4 h-4" /> },
                            ].map(({ href, icon }) => (
                                <a
                                    key={href}
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-8 h-8 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:border-white/25 transition-all"
                                >
                                    {icon}
                                </a>
                            ))}
                        </div>
                    </ScrollReveal>

                    {/* FAQ accordion card */}
                    <ScrollReveal delay={0.2} className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-6 flex flex-col gap-1 flex-1">
                        <p className="text-white font-bold text-lg mb-4">FAQ</p>

                        {FAQS.map((faq, i) => (
                            <div key={i} className="border-b border-white/[0.08] last:border-0">
                                <button
                                    onClick={() => setOpen(open === i ? null : i)}
                                    className="w-full text-left py-4 flex items-center justify-between gap-4 group"
                                >
                                    <span className="text-white/70 group-hover:text-white text-sm font-medium transition-colors leading-snug">
                                        {faq.q}
                                    </span>
                                    <span
                                        className={`text-white/30 shrink-0 transition-transform duration-200 ${open === i ? "rotate-45" : ""
                                            }`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                    </span>
                                </button>
                                <div
                                    className={`overflow-hidden transition-all duration-300 ease-in-out ${open === i ? "max-h-48 pb-4" : "max-h-0"
                                        }`}
                                >
                                    <p className="text-white/45 text-sm leading-relaxed">{faq.a}</p>
                                </div>
                            </div>
                        ))}
                    </ScrollReveal>
                </div>

                {/* ── RIGHT COLUMN — Contact form ── */}
                <ScrollReveal delay={0.15} className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-8 flex flex-col gap-6">
                    <div>
                        <h3 className="text-white font-bold text-xl mb-1">¡Escríbenos hoy!</h3>
                        <p className="text-white/40 text-sm">Respondemos en menos de 24 horas.</p>
                    </div>

                    {/* Email / social row */}
                    <div>
                        <p className="text-white/35 text-xs uppercase tracking-widest mb-2">Correo</p>
                        <a
                            href="mailto:ventas@projectstudio.mx"
                            className="text-white font-semibold text-sm hover:text-white/70 transition-colors"
                        >
                            ventas@projectstudio.mx
                        </a>
                    </div>

                    {sent ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="text-white font-semibold">¡Mensaje enviado!</p>
                            <p className="text-white/40 text-sm">Nos pondremos en contacto pronto.</p>
                        </div>
                    ) : (
                        <form
                            className="flex flex-col gap-4 flex-1"
                            onSubmit={(e) => {
                                e.preventDefault();
                                setSent(true);
                            }}
                        >
                            <p className="text-white/35 text-xs uppercase tracking-widest">
                                Déjanos un mensaje
                            </p>

                            {/* Name + Email */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-white/40 text-xs">Tu nombre</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="Tu nombre"
                                        className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/25 transition-colors"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-white/40 text-xs">Email</label>
                                    <input
                                        required
                                        type="email"
                                        placeholder="tu@email.com"
                                        className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/25 transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Message */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-white/40 text-xs">Cuéntanos sobre tu estudio…</label>
                                <textarea
                                    required
                                    rows={4}
                                    placeholder="¿Cuántas sedes tienes? ¿Qué problema quieres resolver?"
                                    className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/25 transition-colors resize-none"
                                />
                            </div>

                            {/* Interests checkboxes */}
                            <div className="flex flex-col gap-2">
                                <p className="text-white/35 text-xs uppercase tracking-widest">Me interesa…</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {INTERESTS.map((label) => (
                                        <label
                                            key={label}
                                            className="flex items-center gap-2.5 cursor-pointer group"
                                        >
                                            <span
                                                onClick={() => toggleCheck(label)}
                                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${checked.includes(label)
                                                    ? "bg-white border-white"
                                                    : "border-white/20 bg-white/5 group-hover:border-white/35"
                                                    }`}
                                            >
                                                {checked.includes(label) && (
                                                    <svg className="w-2.5 h-2.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </span>
                                            <span
                                                onClick={() => toggleCheck(label)}
                                                className="text-white/50 group-hover:text-white/70 text-xs transition-colors"
                                            >
                                                {label}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                className="mt-auto w-full bg-white text-black font-bold py-3.5 rounded-xl hover:bg-white/85 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] text-sm"
                            >
                                Enviar mensaje
                            </button>
                        </form>
                    )}
                </ScrollReveal>
            </div>

            {/* ── Footer bar ── */}
            <div className="max-w-7xl mx-auto mt-6 pt-6 pb-8 border-t border-white/[0.07] flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-white/25 text-xs">
                    © {new Date().getFullYear()} Project Studio. Todos los derechos reservados.
                </p>
                <div className="flex items-center gap-5">
                    {["Privacidad", "Términos", "Cookies"].map((l) => (
                        <a key={l} href="#" className="text-white/25 hover:text-white/50 text-xs transition-colors">
                            {l}
                        </a>
                    ))}
                </div>
            </div>
        </section>
    );
}
