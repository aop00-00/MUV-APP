// app/components/landing/Features.tsx
// Bento grid layout with animated mini-demos for each feature.
// All animations via CSS transitions + React useState/useEffect (no framer-motion).

import { useEffect, useState, useRef } from "react";
import { Lock, Smartphone, Globe, CalendarCheck, QrCode, Receipt, TrendingUp } from "lucide-react";
import { ScrollReveal } from "~/components/ui/scroll-reveal";

// ── Animation: Booking slots (Reservas online) ─────────────────
function ReservasAnimation() {
    const slots = ["07:00", "08:00", "09:00", "10:00", "11:00", "12:00"];
    const [filled, setFilled] = useState<number[]>([0, 2]);
    const [latest, setLatest] = useState<number | null>(null);

    useEffect(() => {
        const interval = setInterval(() => {
            setFilled((prev) => {
                const available = slots.map((_, i) => i).filter((i) => !prev.includes(i));
                if (available.length === 0) {
                    setLatest(null);
                    return [0, 2];
                }
                const pick = available[Math.floor(Math.random() * available.length)];
                setLatest(pick);
                return [...prev, pick];
            });
        }, 1200);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col gap-1.5 w-full">
            {slots.map((time, i) => {
                const isFilled = filled.includes(i);
                const isNew = latest === i;
                return (
                    <div
                        key={time}
                        className="flex items-center gap-2"
                        style={{ transition: "all 0.4s ease" }}
                    >
                        <span className="text-white/30 text-xs font-mono w-10 flex-shrink-0">{time}</span>
                        <div
                            className="h-5 rounded flex-1 transition-all duration-500"
                            style={{
                                background: isFilled
                                    ? isNew
                                        ? "rgba(255,255,255,0.4)"
                                        : "rgba(255,255,255,0.18)"
                                    : "rgba(255,255,255,0.05)",
                                border: isFilled ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.06)",
                                transform: isNew ? "scaleX(1.02)" : "scaleX(1)",
                            }}
                        />
                        {isFilled && (
                            <span
                                className="text-white/50 text-[10px]"
                                style={{
                                    opacity: isNew ? 1 : 0.4,
                                    transition: "opacity 0.4s ease",
                                }}
                            >
                                ✓
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ── Animation: QR + Lock shield cycling (Acceso QR) ───────────
function QRAnimation() {
    const [shields, setShields] = useState([
        { id: 1, active: false },
        { id: 2, active: false },
        { id: 3, active: false },
    ]);
    const [scanLine, setScanLine] = useState(0);

    useEffect(() => {
        // Shields cycle
        const shieldInterval = setInterval(() => {
            setShields((prev) => {
                const nextIdx = prev.findIndex((s) => !s.active);
                if (nextIdx === -1) return prev.map((s) => ({ ...s, active: false }));
                return prev.map((s, i) => (i === nextIdx ? { ...s, active: true } : s));
            });
        }, 700);
        // Scan line
        const scanInterval = setInterval(() => {
            setScanLine((p) => (p >= 100 ? 0 : p + 4));
        }, 30);
        return () => {
            clearInterval(shieldInterval);
            clearInterval(scanInterval);
        };
    }, []);

    return (
        <div className="flex flex-col items-center gap-4 h-full justify-center">
            {/* QR code mockup */}
            <div className="relative w-16 h-16 border-2 border-white/20 rounded-lg overflow-hidden">
                <div
                    className="grid grid-cols-3 gap-0.5 p-1 w-full h-full"
                    style={{ background: "rgba(255,255,255,0.03)" }}
                >
                    {Array.from({ length: 9 }).map((_, i) => (
                        <div
                            key={i}
                            className="rounded-[1px]"
                            style={{
                                background: [0, 1, 3, 5, 6, 7, 8].includes(i)
                                    ? "rgba(255,255,255,0.6)"
                                    : "transparent",
                            }}
                        />
                    ))}
                </div>
                {/* Scan line */}
                <div
                    className="absolute left-0 right-0 h-0.5 pointer-events-none"
                    style={{
                        top: `${scanLine}%`,
                        background: "rgba(255,255,255,0.5)",
                        boxShadow: "0 0 6px rgba(255,255,255,0.4)",
                        opacity: scanLine > 5 && scanLine < 95 ? 1 : 0,
                        transition: "top 0.03s linear",
                    }}
                />
            </div>
            {/* Lock shields */}
            <div className="flex gap-2">
                {shields.map((shield) => (
                    <div
                        key={shield.id}
                        className="w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300"
                        style={{
                            background: shield.active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.04)",
                            border: shield.active ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(255,255,255,0.08)",
                            transform: shield.active ? "scale(1.1)" : "scale(1)",
                        }}
                    >
                        <Lock
                            className="w-4 h-4 transition-colors duration-300"
                            style={{ color: shield.active ? "white" : "rgba(255,255,255,0.2)" }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Animation: Invoice stamp (Facturación) ─────────────────────
function FacturacionAnimation() {
    const [stamped, setStamped] = useState(false);
    const [count, setCount] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setStamped(false);
            setTimeout(() => setStamped(true), 600);
            setCount((c) => c + 1);
        }, 2500);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center h-full gap-3">
            <div
                className="relative border border-white/10 rounded-lg px-5 py-4 w-full transition-all duration-300"
                style={{
                    background: "rgba(255,255,255,0.03)",
                    boxShadow: stamped ? "0 0 20px rgba(255,255,255,0.08)" : "none",
                }}
            >
                <div className="text-[10px] text-white/30 font-mono mb-2">CFDI 4.0</div>
                <div className="h-1.5 bg-white/10 rounded mb-1.5 w-full" />
                <div className="h-1.5 bg-white/10 rounded mb-1.5 w-3/4" />
                <div className="h-1.5 bg-white/10 rounded w-1/2" />

                {/* Stamp */}
                <div
                    className="absolute top-2 right-2 border-2 rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-all duration-400"
                    style={{
                        borderColor: stamped ? "rgba(255,255,255,0.5)" : "transparent",
                        color: stamped ? "rgba(255,255,255,0.7)" : "transparent",
                        transform: stamped ? "rotate(-8deg) scale(1)" : "rotate(-8deg) scale(0.5)",
                        opacity: stamped ? 1 : 0,
                        transition: "all 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                >
                    Timbrado
                </div>
            </div>
            <span className="text-white/20 text-[10px] font-mono">{count} facturas emitidas</span>
        </div>
    );
}

// ── Animation: Kanban leads (CRM) ──────────────────────────────
function CRMAnimation() {
    const [activeCard, setActiveCard] = useState(0);
    const cols = ["Nuevo", "Contactado", "Miembro"];

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveCard((p) => (p + 1) % 3);
        }, 1800);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex gap-2 h-full items-center">
            {cols.map((col, i) => (
                <div key={col} className="flex-1 flex flex-col gap-1.5">
                    <span className="text-[9px] text-white/30 uppercase tracking-widest font-semibold">{col}</span>
                    <div
                        className="h-8 rounded transition-all duration-500"
                        style={{
                            background: activeCard === i ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.04)",
                            border: activeCard === i ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.07)",
                            transform: activeCard === i ? "translateY(-2px)" : "translateY(0)",
                            boxShadow: activeCard === i ? "0 4px 12px rgba(0,0,0,0.4)" : "none",
                        }}
                    />
                    <div className="h-6 rounded" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }} />
                </div>
            ))}
        </div>
    );
}

// ── Animation: FitCoins counter ────────────────────────────────
function FitCoinsAnimation() {
    const [coins, setCoins] = useState(240);
    const [burst, setBurst] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            const add = Math.floor(Math.random() * 15) + 5;
            setCoins((c) => c + add);
            setBurst(true);
            setTimeout(() => setBurst(false), 400);
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center h-full gap-2">
            <div
                className="flex items-center gap-2 transition-all duration-300"
                style={{ transform: burst ? "scale(1.15)" : "scale(1)" }}
            >
                <span className="text-3xl grayscale">⚡</span>
                <span className="text-4xl font-black text-white tabular-nums">
                    {coins.toLocaleString("es-MX")}
                </span>
            </div>
            <span className="text-white/30 text-xs">FitCoins acumulados</span>
            <div className="flex gap-1 mt-1">
                {[...Array(5)].map((_, i) => (
                    <div
                        key={i}
                        className="w-6 h-1.5 rounded-full transition-all duration-300"
                        style={{ background: i < 3 ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.08)" }}
                    />
                ))}
            </div>
        </div>
    );
}

// ── Animation: Global network (Multi-sede) ─────────────────────
function MultiSedeAnimation() {
    const [pulse, setPulse] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setPulse((p) => p + 1);
        }, 800);
        return () => clearInterval(interval);
    }, []);

    const rings = [0, 1, 2, 3];

    return (
        <div className="flex items-center justify-center h-full relative">
            <Globe className="w-14 h-14 text-white/70 relative z-10" />
            {rings.map((i) => {
                const delay = i * 0.8;
                const progress = ((pulse * 0.4 + delay) % 3) / 3;
                return (
                    <div
                        key={i}
                        className="absolute rounded-full border border-white/20 pointer-events-none"
                        style={{
                            width: `${56 + progress * 80}px`,
                            height: `${56 + progress * 80}px`,
                            opacity: Math.max(0, 1 - progress),
                            transition: "none",
                        }}
                    />
                );
            })}
        </div>
    );
}

// ── Main bento grid ────────────────────────────────────────────
export default function Features() {
    const sectionRef = useRef<HTMLElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = sectionRef.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
            { threshold: 0.1 }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    const cardBase =
        "bg-white/[0.04] border border-white/10 rounded-xl p-6 flex flex-col backdrop-blur-md hover:bg-white/[0.07] hover:border-white/20 transition-all duration-300 cursor-pointer overflow-hidden";

    const animStyle = (delay: number) => ({
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        filter: visible ? "blur(0px)" : "blur(6px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms, filter 0.7s ease ${delay}ms`,
    });

    return (
        <section ref={sectionRef} id="features" className="py-24 px-6 text-white">
            <div className="max-w-7xl mx-auto">
                <ScrollReveal>
                    <p className="text-white/70 text-sm uppercase tracking-widest mb-8">
                        Todo lo que necesitas
                    </p>
                </ScrollReveal>

                {/* Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 auto-rows-[200px]">

                    {/* 1. Reservas online — Tall 2×2 */}
                    <ScrollReveal delay={0.1} className="md:col-span-2 md:row-span-2">
                        <div className={`${cardBase} h-full`}>
                            <div className="flex-1 flex items-center">
                                <ReservasAnimation />
                            </div>
                            <div className="mt-4">
                                <h3 className="text-xl text-white font-bold flex items-center gap-2">
                                    <CalendarCheck className="w-5 h-5 text-white/60" />
                                    Reservas online
                                </h3>
                                <p className="text-white/55 text-sm mt-1 leading-relaxed">
                                    Agenda en tiempo real. Tus alumnas reservan desde su celular, sin llamadas ni WhatsApps.
                                </p>
                            </div>
                        </div>
                    </ScrollReveal>

                    {/* 2. Facturación fiscal — Standard 2×1 */}
                    <ScrollReveal delay={0.2} className="md:col-span-2">
                        <div className={`${cardBase} h-full`}>
                            <div className="flex-1">
                                <FacturacionAnimation />
                            </div>
                            <div className="mt-2">
                                <h3 className="text-xl text-white font-bold flex items-center gap-2">
                                    <Receipt className="w-5 h-5 text-white/60" />
                                    Facturación fiscal
                                </h3>
                                <p className="text-white/55 text-sm mt-1">CFDI 4.0, AFIP, SII. Timbre automático al pagar.</p>
                            </div>
                        </div>
                    </ScrollReveal>

                    {/* 3. Control de acceso QR — Tall 2×2 */}
                    <ScrollReveal delay={0.3} className="md:col-span-2 md:row-span-2">
                        <div className={`${cardBase} h-full`}>
                            <div className="flex-1 flex items-center justify-center">
                                <QRAnimation />
                            </div>
                            <div className="mt-4">
                                <h3 className="text-xl text-white font-bold flex items-center gap-2">
                                    <QrCode className="w-5 h-5 text-white/60" />
                                    Control de acceso QR
                                </h3>
                                <p className="text-white/55 text-sm mt-1 leading-relaxed">
                                    Código QR dinámico. Tu torniquete o puerta solo abre para alumnas solventes.
                                </p>
                            </div>
                        </div>
                    </ScrollReveal>

                    {/* 4. CRM de leads — Standard 2×1 */}
                    <ScrollReveal delay={0.4} className="md:col-span-2">
                        <div className={`${cardBase} h-full`}>
                            <div className="flex-1">
                                <CRMAnimation />
                            </div>
                            <div className="mt-2">
                                <h3 className="text-xl text-white font-bold flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-white/60" />
                                    CRM de leads
                                </h3>
                                <p className="text-white/55 text-sm mt-1">Pipeline Kanban. Convierte leads de Instagram en membresías.</p>
                            </div>
                        </div>
                    </ScrollReveal>

                    {/* 5. FitCoins & gamificación — Wide 3×1 */}
                    <ScrollReveal delay={0.5} className="md:col-span-3">
                        <div className={`${cardBase} h-full`}>
                            <div className="flex-1">
                                <FitCoinsAnimation />
                            </div>
                            <div className="mt-4">
                                <h3 className="text-xl text-white font-bold">⚡ FitCoins & gamificación</h3>
                                <p className="text-white/55 text-sm mt-1">Programa de lealtad que premia la asistencia y referidos. Tus clientas vuelven por los puntos.</p>
                            </div>
                        </div>
                    </ScrollReveal>

                    {/* 6. Multi-sede — Wide 3×1 */}
                    <ScrollReveal delay={0.6} className="md:col-span-3">
                        <div className={`${cardBase} h-full`}>
                            <div className="flex-1">
                                <MultiSedeAnimation />
                            </div>
                            <div className="mt-4">
                                <h3 className="text-xl text-white font-bold flex items-center gap-2">
                                    <Smartphone className="w-5 h-5 text-white/60" />
                                    Multi-sede
                                </h3>
                                <p className="text-white/55 text-sm mt-1">Un solo panel para todos tus estudios. Finanzas, métricas y personal centralizados.</p>
                            </div>
                        </div>
                    </ScrollReveal>

                </div>
            </div>
        </section>
    );
}
