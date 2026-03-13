// app/routes/_index.tsx
import type { MetaFunction } from "react-router";
import ParticleBackground from "../components/landing/ParticleBackground";
import Hero from "../components/landing/Hero";
import Features from "../components/landing/Features";
import Process from "../components/landing/Process";
import Testimonials from "../components/landing/Testimonials";
import Pricing from "../components/landing/Pricing";
import FAQ from "../components/landing/FAQ";
import CallToAction from "../components/landing/CallToAction";

export const meta: MetaFunction = () => {
    return [
        { title: "Project Studio – Software para estudios de Pilates, Yoga y Barre" },
        {
            name: "description",
            content:
                "Reservas online, control de acceso QR, facturación CFDI/AFIP/SII automática y CRM de leads. El software SaaS para estudios boutique de fitness en Latinoamérica.",
        },
    ];
};

export default function Index() {
    return (
        <>
            {/* Aurora orb background — position:fixed z-index:-1, always behind content */}
            <ParticleBackground />

            {/* Content sits at z-index:1, above the fixed background */}
            <div className="text-white" style={{ position: "relative", zIndex: 1 }}>
                <Hero />
                <Features />
                <Process />
                <Testimonials />
                <Pricing />
                <FAQ />
                <CallToAction />
            </div>
        </>
    );
}
