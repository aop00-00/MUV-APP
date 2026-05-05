// app/components/landing/SaasLanding.tsx
// Marketing landing page for the SaaS product (grindproject.com).
// Extracted from _index.tsx to allow conditional rendering with GymLanding.


import ParticleBackground from "./ParticleBackground";
import Hero from "./Hero";
import Features from "./Features";
import Process from "./Process";
import Testimonials from "./Testimonials";
import Pricing from "./Pricing";
import { FeatureCarousel } from "~/components/ui/feature-carousel";
import { LogoCloud } from "./LogoCloud";
import FAQ from "./FAQ";
import CallToAction from "./CallToAction";

const studioLogos = [
    { src: "/images/landing/logos/logo-yoga.png", alt: "Zenith Yoga" },
    { src: "/images/landing/logos/logo-crossfit.png", alt: "Iron Forge" },
    { src: "/images/landing/logos/logo-pilates.png", alt: "Serene Pilates" },
    { src: "/images/landing/logos/logo-cycling.png", alt: "Pulse Cycling" },
    { src: "/images/landing/logos/logo-boxing.png", alt: "Apex Boxing" },
    { src: "/images/landing/logos/logo-barre.png", alt: "Flow Barre" },
    { src: "/images/landing/logos/logo-hiit.png", alt: "Velocity HIIT" },
    { src: "/images/landing/logos/logo-yoga.png", alt: "Soul Yoga" },
    { src: "/images/landing/logos/logo-crossfit.png", alt: "Titan Strength" },
    { src: "/images/landing/logos/logo-pilates.png", alt: "Core Balance" },
];

export default function SaasLanding() {
    return (
        <>
            <ParticleBackground />
            <div className="text-white" style={{ position: "relative", zIndex: 1 }}>
                <Hero />
                <Features />
                <Process />
                <Testimonials />
                <Pricing />
                <FeatureCarousel />
                <LogoCloud logos={studioLogos} />
                <FAQ />
                <CallToAction />
            </div>
        </>
    );
}
