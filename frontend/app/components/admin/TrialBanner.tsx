// app/components/admin/TrialBanner.tsx
// Banner shown in admin layout during the 7-day free trial period.

import { Link } from "react-router";
import { Clock, ArrowRight } from "lucide-react";

interface TrialBannerProps {
    daysLeft: number;
}

export function TrialBanner({ daysLeft }: TrialBannerProps) {
    const text = `PERIODO DE PRUEBA / ${daysLeft} DIAS RESTANTES /`;

    const BannerContent = () => (
        <div className="flex items-center gap-10 shrink-0 h-full">
            <span className="text-[10px] font-black tracking-[0.3em] uppercase text-white/40 font-display">
                {text}
            </span>
        </div>
    );

    return (
        <div
            className="w-full bg-white/5 backdrop-blur-md border-b border-white/10 flex items-center overflow-hidden whitespace-nowrap h-9 relative z-50"
            style={{ "--duration": "80s", "--gap": "40px" } as React.CSSProperties}
        >
            <div className="flex animate-marquee h-full items-center">
                {Array.from({ length: 12 }).map((_, i) => <BannerContent key={i} />)}
            </div>
            {/* Second copy for seamless loop */}
            <div className="flex animate-marquee h-full items-center" aria-hidden="true">
                {Array.from({ length: 12 }).map((_, i) => <BannerContent key={i} />)}
            </div>
        </div>
    );
}
