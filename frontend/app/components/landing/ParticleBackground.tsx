// app/components/landing/ParticleBackground.tsx
import React from "react";

// Animated aurora/orb background — slow-moving blurred gradient blobs.
// Uses CSS @keyframes via injected <style> for GPU-smooth animation.
// position:fixed at z-index:-1 so it ALWAYS renders below all content.

interface ParticleBackgroundProps {
    isAbsolute?: boolean;
    transparent?: boolean;
}

export default function ParticleBackground({ isAbsolute = false, transparent = false }: ParticleBackgroundProps) {
    return (
        <>
            <style>{`
                @keyframes orbit1 {
                    0%   { transform: translate(0%, 0%)    scale(1);    }
                    25%  { transform: translate(20%, -15%) scale(1.08); }
                    50%  { transform: translate(10%, 25%)  scale(0.95); }
                    75%  { transform: translate(-15%, 10%) scale(1.05); }
                    100% { transform: translate(0%, 0%)    scale(1);    }
                }
                @keyframes orbit2 {
                    0%   { transform: translate(0%, 0%)    scale(1);    }
                    30%  { transform: translate(-20%, 20%) scale(1.1);  }
                    60%  { transform: translate(15%, -10%) scale(0.92); }
                    90%  { transform: translate(-5%, -20%) scale(1.06); }
                    100% { transform: translate(0%, 0%)    scale(1);    }
                }
                @keyframes orbit3 {
                    0%   { transform: translate(0%, 0%)    scale(1);    }
                    35%  { transform: translate(25%, 10%)  scale(0.9);  }
                    65%  { transform: translate(-10%, 30%) scale(1.12); }
                    100% { transform: translate(0%, 0%)    scale(1);    }
                }
                @keyframes orbit4 {
                    0%   { transform: translate(0%, 0%)     scale(1);    }
                    40%  { transform: translate(-25%, -15%) scale(1.08); }
                    80%  { transform: translate(20%, 20%)   scale(0.94); }
                    100% { transform: translate(0%, 0%)     scale(1);    }
                }
            `}</style>

            <div
                aria-hidden="true"
                style={{
                    position: isAbsolute ? "absolute" : "fixed",
                    inset: 0,
                    zIndex: 0,
                    overflow: "hidden",
                    background: transparent ? "transparent" : "#050505",
                    pointerEvents: "none",
                }}
            >
                {/* Orb 1 — warm amber/orange — top-left */}
                <div style={{
                    position: "absolute",
                    top: "-5%",
                    left: "-10%",
                    width: "60vw",
                    height: "60vw",
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(200,110,20,0.45) 0%, rgba(150,70,10,0.2) 45%, transparent 70%)",
                    filter: "blur(35px)",
                    animation: "orbit1 12s ease-in-out infinite",
                    willChange: "transform",
                }} />

                {/* Orb 2 — teal/cyan — top-right */}
                <div style={{
                    position: "absolute",
                    top: "-20%",
                    right: "-15%",
                    width: "65vw",
                    height: "65vw",
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(15,130,130,0.4) 0%, rgba(10,90,95,0.18) 45%, transparent 70%)",
                    filter: "blur(40px)",
                    animation: "orbit2 15s ease-in-out infinite",
                    willChange: "transform",
                }} />

                {/* Orb 3 — muted green — bottom-left */}
                <div style={{
                    position: "absolute",
                    bottom: "-15%",
                    left: "5%",
                    width: "55vw",
                    height: "55vw",
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(25,110,75,0.38) 0%, rgba(15,75,50,0.16) 45%, transparent 70%)",
                    filter: "blur(45px)",
                    animation: "orbit3 13s ease-in-out infinite",
                    willChange: "transform",
                }} />

                {/* Orb 4 — deep copper/rust — bottom-right */}
                <div style={{
                    position: "absolute",
                    bottom: "0%",
                    right: "-10%",
                    width: "50vw",
                    height: "50vw",
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(160,80,20,0.38) 0%, rgba(110,50,10,0.15) 45%, transparent 70%)",
                    filter: "blur(42px)",
                    animation: "orbit4 18s ease-in-out infinite",
                    willChange: "transform",
                }} />
            </div>
        </>
    );
}
