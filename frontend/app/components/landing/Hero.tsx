// app/components/landing/Hero.tsx
// Adapted from tailark's HeroSection for React Router 7.
// Removed: next/link, 'use client', framer-motion.
// Added: Grind Project branding, Spanish copy, scroll-aware navbar, product screenshot.

import React from "react";
import { Link } from "react-router";
import { ArrowRight, ChevronRight, Menu, X, Accessibility, Dumbbell, Zap, Building2, Swords, Activity, Music, Flower2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { AnimatedGroup } from "~/components/ui/animated-group";
import { ScrollReveal } from "~/components/ui/scroll-reveal";
import { cn } from "~/lib/utils";
import ImageHaloCarousel from "./ImageHaloCarousel";

// ── Transition config (mirrors the framer-motion variants API) ────
import { motion, type PanInfo } from "framer-motion";

const transitionVariants = {
    item: {
        hidden: { opacity: 0, filter: "blur(12px)", y: 12 },
        visible: {
            opacity: 1,
            filter: "blur(0px)",
            y: 0,
            transition: { type: "spring", bounce: 0.3, duration: 1.5 },
        },
    },
};

// ─── Nav items ─────────────────────────────────────────────────────
const menuItems = [
    { name: "Plataforma", href: "/producto" },
    { name: "Características", href: "/#features" },
    { name: "Proceso", href: "/#process" },
    { name: "Precios", href: "/#pricing" },
    { name: "FAQ", href: "/#faq" },
];

// ── Grind Project wordmark ────────────────────────────────────────
export const Logo = ({ className }: { className?: string }) => (
    <span
        className={cn(
            "text-white font-semibold tracking-tight text-xl select-none font-display",
            className
        )}
    >
        PROJECT<span className="text-white/40">STUDIO</span>
    </span>
);

// ── Scroll-aware navbar ───────────────────────────────────────────
export const HeroHeader = () => {
    const [menuState, setMenuState] = React.useState(false);
    const [isScrolled, setIsScrolled] = React.useState(false);
    const [isHidden, setIsHidden] = React.useState(false);
    const lastScrollY = React.useRef(0);

    React.useEffect(() => {
        const handleScroll = () => {
            const currentY = window.scrollY;
            const diff = currentY - lastScrollY.current;

            setIsScrolled(currentY > 50);

            // Hide when scrolling DOWN past 100px; show when scrolling UP
            if (currentY > 100 && diff > 6) {
                setIsHidden(true);
            } else if (diff < -4) {
                setIsHidden(false);
            }

            lastScrollY.current = currentY;
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <header>
            <nav
                data-state={menuState ? "active" : undefined}
                className={cn(
                    "fixed z-20 w-full px-2 group",
                    "transition-all duration-300 ease-in-out",
                    isHidden
                        ? "-translate-y-full opacity-0 pointer-events-none"
                        : "translate-y-0 opacity-100"
                )}
            >
                <div
                    className={cn(
                        "mx-auto mt-2 max-w-6xl px-6 transition-all duration-300 lg:px-12",
                        "bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl",
                        "shadow-[0_4px_24px_rgba(0,0,0,0.3)]",
                        isScrolled && "max-w-4xl bg-black/50 lg:px-5"
                    )}
                >
                    <div className="relative flex flex-wrap items-center justify-between gap-6 py-3 lg:gap-0 lg:py-4">
                        {/* Logo + mobile toggle */}
                        <div className="flex w-full justify-between lg:w-auto">
                            <Link to="/" aria-label="Grind Project">
                                <Logo />
                            </Link>

                            <button
                                onClick={() => setMenuState(!menuState)}
                                aria-label={menuState ? "Cerrar menú" : "Abrir menú"}
                                className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 lg:hidden text-white"
                            >
                                <Menu className="group-data-[state=active]:rotate-180 group-data-[state=active]:scale-0 group-data-[state=active]:opacity-0 m-auto size-6 duration-200" />
                                <X className="group-data-[state=active]:rotate-0 group-data-[state=active]:scale-100 group-data-[state=active]:opacity-100 absolute inset-0 m-auto size-6 -rotate-180 scale-0 opacity-0 duration-200" />
                            </button>
                        </div>

                        {/* Desktop nav — centered */}
                        <div className="absolute inset-0 m-auto hidden size-fit lg:block">
                            <ul className="flex gap-8 text-sm">
                                {menuItems.map((item, i) => (
                                    <li key={i}>
                                        <Link
                                            to={item.href}
                                            className="text-white/50 hover:text-white block duration-150"
                                        >
                                            {item.name}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* CTA buttons */}
                        <div
                            className={cn(
                                "bg-black/80 border border-white/10 group-data-[state=active]:block lg:group-data-[state=active]:flex",
                                "mb-6 hidden w-full flex-wrap items-center justify-end space-y-8",
                                "rounded-3xl p-6 shadow-2xl shadow-black/40",
                                "md:flex-nowrap",
                                "lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:space-y-0",
                                "lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none"
                            )}
                        >
                            {/* Mobile nav links */}
                            <div className="lg:hidden">
                                <ul className="space-y-6 text-base">
                                    {menuItems.map((item, i) => (
                                        <li key={i}>
                                            <Link
                                                to={item.href}
                                                className="text-white/60 hover:text-white block duration-150"
                                                onClick={() => setMenuState(false)}
                                            >
                                                {item.name}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Auth buttons */}
                            <div className="flex w-full flex-col space-y-3 sm:flex-row sm:gap-3 sm:space-y-0 md:w-fit">
                                <Button
                                    asChild
                                    variant="outline"
                                    size="sm"
                                    className={cn(isScrolled && "lg:hidden")}
                                >
                                    <Link to="/auth/login">
                                        <span>Ingresar</span>
                                    </Link>
                                </Button>
                                <Button
                                    asChild
                                    size="sm"
                                    className={cn(isScrolled && "hidden")}
                                >
                                    <Link to="/onboarding">
                                        <span>Empezar ahora</span>
                                    </Link>
                                </Button>
                                <Button
                                    asChild
                                    size="sm"
                                    className={cn(!isScrolled ? "hidden" : "inline-flex")}
                                >
                                    <Link to="/onboarding">
                                        <span>Empezar ahora →</span>
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>
        </header>
    );
};

// ── Vertical Image Stack for Disciplines ──────────────────────────
const DISCIPLINE_IMAGES = [
    { id: 1, src: "/images/landing/pilates.png", label: "Pilates", alt: "Pilates studio" },
    { id: 2, src: "/images/landing/yoga.png", label: "Yoga", alt: "Yoga session" },
    { id: 3, src: "/images/landing/barre.png", label: "Barre", alt: "Barre studio" },
    { id: 4, src: "/images/landing/crossfit.png", label: "CrossFit", alt: "CrossFit training" },
    { id: 5, src: "/images/landing/hiit.png", label: "Funcional & HIIT", alt: "HIIT session" },
    { id: 7, src: "/images/landing/artes_marciales.png", label: "Artes Marciales", alt: "Martial arts dojo" },
    { id: 8, src: "/images/landing/dance.png", label: "Dance Studio", alt: "Dance practice" },
];


// ── Main Hero section ─────────────────────────────────────────────
export default function Hero() {
    return (
        <>
            <HeroHeader />

            <main className="overflow-hidden">
                {/* Subtle diagonal light beams (decorative) */}
                <div
                    aria-hidden
                    className="z-[2] absolute inset-0 pointer-events-none isolate opacity-40 contain-strict hidden lg:block"
                >
                    <div className="w-[35rem] h-[80rem] -translate-y-[350px] absolute left-0 top-0 -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(0,0%,85%,.08)_0,hsla(0,0%,55%,.02)_50%,hsla(0,0%,45%,0)_80%)]" />
                    <div className="h-[80rem] absolute left-0 top-0 w-56 -rotate-45 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.06)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)] [translate:5%_-50%]" />
                    <div className="h-[80rem] -translate-y-[350px] absolute left-0 top-0 w-56 -rotate-45 bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.04)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)]" />
                </div>

                <section>
                    <div className="relative pt-24 md:pt-36">
                        {/* Background radial fade removed completely */}

                        <div className="mx-auto max-w-7xl px-6">
                            <div className="text-center sm:mx-auto lg:mr-auto lg:mt-0">

                                {/* Animated announcement badge + headline + sub-text */}
                                <AnimatedGroup
                                    variants={{
                                        container: {
                                            visible: {
                                                transition: {
                                                    staggerChildren: 0.12,
                                                    delayChildren: 0.3,
                                                },
                                            },
                                        },
                                        ...transitionVariants,
                                    }}
                                >
                                    {/* Pill badge */}
                                    <Link
                                        to="/onboarding"
                                        className="hover:bg-white/5 group mx-auto flex w-fit items-center gap-4 rounded-full border border-white/10 bg-white/[0.04] p-1 pl-4 shadow-md shadow-black/30 transition-all duration-300 backdrop-blur-sm"
                                    >
                                        <span className="text-white/70 text-sm">
                                            🚀 Tu estudio, en piloto automático · Únete a la nueva era
                                        </span>
                                        <span className="block h-4 w-px bg-white/10" />
                                        <div className="bg-white/5 group-hover:bg-white/10 size-6 overflow-hidden rounded-full duration-500">
                                            <div className="flex w-12 -translate-x-1/2 duration-500 ease-in-out group-hover:translate-x-0">
                                                <span className="flex size-6">
                                                    <ArrowRight className="m-auto size-3 text-white" />
                                                </span>
                                                <span className="flex size-6">
                                                    <ArrowRight className="m-auto size-3 text-white" />
                                                </span>
                                            </div>
                                        </div>
                                    </Link>

                                    {/* H1 */}
                                    <h1 className="mt-8 max-w-4xl mx-auto text-balance text-5xl font-semibold md:text-7xl lg:mt-16 xl:text-[5.25rem] text-white leading-[1.05] tracking-tight font-display">
                                        El software que potencia tu estudio de fitness
                                    </h1>

                                    {/* Sub-headline */}
                                    <p className="mx-auto mt-8 max-w-2xl text-balance text-lg text-white/50">
                                        Reservas online, control de acceso QR, facturación fiscal automática y CRM.
                                        Todo en un solo panel. Para Pilates, Yoga, Barre y más en LATAM.
                                    </p>
                                </AnimatedGroup>

                                {/* CTA buttons */}
                                <AnimatedGroup
                                    variants={{
                                        container: {
                                            visible: {
                                                transition: {
                                                    staggerChildren: 0.08,
                                                    delayChildren: 0.7,
                                                },
                                            },
                                        },
                                        ...transitionVariants,
                                    }}
                                    className="mt-12 flex flex-col items-center justify-center gap-3 md:flex-row"
                                >
                                    {/* Primary CTA */}
                                    <div className="bg-white/5 rounded-[14px] border border-white/10 p-0.5">
                                        <Button asChild size="lg" className="rounded-xl px-6 text-base">
                                            <Link to="/onboarding">
                                                <span className="text-nowrap">Empieza ahora</span>
                                            </Link>
                                        </Button>
                                    </div>

                                    {/* Secondary CTA */}
                                    <Button
                                        asChild
                                        size="lg"
                                        variant="ghost"
                                        className="rounded-xl px-6"
                                    >
                                        <a href="#pricing">
                                            <span className="text-nowrap">Ver planes y precios</span>
                                        </a>
                                    </Button>
                                </AnimatedGroup>
                            </div>
                        </div>

                        {/* Product screenshot */}
                        <AnimatedGroup
                            variants={{
                                container: {
                                    visible: {
                                        transition: {
                                            delayChildren: 0.9,
                                        },
                                    },
                                },
                                ...transitionVariants,
                            }}
                        >
                            <div className="relative mt-12 overflow-hidden px-2 sm:mt-16 md:mt-24">
                                {/* Gradient fade removed completely */}
                                <div className="relative mx-auto max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-3 shadow-2xl shadow-black/50 ring-1 ring-white/5 backdrop-blur-sm">
                                    {/* Admin dashboard screenshot */}
                                    <img
                                        className="w-full rounded-xl aspect-[15/8] object-cover object-top border border-white/10"
                                        src="https://tailark.com/_next/image?url=%2Fmail2.png&w=3840&q=75"
                                        alt="Project Studio — dashboard de gestión de studio"
                                        width="2700"
                                        height="1440"
                                        onError={(e) => {
                                            // Fallback: placeholder gradient if image fails
                                            const el = e.currentTarget as HTMLImageElement;
                                            el.style.display = "none";
                                            const sibling = el.nextElementSibling as HTMLElement;
                                            if (sibling) sibling.style.display = "flex";
                                        }}
                                    />
                                    {/* Fallback dashboard preview */}
                                    <div
                                        className="w-full rounded-xl aspect-[15/8] hidden items-center justify-center relative overflow-hidden"
                                        style={{
                                            background: "rgba(0,0,0,0.2)",
                                        }}
                                    >
                                        <style>{`
                                            @keyframes fallback-orbit {
                                                0%   { transform: translate(0, 0) scale(1); }
                                                50%  { transform: translate(10px, -10px) scale(1.1); }
                                                100% { transform: translate(0, 0) scale(1); }
                                            }
                                        `}</style>
                                        <div style={{
                                            position: "absolute",
                                            top: "-20%",
                                            left: "-10%",
                                            width: "70%",
                                            height: "70%",
                                            background: "radial-gradient(circle, rgba(200,110,20,0.15) 0%, transparent 70%)",
                                            filter: "blur(40px)",
                                            animation: "fallback-orbit 10s ease-in-out infinite",
                                        }} />
                                        <div style={{
                                            position: "absolute",
                                            bottom: "-20%",
                                            right: "-10%",
                                            width: "60%",
                                            height: "60%",
                                            background: "radial-gradient(circle, rgba(15,130,130,0.12) 0%, transparent 70%)",
                                            filter: "blur(40px)",
                                            animation: "fallback-orbit 14s ease-in-out infinite reverse",
                                        }} />
                                        
                                        <div className="text-center relative z-10">
                                            <div className="text-4xl mb-4">📊</div>
                                            <p className="text-white font-bold text-xl">Panel de Administración</p>
                                            <p className="text-white/40 text-sm mt-1">Grind Project · Vista en vivo</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </AnimatedGroup>
                    </div>
                </section>

                <section className="py-24">
                    <div className="mx-auto max-w-7xl px-6">
                        <ScrollReveal className="text-center mb-16">
                            <p className="text-white/30 text-sm uppercase tracking-[0.2em] font-bold mb-4">Grind Project</p>
                            <h2 className="text-white text-4xl md:text-5xl font-semibold tracking-tight leading-tight">
                                Diseñado para todo tipo<br />
                                <span className="text-white/40">de estudio</span>
                            </h2>
                        </ScrollReveal>

                        <ImageHaloCarousel
                            images={DISCIPLINE_IMAGES}
                            radiusX={440}
                            radiusZ={340}
                        />

                        <div className="text-center absolute bottom-12 w-full left-0 z-10 pointer-events-none">
                            <a
                                href="#features"
                                className="inline-flex items-center gap-1.5 text-sm text-white/30 hover:text-white/60 transition-colors duration-150 pointer-events-auto"
                            >
                                Ver todas las funciones
                                <ChevronRight className="size-3" />
                            </a>
                        </div>
                    </div>
                </section>
            </main>
        </>
    );
}
