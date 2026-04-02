// app/components/landing/gym-landing/GymLandingHero.tsx
import React from "react";
import { Menu, X, MapPin, Instagram } from "lucide-react";
import type { GymLandingData } from "~/services/gym-lookup.server";

const navItems = [
    { name: "Clases", href: "#classes" },
    { name: "Horarios", href: "#schedule" },
    { name: "Coaches", href: "#coaches" },
    { name: "Planes", href: "#pricing" },
];

export function GymLandingHero({ gym }: { gym: GymLandingData }) {
    const [menuOpen, setMenuOpen] = React.useState(false);
    const [scrolled, setScrolled] = React.useState(false);

    React.useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <section id="hero" className="relative">
            {/* Navbar */}
            <nav
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
                    scrolled ? "bg-black/80 backdrop-blur-lg shadow-lg" : "bg-transparent"
                }`}
            >
                <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
                    {/* Logo */}
                    <a href="#hero" className="flex items-center gap-3">
                        {gym.logo_url ? (
                            <img src={gym.logo_url} alt={gym.name} className="h-10 w-10 rounded-xl object-cover" />
                        ) : (
                            <div
                                className="h-10 w-10 rounded-xl flex items-center justify-center text-xl font-black text-white"
                                style={{ backgroundColor: gym.primary_color }}
                            >
                                {gym.name.charAt(0)}
                            </div>
                        )}
                        <span className="text-white font-bold text-lg tracking-tight">{gym.name}</span>
                    </a>

                    {/* Desktop nav */}
                    <div className="hidden md:flex items-center gap-8">
                        {navItems.map((item) => (
                            <a
                                key={item.href}
                                href={item.href}
                                className="text-white/60 hover:text-white text-sm font-medium transition-colors"
                            >
                                {item.name}
                            </a>
                        ))}
                        <a
                            href="#cta"
                            className="px-5 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                            style={{ backgroundColor: gym.primary_color }}
                        >
                            Reservar
                        </a>
                    </div>

                    {/* Mobile toggle */}
                    <button
                        className="md:hidden text-white"
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
                    >
                        {menuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
                    </button>
                </div>

                {/* Mobile dropdown */}
                {menuOpen && (
                    <div className="md:hidden bg-black/95 backdrop-blur-lg border-t border-white/10 px-6 py-6 space-y-4">
                        {navItems.map((item) => (
                            <a
                                key={item.href}
                                href={item.href}
                                className="block text-white/70 hover:text-white text-base font-medium"
                                onClick={() => setMenuOpen(false)}
                            >
                                {item.name}
                            </a>
                        ))}
                        <a
                            href="#cta"
                            className="block text-center px-5 py-3 rounded-xl text-sm font-bold text-white"
                            style={{ backgroundColor: gym.primary_color }}
                            onClick={() => setMenuOpen(false)}
                        >
                            Reservar
                        </a>
                    </div>
                )}
            </nav>

            {/* Hero content */}
            <div className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
                {/* Background image or gradient */}
                {gym.hero_image_url ? (
                    <>
                        <img
                            src={gym.hero_image_url}
                            alt={gym.name}
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-gray-950" />
                    </>
                ) : (
                    <div
                        className="absolute inset-0"
                        style={{
                            background: `radial-gradient(ellipse at 30% 20%, ${gym.primary_color}25 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, ${gym.accent_color}20 0%, transparent 50%), #0a0a0a`,
                        }}
                    />
                )}

                <div className="relative z-10 text-center px-6 max-w-4xl mx-auto pt-24">
                    {gym.logo_url && (
                        <img
                            src={gym.logo_url}
                            alt={gym.name}
                            className="w-20 h-20 rounded-2xl mx-auto mb-6 object-cover shadow-2xl"
                        />
                    )}
                    <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white leading-[1.05]">
                        {gym.name}
                    </h1>
                    {gym.tagline && (
                        <p className="mt-4 text-xl md:text-2xl text-white/60 font-medium max-w-2xl mx-auto">
                            {gym.tagline}
                        </p>
                    )}
                    {gym.description && (
                        <p className="mt-4 text-white/40 max-w-xl mx-auto">
                            {gym.description}
                        </p>
                    )}

                    <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                        <a
                            href="#schedule"
                            className="px-8 py-4 rounded-xl text-white font-bold text-base transition-all hover:opacity-90 shadow-lg"
                            style={{ backgroundColor: gym.primary_color }}
                        >
                            Ver Horarios
                        </a>
                        <a
                            href="#cta"
                            className="px-8 py-4 rounded-xl text-white/80 font-bold text-base border border-white/20 hover:border-white/40 transition-all"
                        >
                            Crear mi cuenta
                        </a>
                    </div>

                    {/* Location badge */}
                    {(gym.address || gym.city) && (
                        <div className="mt-8 inline-flex items-center gap-2 text-white/40 text-sm">
                            <MapPin className="size-4" />
                            <span>{[gym.address, gym.city].filter(Boolean).join(", ")}</span>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
