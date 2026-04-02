// app/components/landing/CallToAction.tsx
// Scroll-driven 3D "container scroll" CTA — no framer-motion required.

import React, { useRef, useEffect, useState } from "react";
import { Link } from "react-router";

// ─── ContainerScroll primitive ────────────────────────────────────────────────

function useScrollProgress(ref: React.RefObject<HTMLDivElement | null>) {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const update = () => {
            const rect = el.getBoundingClientRect();
            const vh = window.innerHeight;
            // 0 when top of element hits bottom of viewport, 1 when bottom hits top
            const raw = 1 - rect.bottom / (vh + rect.height);
            setProgress(Math.min(1, Math.max(0, raw)));
        };

        update();
        window.addEventListener("scroll", update, { passive: true });
        window.addEventListener("resize", update, { passive: true });
        return () => {
            window.removeEventListener("scroll", update);
            window.removeEventListener("resize", update);
        };
    }, [ref]);

    return progress;
}

function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}

function ContainerScroll({
    titleComponent,
    children,
}: {
    titleComponent: React.ReactNode;
    children: React.ReactNode;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const progress = useScrollProgress(containerRef);

    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth <= 768);
        check();
        window.addEventListener("resize", check, { passive: true });
        return () => window.removeEventListener("resize", check);
    }, []);

    // Mirror Aceternity values: rotate 20→0, scale 1.05→1 (desktop) or 0.7→0.9 (mobile)
    const rotate = lerp(20, 0, progress);
    const scale = isMobile ? lerp(0.7, 0.9, progress) : lerp(1.05, 1, progress);
    const translateY = lerp(0, -100, progress);

    return (
        <div
            ref={containerRef}
            className="h-[60rem] md:h-[80rem] flex items-center justify-center relative p-2 md:p-20"
        >
            <div className="py-10 md:py-40 w-full relative" style={{ perspective: "1000px" }}>
                {/* Header — slides up as you scroll */}
                <div
                    className="max-w-5xl mx-auto text-center"
                    style={{ transform: `translateY(${translateY}px)`, willChange: "transform" }}
                >
                    {titleComponent}
                </div>

                {/* 3-D card */}
                <div
                    style={{
                        transform: `rotateX(${rotate}deg) scale(${scale})`,
                        willChange: "transform",
                        boxShadow:
                            "0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003",
                        transition: "transform 0.05s linear",
                    }}
                    className="max-w-5xl -mt-12 mx-auto h-[30rem] md:h-[40rem] w-full border-4 border-white/20 p-2 md:p-6 bg-[#111] rounded-[30px] shadow-2xl"
                >
                    <div className="h-full w-full overflow-hidden rounded-2xl bg-[#0a0a0a] md:rounded-2xl">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── CallToAction ─────────────────────────────────────────────────────────────

export default function CallToAction() {
    return (
        <section id="cta" className="px-4 text-white overflow-hidden">
            <ContainerScroll
                titleComponent={
                    <div className="mb-8">
                        <p className="text-white/50 font-semibold text-xs tracking-widest uppercase mb-4">
                            Empieza hoy
                        </p>
                        <h2 className="text-4xl md:text-6xl font-black text-white leading-tight">
                            Tu estudio merece un
                            <br />
                            <span className="text-white/50">software a su altura</span>
                        </h2>
                    </div>
                }
            >
                {/* Card content — dashboard screenshot fills the card */}
                <div className="relative h-full w-full overflow-hidden rounded-2xl">
                    {/* Dashboard screenshot */}
                    <img
                        src="/cta-dashboard.jpg.jpg"
                        alt="Project Studio — dashboard de gestión de studio"
                        className="absolute inset-0 w-full h-full object-cover object-top select-none brightness-75"
                        draggable={false}
                    />
                    {/* Dark tint overlay for text legibility */}
                    <div className="absolute inset-0 bg-black/50" />
                    {/* Bottom gradient for trust-signal area */}
                    <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

                    {/* CTA content overlaid on top */}
                    <div className="relative z-10 h-full flex flex-col items-center justify-center gap-8 px-8 py-12 text-center">
                        <p className="text-white/55 text-lg max-w-xl">
                            La plataforma ideal para tu crecimiento. Sin contratos forzosos. Sin compromisos.
                            Tu estudio operando en menos de un día.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link
                                to="/onboarding"
                                className="inline-flex items-center gap-2 bg-white text-black px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/85 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                Empezar ahora
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </Link>
                            <Link
                                to="/auth/login"
                                className="text-white/40 hover:text-white text-sm transition-colors"
                            >
                                Ya tengo cuenta →
                            </Link>
                        </div>
                    </div>

                    {/* Trust signals pinned to bottom */}
                    <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-5 px-6 pb-6">
                        {["Sin tarjeta", "Sin contratos", "Soporte en español"].map((t) => (
                            <div key={t} className="flex items-center gap-2 text-white/50 text-sm">
                                <svg className="w-4 h-4 text-white/60 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                {t}
                            </div>
                        ))}
                    </div>
                </div>
            </ContainerScroll>
        </section>
    );
}
