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
                <FeatureCarousel />
                <LogoCloud logos={trustedLogos} />
                <FAQ />
                <CallToAction />
            </div>
        </>
    );
}
