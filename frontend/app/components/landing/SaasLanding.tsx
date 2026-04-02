// app/components/landing/SaasLanding.tsx
// Marketing landing page for the SaaS product (grindproject.com).
// Extracted from _index.tsx to allow conditional rendering with GymLanding.

import { ArrowRight } from "lucide-react";
import ParticleBackground from "./ParticleBackground";
import Hero from "./Hero";
import Features from "./Features";
import Process from "./Process";
import Testimonials from "./Testimonials";
import Pricing from "./Pricing";
import SectionWithMockup from "./SectionWithMockup";
import { LogoCloud } from "./LogoCloud";
import FAQ from "./FAQ";
import CallToAction from "./CallToAction";

const trustedLogos = [
    { src: "/images/landing/logo-apple.svg", alt: "Apple" },
    { src: "/images/landing/logo-spotify.svg", alt: "Spotify" },
    { src: "/images/landing/logo-nike.svg", alt: "Nike" },
    { src: "/images/landing/logo-amazon.svg", alt: "Amazon" },
    { src: "/images/landing/logo-google.svg", alt: "Google" },
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
                <SectionWithMockup
                    title={
                        <>
                            Control total desde tu <span className="text-white/50">centro de mando</span>
                        </>
                    }
                    description="Visualiza el estado de tu estudio en tiempo récord. Gestiona miembros activos, ingresos, métricas de MRR y tu pipeline de CRM en una interfaz diseñada para la velocidad."
                    primaryImageSrc="/images/landing/dashboard-mockup.png"
                    secondaryImageSrc="/images/landing/dashboard-mockup.png"
                />
                <LogoCloud logos={trustedLogos} />
                <FAQ />
                <CallToAction />
            </div>
        </>
    );
}
