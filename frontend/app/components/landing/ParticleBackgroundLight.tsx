// app/components/landing/ParticleBackgroundLight.tsx
import React from "react";

// Animated aurora/orb background — slow-moving blurred gradient blobs.
// This is the LIGHT version, using white background and dark/grayscale orbs.
// Uses CSS @keyframes via injected <style> for GPU-smooth animation.
// position:fixed at z-index:0 so it ALWAYS renders below all content.

export default function ParticleBackgroundLight() {
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
                    position: "fixed",
                    inset: 0,
                    zIndex: 0,
                    overflow: "hidden",
                    background: "#ffffff", // Pure white background
                    pointerEvents: "none",
                }}
            >
                {/* Orb 1 — Dark Gray — top-left */}
                <div style={{
                    position: "absolute",
                    top: "-5%",
                    left: "-10%",
                    width: "60vw",
                    height: "60vw",
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.10) 45%, transparent 70%)",
                    filter: "blur(30px)",
                    animation: "orbit1 12s ease-in-out infinite",
                    willChange: "transform",
                }} />

                {/* Orb 2 — Darker Gray — top-right */}
                <div style={{
                    position: "absolute",
                    top: "-20%",
                    right: "-15%",
                    width: "65vw",
                    height: "65vw",
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.08) 45%, transparent 70%)",
                    filter: "blur(35px)",
                    animation: "orbit2 15s ease-in-out infinite",
                    willChange: "transform",
                }} />

                {/* Orb 3 — Medium Gray — bottom-left */}
                <div style={{
                    position: "absolute",
                    bottom: "-15%",
                    left: "5%",
                    width: "55vw",
                    height: "55vw",
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(0,0,0,0.23) 0%, rgba(0,0,0,0.07) 45%, transparent 70%)",
                    filter: "blur(38px)",
                    animation: "orbit3 13s ease-in-out infinite",
                    willChange: "transform",
                }} />

                {/* Orb 4 — Charcoal — bottom-right */}
                <div style={{
                    position: "absolute",
                    bottom: "0%",
                    right: "-10%",
                    width: "50vw",
                    height: "50vw",
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.12) 45%, transparent 70%)",
                    filter: "blur(35px)",
                    animation: "orbit4 18s ease-in-out infinite",
                    willChange: "transform",
                }} />
            </div>
        </>
    );
}
