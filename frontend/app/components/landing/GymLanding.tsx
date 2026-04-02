// app/components/landing/GymLanding.tsx
// Orchestrator for the gym subdomain landing page.
// Renders sections dynamically based on the gym's landing_sections config.

import type { GymLandingData } from "~/services/gym-lookup.server";
import { GymLandingHero } from "./gym-landing/GymLandingHero";
import { GymLandingClasses } from "./gym-landing/GymLandingClasses";
import { GymLandingSchedule } from "./gym-landing/GymLandingSchedule";
import { GymLandingCoaches } from "./gym-landing/GymLandingCoaches";
import { GymLandingPricing } from "./gym-landing/GymLandingPricing";
import { GymLandingCTA } from "./gym-landing/GymLandingCTA";
import { GymLandingFooter } from "./gym-landing/GymLandingFooter";

const SECTION_MAP: Record<string, React.FC<{ gym: GymLandingData }>> = {
    hero: GymLandingHero,
    classes: GymLandingClasses,
    schedule: GymLandingSchedule,
    coaches: GymLandingCoaches,
    pricing: GymLandingPricing,
    cta: GymLandingCTA,
};

export default function GymLanding({ gym }: { gym: GymLandingData }) {
    return (
        <div
            className="min-h-screen bg-gray-950 text-white"
            style={{
                "--gym-primary": gym.primary_color,
                "--gym-accent": gym.accent_color,
            } as React.CSSProperties}
        >
            {gym.landing_sections.map((section) => {
                const Component = SECTION_MAP[section];
                return Component ? <Component key={section} gym={gym} /> : null;
            })}
            <GymLandingFooter gym={gym} />
        </div>
    );
}
