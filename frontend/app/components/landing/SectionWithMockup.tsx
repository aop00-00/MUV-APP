import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "~/lib/utils";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// Static styles — no color-mix() (not cacheable), no mix-blend-mode on animated layers
const INJECTED_STYLES = `
  .gsap-reveal { visibility: hidden; }

  /* Promoted GPU layers for elements that animate */
  .hero-text-wrapper,
  .main-card,
  .mockup-scroll-wrapper,
  .cta-wrapper {
    will-change: transform, opacity;
  }

  .bg-grid-theme {
    background-size: 60px 60px;
    background-image:
      linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px);
    mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
    -webkit-mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
  }

  .text-3d-matte {
    color: var(--color-foreground);
    text-shadow: 0 8px 20px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.1);
  }

  /* clip-path reveal is GPU-accelerated */
  .text-silver-matte {
    background: linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.4) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    transform: translateZ(0);
  }

  .text-card-silver-matte {
    background: linear-gradient(180deg, #FFFFFF 0%, #A1A1AA 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    transform: translateZ(0);
  }

  /* Card: no mix-blend-mode on sheen — use opacity only for GPU compositing */
  .premium-depth-card {
    background: linear-gradient(145deg, #162C6D 0%, #0A101D 100%);
    box-shadow:
      0 40px 100px -20px rgba(0,0,0,0.9),
      0 20px 40px -20px rgba(0,0,0,0.8),
      inset 0 1px 2px rgba(255,255,255,0.2),
      inset 0 -2px 4px rgba(0,0,0,0.8);
    border: 1px solid rgba(255,255,255,0.04);
    position: relative;
  }

  /* Sheen: removed mix-blend-mode:screen — it forces software compositing */
  .card-sheen {
    position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: 5;
    background: radial-gradient(600px circle at var(--mouse-x, -999px) var(--mouse-y, -999px), rgba(255,255,255,0.07) 0%, transparent 40%);
    transition: background 0.15s linear;
  }

  .iphone-bezel {
    background-color: #111;
    box-shadow:
      inset 0 0 0 2px #52525B,
      inset 0 0 0 7px #000,
      0 40px 80px -15px rgba(0,0,0,0.9),
      0 15px 25px -5px rgba(0,0,0,0.7);
  }

  .hardware-btn {
    background: linear-gradient(90deg, #404040 0%, #171717 100%);
    box-shadow:
      -2px 0 5px rgba(0,0,0,0.8),
      inset -1px 0 1px rgba(255,255,255,0.15),
      inset 1px 0 2px rgba(0,0,0,0.8);
    border-left: 1px solid rgba(255,255,255,0.05);
  }

  .screen-glare {
    background: linear-gradient(110deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 45%);
    pointer-events: none;
  }

  .widget-depth {
    background: rgba(255,255,255,0.03);
    box-shadow: 0 8px 16px rgba(0,0,0,0.25), inset 0 1px 1px rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.03);
  }

  /* Badges: removed backdrop-filter on elements that animate — extremely expensive */
  .floating-ui-badge {
    background: rgba(15, 20, 40, 0.85);
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.1),
      0 16px 32px -8px rgba(0,0,0,0.7),
      inset 0 1px 1px rgba(255,255,255,0.12);
  }

  .btn-modern-light, .btn-modern-dark {
    transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.3s cubic-bezier(0.25, 1, 0.5, 1);
    will-change: transform;
  }
  .btn-modern-light {
    background: linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 100%);
    color: #0F172A;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.1), 0 12px 24px -4px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,1);
  }
  .btn-modern-light:hover { transform: translateY(-3px); box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 8px 16px -4px rgba(0,0,0,0.2), 0 20px 32px -6px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,1); }
  .btn-modern-light:active { transform: translateY(1px); }
  .btn-modern-dark {
    background: linear-gradient(180deg, #27272A 0%, #18181B 100%);
    color: #FFFFFF;
    box-shadow: 0 0 0 1px rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.6), 0 12px 24px -4px rgba(0,0,0,0.9), inset 0 1px 1px rgba(255,255,255,0.15);
  }
  .btn-modern-dark:hover { transform: translateY(-3px); background: linear-gradient(180deg, #3F3F46 0%, #27272A 100%); box-shadow: 0 0 0 1px rgba(255,255,255,0.15), 0 8px 16px -4px rgba(0,0,0,0.6), 0 20px 32px -6px rgba(0,0,0,0.9), inset 0 1px 1px rgba(255,255,255,0.2); }
  .btn-modern-dark:active { transform: translateY(1px); }

  .progress-ring {
    transform: rotate(-90deg);
    transform-origin: center;
    stroke-dasharray: 402;
    stroke-dashoffset: 402;
    stroke-linecap: round;
    will-change: stroke-dashoffset;
  }
`;

export interface CinematicHeroProps extends React.HTMLAttributes<HTMLDivElement> {
  brandName?: string;
  tagline1?: string;
  tagline2?: string;
  cardHeading?: string;
  cardDescription?: React.ReactNode;
  metricValue?: number;
  metricLabel?: string;
  ctaHeading?: string;
  ctaDescription?: string;
}

export function CinematicHero({
  brandName = "Sobers",
  tagline1 = "Track the journey,",
  tagline2 = "not just the days.",
  cardHeading = "Accountability, redefined.",
  cardDescription = (
    <>
      <span className="text-white font-semibold">Sobers</span> empowers sponsors
      and sponsees in 12-step recovery programs with structured accountability,
      precise sobriety tracking, and beautiful visual timelines.
    </>
  ),
  metricValue = 365,
  metricLabel = "Days Sober",
  ctaHeading = "Start your recovery.",
  ctaDescription = "Join thousands of others in the 12-step program and take control of your timeline today.",
  className,
  ...props
}: CinematicHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCardRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);

  // Mouse tracking: gsap.quickTo creates a cached tween function — no new tween per event
  useEffect(() => {
    if (!mockupRef.current || !mainCardRef.current) return;

    const rotY = gsap.quickTo(mockupRef.current, "rotationY", { duration: 1.0, ease: "power3.out" });
    const rotX = gsap.quickTo(mockupRef.current, "rotationX", { duration: 1.0, ease: "power3.out" });

    const handleMouseMove = (e: MouseEvent) => {
      // Skip if user has scrolled past the hero section
      if (window.scrollY > window.innerHeight * 2) return;

      if (mainCardRef.current) {
        const rect = mainCardRef.current.getBoundingClientRect();
        mainCardRef.current.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
        mainCardRef.current.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
      }

      const xVal = (e.clientX / window.innerWidth - 0.5) * 2;
      const yVal = (e.clientY / window.innerHeight - 0.5) * 2;
      rotY(xVal * 10);
      rotX(-yVal * 10);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Scroll timeline — no blur() animations, only GPU-compositable properties
  useEffect(() => {
    const isMobile = window.innerWidth < 768;

    const ctx = gsap.context(() => {
      // Initial states — no filter:blur(), only opacity/transform
      gsap.set(".text-track", { autoAlpha: 0, y: 50, scale: 0.9 });
      gsap.set(".text-days", { autoAlpha: 1, clipPath: "inset(0 100% 0 0)" });
      gsap.set(".main-card", { y: window.innerHeight + 200, autoAlpha: 1 });
      gsap.set([".card-left-text", ".card-right-text", ".mockup-scroll-wrapper", ".floating-badge", ".phone-widget"], { autoAlpha: 0 });
      gsap.set(".cta-wrapper", { autoAlpha: 0, scale: 0.88 });

      // Intro: simple opacity + y — no rotationX, no blur
      const introTl = gsap.timeline({ delay: 0.3 });
      introTl
        .to(".text-track", { duration: 1.4, autoAlpha: 1, y: 0, scale: 1, ease: "expo.out" })
        .to(".text-days", { duration: 1.2, clipPath: "inset(0 0% 0 0)", ease: "power4.inOut" }, "-=0.8");

      // Scroll timeline — scrub 0.5 is more responsive than 1
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "+=5000",       // reduced from 7000
          pin: true,
          scrub: 0.5,          // snappier than 1
          anticipatePin: 1,
        },
      });

      // Phase 1: hero text fades out (opacity only, no blur), card slides up
      scrollTl
        .to(".hero-text-wrapper", { autoAlpha: 0, y: -30, ease: "power2.inOut", duration: 2 }, 0)
        .to(".bg-grid-theme",     { autoAlpha: 0, scale: 1.08, ease: "power2.inOut", duration: 2 }, 0)
        .to(".main-card",         { y: 0, ease: "power3.inOut", duration: 2 }, 0)

      // Phase 2: card expands — use clip-path instead of width/height (no layout thrashing)
        .to(".main-card", {
          clipPath: "inset(0% 0% 0% 0% round 0px)",
          ease: "power3.inOut",
          duration: 1.5,
        })

      // Phase 3: mockup + content reveal
        .fromTo(".mockup-scroll-wrapper",
          { y: 200, autoAlpha: 0, scale: 0.75 },
          { y: 0, autoAlpha: 1, scale: 1, ease: "expo.out", duration: 2 },
          "-=0.5"
        )
        .fromTo(".phone-widget",
          { y: 30, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, stagger: 0.12, ease: "power3.out", duration: 1.2 },
          "-=1.2"
        )
        .to(".progress-ring",
          { strokeDashoffset: 60, duration: 1.8, ease: "power3.inOut" },
          "-=1.0"
        )
        .to(".counter-val",
          { innerHTML: metricValue, snap: { innerHTML: 1 }, duration: 1.8, ease: "expo.out" },
          "<"
        )
        .fromTo(".floating-badge",
          { y: 60, autoAlpha: 0, scale: 0.85 },
          { y: 0, autoAlpha: 1, scale: 1, ease: "back.out(1.4)", duration: 1.2, stagger: 0.15 },
          "-=1.5"
        )
        .fromTo(".card-left-text",
          { x: -40, autoAlpha: 0 },
          { x: 0, autoAlpha: 1, ease: "power4.out", duration: 1.2 },
          "-=1.2"
        )
        .fromTo(".card-right-text",
          { x: 40, autoAlpha: 0 },
          { x: 0, autoAlpha: 1, ease: "expo.out", duration: 1.2 },
          "<"
        )

      // Phase 4: pause, swap to CTA
        .to({}, { duration: 2 })
        .set(".hero-text-wrapper", { autoAlpha: 0 })
        .set(".cta-wrapper", { autoAlpha: 1 })
        .to({}, { duration: 1 })

      // Phase 5: card content exits, card pulls back
        .to([".mockup-scroll-wrapper", ".floating-badge", ".card-left-text", ".card-right-text"],
          { scale: 0.92, y: -30, autoAlpha: 0, ease: "power2.in", duration: 1, stagger: 0.04 }
        )
        .to(".main-card", {
          clipPath: isMobile
            ? "inset(4% 4% 4% 4% round 32px)"
            : "inset(7.5% 7.5% 7.5% 7.5% round 40px)",
          ease: "expo.inOut",
          duration: 1.6,
        }, "pullback")
        .to(".cta-wrapper", { scale: 1, ease: "expo.inOut", duration: 1.6 }, "pullback")

      // Phase 6: card exits upward
        .to(".main-card", { y: -window.innerHeight - 200, ease: "power3.in", duration: 1.2 });

    }, containerRef);

    return () => ctx.revert();
  }, [metricValue]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-screen h-screen overflow-hidden flex items-center justify-center bg-background text-foreground font-sans antialiased",
        className
      )}
      style={{ perspective: "1200px" }}
      {...props}
    >
      <style dangerouslySetInnerHTML={{ __html: INJECTED_STYLES }} />

      {/* Grid bg — static, no blend mode */}
      <div className="bg-grid-theme absolute inset-0 z-0 pointer-events-none opacity-40" aria-hidden="true" />

      {/* Hero text layer */}
      <div className="hero-text-wrapper absolute z-10 flex flex-col items-center justify-center text-center w-screen px-4">
        <h1 className="text-track gsap-reveal text-3d-matte text-5xl md:text-7xl lg:text-[6rem] font-bold tracking-tight mb-2">
          {tagline1}
        </h1>
        <h1 className="text-days gsap-reveal text-silver-matte text-5xl md:text-7xl lg:text-[6rem] font-extrabold tracking-tighter">
          {tagline2}
        </h1>
      </div>

      {/* CTA layer */}
      <div className="cta-wrapper absolute z-10 flex flex-col items-center justify-center text-center w-screen px-4 gsap-reveal pointer-events-auto">
        <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight text-silver-matte">
          {ctaHeading}
        </h2>
        <p className="text-muted-foreground text-lg md:text-xl mb-12 max-w-xl mx-auto font-light leading-relaxed">
          {ctaDescription}
        </p>
        <div className="flex flex-col sm:flex-row gap-6">
          <a href="#" aria-label="Download on the App Store" className="btn-modern-light flex items-center justify-center gap-3 px-8 py-4 rounded-[1.25rem] group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
            <svg className="w-8 h-8 transition-transform group-hover:scale-105" fill="currentColor" viewBox="0 0 384 512" aria-hidden="true">
              <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
            </svg>
            <div className="text-left">
              <div className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase mb-[-2px]">Download on the</div>
              <div className="text-xl font-bold leading-none tracking-tight">App Store</div>
            </div>
          </a>
          <a href="#" aria-label="Get it on Google Play" className="btn-modern-dark flex items-center justify-center gap-3 px-8 py-4 rounded-[1.25rem] group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-background">
            <svg className="w-7 h-7 transition-transform group-hover:scale-105" fill="currentColor" viewBox="0 0 512 512" aria-hidden="true">
              <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
            </svg>
            <div className="text-left">
              <div className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase mb-[-2px]">Get it on</div>
              <div className="text-xl font-bold leading-none tracking-tight">Google Play</div>
            </div>
          </a>
        </div>
      </div>

      {/* The card */}
      <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ perspective: "1200px" }}>
        <div
          ref={mainCardRef}
          className="main-card premium-depth-card relative overflow-hidden gsap-reveal flex items-center justify-center pointer-events-auto"
          style={{
            width: "92vw",
            height: "92vh",
            borderRadius: "32px",
            clipPath: "inset(0% 0% 0% 0% round 32px)",
          }}
        >
          <div className="card-sheen" aria-hidden="true" />

          <div className="relative w-full h-full max-w-7xl mx-auto px-4 lg:px-12 flex flex-col justify-evenly lg:grid lg:grid-cols-3 items-center lg:gap-8 z-10 py-6 lg:py-0">

            {/* Brand name — right on desktop */}
            <div className="card-right-text gsap-reveal order-1 lg:order-3 flex justify-center lg:justify-end z-20 w-full">
              <h2 className="text-6xl md:text-[6rem] lg:text-[8rem] font-black uppercase tracking-tighter text-card-silver-matte">
                {brandName}
              </h2>
            </div>

            {/* iPhone mockup — center */}
            <div
              className="mockup-scroll-wrapper order-2 lg:order-2 relative w-full h-[380px] lg:h-[600px] flex items-center justify-center z-10"
              style={{ perspective: "1000px" }}
            >
              <div className="relative w-full h-full flex items-center justify-center scale-[0.65] md:scale-[0.85] lg:scale-100">
                <div
                  ref={mockupRef}
                  className="relative w-[280px] h-[580px] rounded-[3rem] iphone-bezel flex flex-col"
                  style={{ transformStyle: "preserve-3d", willChange: "transform" }}
                >
                  {/* Buttons */}
                  <div className="absolute top-[120px] -left-[3px] w-[3px] h-[25px] hardware-btn rounded-l-md" aria-hidden="true" />
                  <div className="absolute top-[160px] -left-[3px] w-[3px] h-[45px] hardware-btn rounded-l-md" aria-hidden="true" />
                  <div className="absolute top-[220px] -left-[3px] w-[3px] h-[45px] hardware-btn rounded-l-md" aria-hidden="true" />
                  <div className="absolute top-[170px] -right-[3px] w-[3px] h-[70px] hardware-btn rounded-r-md scale-x-[-1]" aria-hidden="true" />

                  {/* Screen */}
                  <div className="absolute inset-[7px] bg-[#050914] rounded-[2.5rem] overflow-hidden text-white z-10">
                    <div className="absolute inset-0 screen-glare z-20" aria-hidden="true" />

                    {/* Dynamic Island */}
                    <div className="absolute top-[5px] left-1/2 -translate-x-1/2 w-[100px] h-[28px] bg-black rounded-full z-30 flex items-center justify-end px-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.8)] animate-pulse" />
                    </div>

                    {/* App UI */}
                    <div className="relative w-full h-full pt-12 px-5 pb-8 flex flex-col">
                      <div className="phone-widget flex justify-between items-center mb-8">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mb-1">Today</span>
                          <span className="text-xl font-bold tracking-tight text-white">Journey</span>
                        </div>
                        <div className="w-9 h-9 rounded-full bg-white/5 text-neutral-200 flex items-center justify-center font-bold text-sm border border-white/10">
                          JS
                        </div>
                      </div>

                      <div className="phone-widget relative w-44 h-44 mx-auto flex items-center justify-center mb-8">
                        <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
                          <circle cx="88" cy="88" r="64" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="12" />
                          <circle className="progress-ring" cx="88" cy="88" r="64" fill="none" stroke="#3B82F6" strokeWidth="12" />
                        </svg>
                        <div className="text-center z-10 flex flex-col items-center">
                          <span className="counter-val text-4xl font-extrabold tracking-tighter text-white">0</span>
                          <span className="text-[8px] text-blue-200/50 uppercase tracking-[0.1em] font-bold mt-0.5">{metricLabel}</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="phone-widget widget-depth rounded-2xl p-3 flex items-center">
                          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mr-3 border border-blue-400/20">
                            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div className="h-2 w-20 bg-neutral-600 rounded-full mb-2" />
                            <div className="h-1.5 w-12 bg-neutral-700 rounded-full" />
                          </div>
                        </div>
                        <div className="phone-widget widget-depth rounded-2xl p-3 flex items-center">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mr-3 border border-emerald-400/20">
                            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div className="h-2 w-16 bg-neutral-600 rounded-full mb-2" />
                            <div className="h-1.5 w-24 bg-neutral-700 rounded-full" />
                          </div>
                        </div>
                      </div>

                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[120px] h-[4px] bg-white/20 rounded-full" />
                    </div>
                  </div>
                </div>

                {/* Floating Badges — static during scroll, only fade in */}
                <div className="floating-badge absolute top-6 lg:top-12 left-[-15px] lg:left-[-80px] floating-ui-badge rounded-xl lg:rounded-2xl p-3 lg:p-4 flex items-center gap-3 lg:gap-4 z-30">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-400/30">
                    <span className="text-base lg:text-xl" aria-hidden="true">🔥</span>
                  </div>
                  <div>
                    <p className="text-white text-xs lg:text-sm font-bold tracking-tight">1 Year Streak</p>
                    <p className="text-blue-200/50 text-[10px] lg:text-xs font-medium">Milestone unlocked</p>
                  </div>
                </div>

                <div className="floating-badge absolute bottom-12 lg:bottom-20 right-[-15px] lg:right-[-80px] floating-ui-badge rounded-xl lg:rounded-2xl p-3 lg:p-4 flex items-center gap-3 lg:gap-4 z-30">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-400/30">
                    <span className="text-base lg:text-lg" aria-hidden="true">🤝</span>
                  </div>
                  <div>
                    <p className="text-white text-xs lg:text-sm font-bold tracking-tight">Sponsor Update</p>
                    <p className="text-blue-200/50 text-[10px] lg:text-xs font-medium">Shared successfully</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Description text — left on desktop */}
            <div className="card-left-text gsap-reveal order-3 lg:order-1 flex flex-col justify-center text-center lg:text-left z-20 w-full px-4 lg:px-0">
              <h3 className="text-white text-2xl md:text-3xl lg:text-4xl font-bold mb-0 lg:mb-5 tracking-tight">
                {cardHeading}
              </h3>
              <p className="hidden md:block text-blue-100/70 text-sm md:text-base lg:text-lg font-normal leading-relaxed mx-auto lg:mx-0 max-w-sm lg:max-w-none">
                {cardDescription}
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default CinematicHero;
