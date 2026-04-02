import { useState } from "react";
import { Link } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, ArrowRight, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

export type SetupStep = {
    name: string;
    description: string;
    path: string;
    completed: boolean;
};

interface AdminOnboardingWidgetProps {
    steps: SetupStep[];
}

export function AdminOnboardingWidget({ steps }: AdminOnboardingWidgetProps) {
    const completedCount = steps.filter((s) => s.completed).length;
    const totalSteps = steps.length;
    const progressPct = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;
    const isFullyComplete = completedCount === totalSteps;

    // Default to open if not fully complete, closed if fully complete.
    const [isExpanded, setIsExpanded] = useState(!isFullyComplete);

    if (totalSteps === 0) return null;

    return (
        <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/[0.08] overflow-hidden mb-6 transition-all duration-300">
            {/* Header / Progress Bar Area */}
            <div 
                className="p-5 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-4 flex-1">
                    <div className="p-2 bg-amber-500/10 rounded-xl">
                        <Sparkles className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="flex-1 max-w-md">
                        <div className="flex items-center justify-between mb-1">
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                                Guía de Configuración
                            </h2>
                            <span className="text-xs font-bold text-white/50">
                                {completedCount} de {totalSteps} completados
                            </span>
                        </div>
                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                            <motion.div 
                                className="h-full bg-amber-400 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPct}%` }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                            />
                        </div>
                    </div>
                </div>
                
                <div className="ml-4 p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/50 transition-colors">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
            </div>

            {/* Expandable Content (The Steps Grid) */}
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        <div className="p-5 pt-0 border-t border-white/[0.04]">
                            <p className="text-xs text-white/50 mb-4 font-medium">
                                Sigue estos pasos para tener tu estudio listo y empezar a agendar clases y recibir pagos.
                            </p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {steps.map((step, idx) => (
                                    <Link 
                                        key={idx} 
                                        to={step.path}
                                        className={`relative p-4 rounded-xl border flex flex-col gap-2 transition-all hover:-translate-y-0.5 ${
                                            step.completed 
                                                ? "bg-green-500/5 border-green-500/20 hover:border-green-500/40" 
                                                : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-amber-500/40"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className={`text-sm font-bold ${step.completed ? "text-green-400" : "text-white"}`}>
                                                {idx + 1}. {step.name}
                                            </h3>
                                            {step.completed ? (
                                                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                            ) : (
                                                <Circle className="w-4 h-4 text-white/20 shrink-0" />
                                            )}
                                        </div>
                                        <p className="text-[10px] text-white/40 leading-relaxed font-medium">
                                            {step.description}
                                        </p>
                                        
                                        {!step.completed && (
                                            <div className="mt-auto pt-2 flex items-center gap-1 text-[10px] font-bold text-amber-500 uppercase tracking-wider group">
                                                Completar paso <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                                            </div>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
