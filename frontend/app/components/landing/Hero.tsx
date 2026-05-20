import React from "react";
import { Link } from "react-router";
import { ArrowRightIcon, ChevronRight, Menu, X, PhoneCallIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { AnimatedGroup } from "~/components/ui/animated-group";
import { ScrollReveal } from "~/components/ui/scroll-reveal";
import { cn } from "~/lib/utils";
import ImageHaloCarousel from "./ImageHaloCarousel";

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
    <div className={cn("relative flex items-center h-8 w-32", className)}>
        <img
            src="/images/logo-white.png"
            alt="Project Studio"
            className="absolute left-0 top-1/2 -translate-y-1/2 h-28 w-auto object-contain max-w-none"
        />
    </div>
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

// ── c───────────────────────────────
const DISCIPLINE_IMAGES = [
    { id: 1, src: "/images/landing/pilates.png", label: "Pilates", alt: "Pilates studio" },
    { id: 2, src: "/images/landing/yoga.png", label: "Yoga", alt: "Yoga session" },
    { id: 3, src: "/images/landing/barre.png", label: "Barre", alt: "Barre studio" },
    { id: 4, src: "/images/landing/crossfit.png", label: "CrossFit", alt: "CrossFit training" },
    { id: 5, src: "/images/landing/hiit.png", label: "Funcional & HIIT", alt: "HIIT session" },
    { id: 7, src: "/images/landing/artes_marciales.png", label: "Artes Marciales", alt: "Martial arts dojo" },
    { id: 8, src: "/images/landing/dance.png", label: "Dance Studio", alt: "Dance practice" },
];

// ── Fade-in wrapper for individual mockup cards ───────────────────
function MockupFade({
    children,
    delay = 0,
    className,
}: {
    children: React.ReactNode;
    delay?: number;
    className?: string;
}) {
    const ref = React.useRef<HTMLDivElement>(null);
    const [visible, setVisible] = React.useState(false);

    React.useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
            { threshold: 0.1 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            className={className}
            style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(24px)",
                filter: visible ? "blur(0px)" : "blur(6px)",
                transition: "opacity 0.8s ease, transform 0.8s ease, filter 0.8s ease",
                transitionDelay: `${delay}ms`,
            }}
        >
            {children}
        </div>
    );
}

// ── Main Hero section ─────────────────────────────────────────────
export default function Hero() {
    return (
        <>
            <HeroHeader />

            <main className="overflow-hidden">
                <section className="mx-auto w-full max-w-6xl pt-32 md:pt-40 px-6">
                    {/* Radial background shade */}
                    <div aria-hidden="true" className="absolute inset-0 size-full overflow-hidden pointer-events-none">
                        <div className="absolute inset-0 isolate -z-10 bg-[radial-gradient(20%_80%_at_20%_0%,rgba(255,255,255,0.07),transparent)]" />
                    </div>

                    {/* Left-aligned text content — staggered entrance */}
                    <AnimatedGroup
                        className="relative z-10 flex max-w-2xl flex-col gap-5"
                        delayMs={200}
                        staggerMs={120}
                    >
                        {/* Badge */}
                        <Link
                            to="/onboarding"
                            className="group flex w-fit items-center gap-3 rounded-sm border border-white/10 bg-white/[0.04] p-1 shadow-sm transition-all"
                        >
                            <div className="rounded-sm border border-white/10 bg-white/5 px-1.5 py-0.5 shadow-sm">
                                <p className="font-mono text-xs text-white/60">NUEVO</p>
                            </div>
                            <span className="text-xs text-white/60">Tu estudio, en piloto automático · Únete a la nueva era</span>
                            <span className="block h-5 border-l border-white/10" />
                            <div className="pr-1">
                                <ArrowRightIcon className="size-3 text-white/50 -translate-x-0.5 duration-150 ease-out group-hover:translate-x-0.5" />
                            </div>
                        </Link>

                        {/* H1 */}
                        <h1 className="text-balance font-semibold text-4xl text-white leading-tight md:text-5xl xl:text-6xl tracking-tight">
                            El software que potencia tu estudio de fitness
                        </h1>

                        {/* Sub-headline */}
                        <p className="text-white/50 text-sm tracking-wide sm:text-lg">
                            Reservas online, control de acceso QR, facturación fiscal automática y CRM.
                            <br />
                            Todo en un solo panel. Para Pilates, Yoga, Barre y más en LATAM.
                        </p>

                        {/* CTA buttons */}
                        <div className="flex w-fit items-center gap-3 pt-2">
                            <Button asChild variant="outline" size="lg" className="rounded-xl">
                                <Link to="/auth/login">
                                    <PhoneCallIcon className="size-4 mr-2" />
                                    Ingresar
                                </Link>
                            </Button>
                            <Button asChild size="lg" className="rounded-xl">
                                <Link to="/onboarding">
                                    Empieza ahora
                                    <ArrowRightIcon className="size-4 ml-2" />
                                </Link>
                            </Button>
                        </div>
                    </AnimatedGroup>

                    {/* Split-view mockups (PC & Mobile) */}
                    <div className="relative mt-16 md:mt-24">
                        {/* Radial glow behind mockups */}
                        <div
                            aria-hidden="true"
                            className={cn(
                                "absolute -inset-x-20 inset-y-0 -translate-y-1/3 scale-125 rounded-full pointer-events-none",
                                "bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.06),transparent,transparent)]",
                                "blur-[50px]"
                            )}
                        />

                        <div className="flex flex-col md:flex-row gap-8 items-end">
                            {/* Left: Admin / PC */}
                            <MockupFade
                                delay={600}
                                className="flex-[1.2] bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6 backdrop-blur-md shadow-2xl relative order-2 md:order-1"
                            >
                                <div className="absolute -top-4 left-6 bg-[#111] border border-white/10 text-white/70 text-xs px-3 py-1 rounded-full z-20">
                                    Vista del Admin
                                </div>
                                <div className="relative aspect-video rounded-xl overflow-hidden bg-black/20 border border-white/5">
                                    <video
                                        src="/video-hero.mp4"
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                            </MockupFade>

                            {/* Right: Member / Mobile */}
                            <MockupFade
                                delay={800}
                                className="w-full md:w-[260px] bg-black border-4 border-white/20 rounded-[40px] p-2 shadow-2xl relative z-10 mx-auto md:mx-0 order-1 md:order-2 flex-shrink-0"
                            >
                                <div className="absolute -top-4 right-10 md:-right-4 bg-blue-600 text-white text-xs px-3 py-1 rounded-full shadow-lg z-20">
                                    Vista del usuario
                                </div>
                                <div className="bg-[#0a0a0a] w-full h-[480px] rounded-[32px] overflow-hidden relative border border-white/5">
                                    <video
                                        src="/video-movil.mp4"
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                            </MockupFade>
                        </div>
                    </div>
                </section>

                {/* Disciplines carousel section */}
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
