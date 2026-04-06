// app/components/ui/feature-carousel.tsx

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  QrCodeIcon,
  UserMultiple02Icon,
  Calendar03Icon,
  Store01Icon,
  UserSearch01Icon,
  BarChartIcon,
  CreditCardIcon,
  SmartPhone01Icon,
  Award01Icon,
  Invoice03Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "~/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";

const FEATURES = [
  {
    id: "checkin",
    label: "Check-in QR",
    icon: QrCodeIcon,
    image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=1200",
    description: "Acceso rápido y seguro con código QR dinámico de 30 segundos.",
  },
  {
    id: "members",
    label: "Membresías",
    icon: UserMultiple02Icon,
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1200",
    description: "Gestiona alumnos, planes y renovaciones automáticas.",
  },
  {
    id: "schedule",
    label: "Calendario",
    icon: Calendar03Icon,
    image: "https://images.unsplash.com/photo-1571731956672-f2b94d7dd0cb?q=80&w=1200",
    description: "Programa clases y gestiona aforo en tiempo real.",
  },
  {
    id: "pos",
    label: "Punto de Venta",
    icon: Store01Icon,
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=1200",
    description: "Vende suplementos, bebidas y paquetes desde recepción.",
  },
  {
    id: "crm",
    label: "CRM de Leads",
    icon: UserSearch01Icon,
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=1200",
    description: "Convierte prospectos en socios con seguimiento automático.",
  },
  {
    id: "analytics",
    label: "Reportes",
    icon: BarChartIcon,
    image: "https://images.unsplash.com/photo-1551288049-bbda38a10ad5?q=80&w=1200",
    description: "KPIs financieros y de operación en un solo vistazo.",
  },
  {
    id: "payments",
    label: "Pagos Online",
    icon: CreditCardIcon,
    image: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?q=80&w=1200",
    description: "Cobra con Mercado Pago, tarjeta o efectivo sin fricción.",
  },
  {
    id: "app",
    label: "App del Alumno",
    icon: SmartPhone01Icon,
    image: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=1200",
    description: "Portal móvil para reservas, historial y FitCoins.",
  },
  {
    id: "fitcoins",
    label: "FitCoins",
    icon: Award01Icon,
    image: "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?q=80&w=1200",
    description: "Programa de lealtad que retiene y premia a tus socios.",
  },
  {
    id: "invoicing",
    label: "Facturación",
    icon: Invoice03Icon,
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=1200",
    description: "CFDI automático y reportes fiscales sin complicaciones.",
  },
];

const AUTO_PLAY_INTERVAL = 3000;
const ITEM_HEIGHT = 65;

const wrap = (min: number, max: number, v: number) => {
  const rangeSize = max - min;
  return ((((v - min) % rangeSize) + rangeSize) % rangeSize) + min;
};

export function FeatureCarousel() {
  const [step, setStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const currentIndex =
    ((step % FEATURES.length) + FEATURES.length) % FEATURES.length;

  const nextStep = useCallback(() => {
    setStep((prev) => prev + 1);
  }, []);

  const prevStep = useCallback(() => {
    setStep((prev) => prev - 1);
  }, []);

  const handleChipClick = (index: number) => {
    const diff = (index - currentIndex + FEATURES.length) % FEATURES.length;
    if (diff > 0) setStep((s) => s + diff);
  };

  const handlePrev = () => {
    prevStep();
    setIsPaused(true);
  };

  const handleNext = () => {
    nextStep();
    setIsPaused(true);
  };

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(nextStep, AUTO_PLAY_INTERVAL);
    return () => clearInterval(interval);
  }, [nextStep, isPaused]);

  const getCardStatus = (index: number) => {
    const diff = index - currentIndex;
    const len = FEATURES.length;

    let normalizedDiff = diff;
    if (diff > len / 2) normalizedDiff -= len;
    if (diff < -len / 2) normalizedDiff += len;

    if (normalizedDiff === 0) return "active";
    if (normalizedDiff === -1) return "prev";
    if (normalizedDiff === 1) return "next";
    return "hidden";
  };

  return (
    <div className="w-full max-w-7xl mx-auto md:p-8">
      <div className="relative overflow-hidden rounded-[2.5rem] lg:rounded-[4rem] flex flex-col lg:flex-row min-h-[600px] lg:aspect-video border border-border/40">

        {/* LEFT: Scrolling pill selector */}
        <div
          className="w-full lg:w-[40%] min-h-[350px] md:min-h-[450px] lg:h-full relative z-30 flex flex-col items-start justify-center overflow-hidden px-8 md:px-16 lg:pl-16 border-r border-white/10"
          style={{
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          }}
        >
          <div className="absolute inset-x-0 top-0 h-12 md:h-20 lg:h-16 bg-gradient-to-b from-black/20 to-transparent z-40" />
          <div className="absolute inset-x-0 bottom-0 h-12 md:h-20 lg:h-16 bg-gradient-to-t from-black/20 to-transparent z-40" />

          <div className="relative w-full h-full flex items-center justify-center lg:justify-start z-20">
            {FEATURES.map((feature, index) => {
              const isActive = index === currentIndex;
              const distance = index - currentIndex;
              const wrappedDistance = wrap(
                -(FEATURES.length / 2),
                FEATURES.length / 2,
                distance
              );

              return (
                <motion.div
                  key={feature.id}
                  style={{ height: ITEM_HEIGHT, width: "fit-content" }}
                  animate={{
                    y: wrappedDistance * ITEM_HEIGHT,
                    opacity: 1 - Math.abs(wrappedDistance) * 0.25,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 90,
                    damping: 22,
                    mass: 1,
                  }}
                  className="absolute flex items-center justify-start"
                >
                  <button
                    onClick={() => handleChipClick(index)}
                    onMouseEnter={() => setIsPaused(true)}
                    onMouseLeave={() => setIsPaused(false)}
                    className={cn(
                      "relative flex items-center gap-4 px-6 md:px-10 lg:px-8 py-3.5 md:py-5 lg:py-4 rounded-full transition-all duration-700 text-left group border",
                      isActive
                        ? "bg-white/15 text-white border-white/40 z-10 backdrop-blur-sm"
                        : "bg-transparent text-white/50 border-white/15 hover:border-white/30 hover:text-white/80"
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center justify-center transition-colors duration-500",
                        isActive ? "text-white" : "text-white/35"
                      )}
                    >
                      <HugeiconsIcon icon={feature.icon} size={18} strokeWidth={2} />
                    </div>
                    <span className="font-normal text-sm md:text-[15px] tracking-tight whitespace-nowrap uppercase">
                      {feature.label}
                    </span>
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Stacked image cards */}
        <div className="flex-1 min-h-[500px] md:min-h-[600px] lg:h-full relative bg-secondary/30 flex flex-col items-center justify-center py-16 md:py-24 lg:py-16 px-6 md:px-12 lg:px-10 overflow-hidden border-t lg:border-t-0 lg:border-l border-border/20 gap-6">
          <div className="relative w-full max-w-[420px] aspect-[4/5] flex items-center justify-center">
            {FEATURES.map((feature, index) => {
              const status = getCardStatus(index);
              const isActive = status === "active";
              const isPrev = status === "prev";
              const isNext = status === "next";

              return (
                <motion.div
                  key={feature.id}
                  initial={false}
                  animate={{
                    x: isActive ? 0 : isPrev ? -100 : isNext ? 100 : 0,
                    scale: isActive ? 1 : isPrev || isNext ? 0.85 : 0.7,
                    opacity: isActive ? 1 : isPrev || isNext ? 0.4 : 0,
                    rotate: isPrev ? -3 : isNext ? 3 : 0,
                    zIndex: isActive ? 20 : isPrev || isNext ? 10 : 0,
                    pointerEvents: isActive ? "auto" : "none",
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 25,
                    mass: 0.8,
                  }}
                  className="absolute inset-0 rounded-[2rem] md:rounded-[2.8rem] overflow-hidden border-4 md:border-8 border-background bg-background origin-center"
                >
                  <img
                    src={feature.image}
                    alt={feature.label}
                    className={cn(
                      "w-full h-full object-cover transition-all duration-700",
                      isActive ? "grayscale-0 blur-0" : "grayscale blur-[2px] brightness-75"
                    )}
                    loading="lazy"
                    decoding="async"
                  />

                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute inset-x-0 bottom-0 p-10 pt-32 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end pointer-events-none"
                      >
                        <div className="bg-background text-foreground px-4 py-1.5 rounded-full text-[11px] font-normal uppercase tracking-[0.2em] w-fit shadow-lg mb-3 border border-border/50">
                          {index + 1} • {feature.label}
                        </div>
                        <p className="text-white font-normal text-xl md:text-2xl leading-tight drop-shadow-md tracking-tight">
                          {feature.description}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div
                    className={cn(
                      "absolute top-8 left-8 flex items-center gap-3 transition-opacity duration-300",
                      isActive ? "opacity-100" : "opacity-0"
                    )}
                  >
                    <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_white]" />
                    <span className="text-white/80 text-[10px] font-normal uppercase tracking-[0.3em] font-mono">
                      Live Session
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Arrow navigation */}
          <div className="flex items-center gap-4 z-30">
            <button
              onClick={handlePrev}
              aria-label="Anterior"
              className="w-10 h-10 rounded-full border border-white/20 bg-white/5 flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white hover:border-white/40 transition-all duration-200 active:scale-95"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>

            <span className="text-white/40 text-xs font-mono tabular-nums select-none w-12 text-center">
              {currentIndex + 1} / {FEATURES.length}
            </span>

            <button
              onClick={handleNext}
              aria-label="Siguiente"
              className="w-10 h-10 rounded-full border border-white/20 bg-white/5 flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white hover:border-white/40 transition-all duration-200 active:scale-95"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FeatureCarousel;
