// app/components/landing/gym-landing/GymLandingFooter.tsx
import { MapPin, Phone, Mail, Instagram, Facebook, MessageCircle } from "lucide-react";
import type { GymLandingData } from "~/services/gym-lookup.server";

export function GymLandingFooter({ gym }: { gym: GymLandingData }) {
    const hasContact = gym.phone || gym.email || gym.address;
    const hasSocial = gym.instagram_url || gym.facebook_url || gym.whatsapp_url;

    return (
        <footer className="border-t border-white/10 py-16 px-6">
            <div className="mx-auto max-w-6xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {/* Brand */}
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            {gym.logo_url ? (
                                <img src={gym.logo_url} alt={gym.name} className="h-10 w-10 rounded-xl object-cover" />
                            ) : (
                                <div
                                    className="h-10 w-10 rounded-xl flex items-center justify-center text-xl font-black text-white"
                                    style={{ backgroundColor: gym.primary_color }}
                                >
                                    {gym.name.charAt(0)}
                                </div>
                            )}
                            <span className="text-white font-bold text-lg">{gym.name}</span>
                        </div>
                        {gym.tagline && (
                            <p className="text-white/40 text-sm">{gym.tagline}</p>
                        )}
                    </div>

                    {/* Contact */}
                    {hasContact && (
                        <div>
                            <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Contacto</h4>
                            <ul className="space-y-3 text-sm text-white/50">
                                {gym.address && (
                                    <li className="flex items-start gap-2.5">
                                        <MapPin className="size-4 shrink-0 mt-0.5" />
                                        {gym.maps_url ? (
                                            <a href={gym.maps_url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                                                {[gym.address, gym.city].filter(Boolean).join(", ")}
                                            </a>
                                        ) : (
                                            <span>{[gym.address, gym.city].filter(Boolean).join(", ")}</span>
                                        )}
                                    </li>
                                )}
                                {gym.phone && (
                                    <li className="flex items-center gap-2.5">
                                        <Phone className="size-4 shrink-0" />
                                        <a href={`tel:${gym.phone}`} className="hover:text-white transition-colors">{gym.phone}</a>
                                    </li>
                                )}
                                {gym.email && (
                                    <li className="flex items-center gap-2.5">
                                        <Mail className="size-4 shrink-0" />
                                        <a href={`mailto:${gym.email}`} className="hover:text-white transition-colors">{gym.email}</a>
                                    </li>
                                )}
                            </ul>
                        </div>
                    )}

                    {/* Social */}
                    {hasSocial && (
                        <div>
                            <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Síguenos</h4>
                            <div className="flex gap-3">
                                {gym.instagram_url && (
                                    <a
                                        href={gym.instagram_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:border-white/20 transition-all"
                                    >
                                        <Instagram className="size-5" />
                                    </a>
                                )}
                                {gym.facebook_url && (
                                    <a
                                        href={gym.facebook_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:border-white/20 transition-all"
                                    >
                                        <Facebook className="size-5" />
                                    </a>
                                )}
                                {gym.whatsapp_url && (
                                    <a
                                        href={gym.whatsapp_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:border-white/20 transition-all"
                                    >
                                        <MessageCircle className="size-5" />
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom bar */}
                <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-white/20 text-xs">
                        © {new Date().getFullYear()} {gym.name}. Todos los derechos reservados.
                    </p>
                    <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest">
                        Powered by Project Studio
                    </p>
                </div>
            </div>
        </footer>
    );
}
