// app/components/landing/gym-landing/GymLandingCTA.tsx
// Inline login/register section at the bottom of the gym landing page.
// The form POSTs to the _index.tsx action which calls handleGymAuth().

import { useState } from "react";
import { Form, useNavigation, useActionData } from "react-router";
import type { GymLandingData } from "~/services/gym-lookup.server";

export function GymLandingCTA({ gym }: { gym: GymLandingData }) {
    const [view, setView] = useState<"login" | "register">("register");
    const navigation = useNavigation();
    const actionData = useActionData<{ error?: string }>();
    const isSubmitting = navigation.state === "submitting";

    const inputClass =
        "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 transition-all font-medium";

    return (
        <section id="cta" className="py-24 px-6">
            <div className="mx-auto max-w-lg">
                <div className="text-center mb-10">
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                        Únete a{" "}
                        <span style={{ color: gym.primary_color }}>{gym.name}</span>
                    </h2>
                    <p className="text-white/40 mt-4">
                        Crea tu cuenta para reservar clases, ver tu historial y más.
                    </p>
                </div>

                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
                    {/* Toggle */}
                    <div className="flex gap-2 p-1 bg-black/40 rounded-xl mb-8">
                        <button
                            type="button"
                            onClick={() => setView("register")}
                            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                                view === "register" ? "text-white" : "text-white/40 hover:text-white"
                            }`}
                            style={view === "register" ? { backgroundColor: gym.primary_color + "30" } : undefined}
                        >
                            CREAR CUENTA
                        </button>
                        <button
                            type="button"
                            onClick={() => setView("login")}
                            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                                view === "login" ? "text-white" : "text-white/40 hover:text-white"
                            }`}
                            style={view === "login" ? { backgroundColor: gym.primary_color + "30" } : undefined}
                        >
                            YA TENGO CUENTA
                        </button>
                    </div>

                    {view === "register" ? (
                        <Form method="post" className="space-y-5">
                            <input type="hidden" name="intent" value="register" />
                            <div>
                                <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">
                                    Nombre Completo
                                </label>
                                <input
                                    type="text"
                                    name="full_name"
                                    required
                                    className={inputClass}
                                    style={{ "--tw-ring-color": gym.primary_color } as any}
                                    placeholder="Ej. María García"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">
                                    Correo Electrónico
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    className={inputClass}
                                    style={{ "--tw-ring-color": gym.primary_color } as any}
                                    placeholder="tu@email.com"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">
                                    Contraseña
                                </label>
                                <input
                                    type="password"
                                    name="password"
                                    required
                                    minLength={6}
                                    className={inputClass}
                                    style={{ "--tw-ring-color": gym.primary_color } as any}
                                    placeholder="Mínimo 6 caracteres"
                                />
                            </div>

                            {actionData?.error && (
                                <p className="text-red-400 text-xs font-bold bg-red-400/10 p-3 rounded-lg border border-red-400/20">
                                    {actionData.error}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full text-white font-black py-4 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
                                style={{ backgroundColor: gym.primary_color }}
                            >
                                {isSubmitting ? "CREANDO CUENTA..." : "CREAR MI CUENTA"}
                            </button>
                        </Form>
                    ) : (
                        <Form method="post" className="space-y-5">
                            <input type="hidden" name="intent" value="login" />
                            <div>
                                <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">
                                    Correo Electrónico
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    className={inputClass}
                                    style={{ "--tw-ring-color": gym.primary_color } as any}
                                    placeholder="tu@email.com"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">
                                    Contraseña
                                </label>
                                <input
                                    type="password"
                                    name="password"
                                    required
                                    className={inputClass}
                                    style={{ "--tw-ring-color": gym.primary_color } as any}
                                    placeholder="••••••••"
                                />
                            </div>

                            {actionData?.error && (
                                <p className="text-red-400 text-xs font-bold bg-red-400/10 p-3 rounded-lg border border-red-400/20">
                                    {actionData.error}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full text-white font-black py-4 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
                                style={{ backgroundColor: gym.primary_color }}
                            >
                                {isSubmitting ? "INICIANDO..." : "ENTRAR"}
                            </button>
                        </Form>
                    )}
                </div>

                <p className="text-center mt-6 text-[10px] text-white/20 font-bold uppercase tracking-widest">
                    Powered by Project Studio
                </p>
            </div>
        </section>
    );
}
