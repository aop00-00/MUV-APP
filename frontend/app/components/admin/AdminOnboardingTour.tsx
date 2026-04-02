import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router";
import {
    MapPin,
    Users,
    CreditCard,
    CalendarDays,
    Settings2,
    ShoppingBag,
    UserCircle,
    CheckCircle2,
    ArrowRight,
    ArrowLeft,
    X,
    Sparkles,
} from "lucide-react";

interface AdminOnboardingTourProps {
    gymId: string;
}

const TOUR_STEPS = [
    {
        title: "¡Bienvenido a tu Dashboard!",
        description: "El centro de control de tu estudio. Completa estos pasos para poder agendar tu primera clase.",
        icon: Sparkles,
        color: "text-amber-400",
        bg: "bg-amber-400/10",
        path: null,
    },
    {
        title: "1. Sedes y Salones",
        description: "Configura el espacio físico de tu estudio. Agrega tus ubicaciones y los salones con su capacidad y acomodo (spots).",
        icon: MapPin,
        color: "text-blue-400",
        bg: "bg-blue-500/10",
        path: "/admin/ubicaciones",
    },
    {
        title: "2. Coaches",
        description: "Agrega a los instructores que darán vida a tus clases. Sin ellos, no podrás abrir horarios.",
        icon: Users,
        color: "text-purple-400",
        bg: "bg-purple-500/10",
        path: "/admin/coaches",
    },
    {
        title: "3. Planes y Membresías",
        description: "Define el costo de tus clases o mensualidades. Los usuarios requerirán créditos activos para poder reservar.",
        icon: CreditCard,
        color: "text-pink-400",
        bg: "bg-pink-500/10",
        path: "/admin/planes",
    },
    {
        title: "4. Métodos de Cobro",
        description: "Conecta tus APIs de pago (Stripe, Mercado Pago) para que tus clientes puedan pagar en línea desde su app.",
        icon: Settings2,
        color: "text-teal-400",
        bg: "bg-teal-500/10",
        path: "/admin/pagos",
    },
    {
        title: "5. Punto de Venta (POS)",
        description: "Configura qué productos físicos u ofertas rápidas venderás directo en mostrador usando la terminal POS.",
        icon: ShoppingBag,
        color: "text-orange-400",
        bg: "bg-orange-500/10",
        path: "/admin/pos",
    },
    {
        title: "6. Usuarios",
        description: "Invita, importa o maneja manualmente a los clientes de tu estudio que compraron un plan o entran de prueba.",
        icon: UserCircle,
        color: "text-indigo-400",
        bg: "bg-indigo-500/10",
        path: "/admin/users",
    },
    {
        title: "7. ¡Agendar Clases!",
        description: "¡Estás listo! Ahora programa tu calendario (Horarios) seleccionando sede, coach, hora y tipo de clase.",
        icon: CalendarDays,
        color: "text-green-400",
        bg: "bg-green-500/10",
        path: "/admin/horarios",
    },
];

export function AdminOnboardingTour({ gymId }: AdminOnboardingTourProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const storageKey = `grind_admin_tour_seen_${gymId}`;
    const navigate = useNavigate();

    useEffect(() => {
        // Check local storage if tour was already completed
        const hasSeenTour = localStorage.getItem(storageKey);
        if (!hasSeenTour) {
            setIsOpen(true);
        }
    }, [storageKey]);

    const handleClose = () => {
        setIsOpen(false);
        localStorage.setItem(storageKey, "true");
    };

    const handleNext = () => {
        if (currentStep < TOUR_STEPS.length - 1) {
            setCurrentStep((prev) => prev + 1);
        } else {
            handleClose();
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep((prev) => prev - 1);
        }
    };

    const handleGoToSection = (path: string) => {
        handleClose();
        navigate(path);
    };

    if (!isOpen) return null;

    const stepInfo = TOUR_STEPS[currentStep];
    const progressPct = ((currentStep + 1) / TOUR_STEPS.length) * 100;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl"
            >
                <div className="absolute inset-0 z-0" onClick={handleClose} />

                <motion.div
                    initial={{ scale: 0.95, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.95, y: 20 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="relative z-10 w-full max-w-md bg-zinc-950 border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden"
                >
                    {/* Header with progress */}
                    <div className="h-1.5 w-full bg-white/5 relative">
                        <motion.div
                            className="absolute top-0 left-0 bottom-0 bg-white"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPct}%` }}
                            transition={{ ease: "easeInOut", duration: 0.3 }}
                        />
                    </div>

                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors z-20"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Step Content */}
                    <div className="p-8">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentStep}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                className="flex flex-col items-center text-center space-y-4"
                            >
                                <div className={`w-20 h-20 flex items-center justify-center rounded-r-[2.5rem] rounded-bl-[2.5rem] rounded-tl-xl ${stepInfo.bg} border border-[#ffffff10] shadow-inner mb-2`}>
                                    <stepInfo.icon className={`w-10 h-10 ${stepInfo.color}`} />
                                </div>

                                <motion.h2 
                                    className="text-2xl font-black text-white tracking-tight"
                                >
                                    {stepInfo.title}
                                </motion.h2>

                                <p className="text-white/60 text-sm leading-relaxed max-w-[280px]">
                                    {stepInfo.description}
                                </p>

                                {stepInfo.path && (
                                    <button
                                        onClick={() => handleGoToSection(stepInfo.path!)}
                                        className="mt-4 px-4 py-2 border border-white/10 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white transition-colors"
                                    >
                                        Ir ahora a {stepInfo.title.replace(/^[0-9.]+\s*/, '')}
                                    </button>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Footer Navigation */}
                    <div className="p-6 bg-white/[0.02] border-t border-white/[0.05] flex items-center justify-between">
                        <button
                            onClick={handlePrev}
                            disabled={currentStep === 0}
                            className="p-3 text-white/40 hover:text-white disabled:opacity-0 transition-all rounded-full hover:bg-white/5"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>

                        <div className="flex gap-1.5">
                            {TOUR_STEPS.map((_, i) => (
                                <span
                                    key={i}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${
                                        i === currentStep ? "w-4 bg-white" : "w-1.5 bg-white/20"
                                    }`}
                                />
                            ))}
                        </div>

                        <button
                            onClick={handleNext}
                            className="bg-white text-black font-black px-6 py-3 rounded-xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                        >
                            {currentStep === TOUR_STEPS.length - 1 ? (
                                <>
                                    ¡Comenzar! <CheckCircle2 className="w-5 h-5" />
                                </>
                            ) : (
                                <>
                                    Siguiente <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
