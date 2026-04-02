// app/components/landing/Testimonials.tsx
// Infinite marquee testimonials — two rows scrolling in opposite directions.
// + Custom Landing Page section below.

import React, { useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { ScrollReveal } from "~/components/ui/scroll-reveal";
import ParticleBackground from "./ParticleBackground";

// ─── Marquee primitive ────────────────────────────────────────────────────────

function cn(...classes: (string | boolean | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

interface MarqueeProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
    reverse?: boolean;
    pauseOnHover?: boolean;
    children: React.ReactNode;
    vertical?: boolean;
    repeat?: number;
}

function Marquee({
    className,
    reverse = false,
    pauseOnHover = false,
    children,
    vertical = false,
    repeat = 4,
    ...props
}: MarqueeProps) {
    const ref = useRef<HTMLDivElement>(null);

    const tracks = React.useMemo(
        () =>
            Array.from({ length: repeat }, (_, i) => (
                <div
                    key={i}
                    className={cn(
                        'flex shrink-0 justify-around [gap:var(--gap)]',
                        !vertical && 'animate-marquee flex-row',
                        vertical && 'animate-marquee-vertical flex-col',
                        pauseOnHover && 'group-hover:[animation-play-state:paused]',
                        reverse && '[animation-direction:reverse]',
                    )}
                >
                    {children}
                </div>
            )),
        [repeat, children, vertical, pauseOnHover, reverse],
    );

    return (
        <div
            {...props}
            ref={ref}
            className={cn(
                'group flex overflow-hidden p-2 [--duration:35s] [--gap:1.25rem] [gap:var(--gap)]',
                !vertical ? 'flex-row' : 'flex-col',
                className,
            )}
        >
            {tracks}
        </div>
    );
}

// ─── Testimonials Data ───────────────────────────────────────────────────────

const TESTIMONIALS = [
    {
        quote:
            'Antes tardaba 2 horas al día en WhatsApp confirmando reservas. Ahora mis alumnas reservan solas y yo me concentro en enseñar. La facturación CFDI es automática, eso fue el diferenciador.',
        name: 'Valentina Ruiz',
        role: 'Dueña, Studio V Pilates',
        location: 'Ciudad de México',
        avatar: 'VR',
        stars: 5,
    },
    {
        quote:
            'El control de acceso QR fue game changer. Cero deudas de alumnas que "olvidaron pagar". El sistema lo detecta y la puerta simplemente no abre. Mis finanzas mejoraron 40% el primer mes.',
        name: 'Camila Torres',
        role: 'Directora, Barre & Flow',
        location: 'Buenos Aires, Argentina',
        avatar: 'CT',
        stars: 5,
    },
    {
        quote:
            'Migré de 4 apps distintas (Mindbody, Excel, WhatsApp Business y Facturama) a solo Project Studio. Ahorro $8,000 pesos al mes en suscripciones y 3 horas de administración diaria.',
        name: 'Isabella Moreno',
        role: 'CEO, Nama Yoga Studio',
        location: 'Santiago, Chile',
        avatar: 'IM',
        stars: 5,
    },
    {
        quote:
            'Los reportes financieros en tiempo real me cambiaron la vida. Ya sé exactamente qué plan convierte más y cuándo llega el pico de cancelaciones. Decisiones basadas en datos, no en corazonadas.',
        name: 'Sofía Gutiérrez',
        role: 'Fundadora, Pulse Fitness',
        location: 'Monterrey, México',
        avatar: 'SG',
        stars: 5,
    },
    {
        quote:
            'La app para mis alumnas es increíble. Pueden ver su progreso, reservar y pagar en segundos. Los comentarios positivos de ellas me hicieron subir precios y retener el 95% de la base.',
        name: 'Luciana Fernández',
        role: 'Propietaria, LF Pilates Reformer',
        location: 'Bogotá, Colombia',
        avatar: 'LF',
        stars: 5,
    },
    {
        quote:
            'Tenía miedo de que la tecnología fuera difícil, pero la configuración fue en un día. El soporte respondió en minutos cada vez que tuve dudas. Vale cada peso.',
        name: 'Mariana López',
        role: 'Instructora & Dueña, Zen Moves',
        location: 'Lima, Perú',
        avatar: 'ML',
        stars: 5,
    },
];

const ROW_A = TESTIMONIALS.slice(0, 3);
const ROW_B = TESTIMONIALS.slice(3);

// ─── Custom Landing Features Data ────────────────────────────────────────────

const LANDING_FEATURES = [
    {
        id: 'feature-1',
        title: 'Diseño Moderno y Atractivo',
        description:
            'Interfaz limpia, profesional y construida con los últimos principios de diseño. Optimizada para ofrecer la mejor experiencia a tus clientes y maximizar conversiones.',
        image: '/images/custom-landing/computer_mockup.png',
    },
    {
        id: 'feature-2',
        title: 'Eficiencia para todos',
        description:
            'Tanto tu sitio web como tu plataforma están diseñados bajo una arquitectura centrada en la eficiencia. Optimizamos cada pantalla para que tú y tus clientes disfruten de una experiencia fluida, rápida y profesional desde cualquier móvil, tablet o PC.',
        image: '/images/custom-landing/mobile_mockup_1.png',
    },
    {
        id: 'feature-3',
        title: 'Potencia para Usuarios y Admins',
        description:
            'Nuestra plataforma está diseñada para empoderar a todos. Los usuarios disfrutan de una interfaz intuitiva para sus gestiones, mientras que los administradores obtienen el control total y las herramientas de análisis necesarias para escalar su negocio con fuerza.',
        image: '/images/custom-landing/mobile_mockup_2.png',
    },
];

// ─── Testimonial Card ────────────────────────────────────────────────────────

function TestimonialCard({
    quote,
    name,
    role,
    location,
    avatar,
    stars,
}: (typeof TESTIMONIALS)[0]) {
    return (
        <figure className="relative w-72 sm:w-80 shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-6 flex flex-col gap-4 hover:border-white/20 hover:bg-white/[0.07] transition-all duration-300 cursor-default">
            <div className="flex gap-0.5">
                {Array.from({ length: stars }).map((_, i) => (
                    <svg key={i} className="w-4 h-4 fill-amber-400/80" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                ))}
            </div>
            <blockquote className="text-white/60 text-sm leading-relaxed flex-1">
                &ldquo;{quote}&rdquo;
            </blockquote>
            <figcaption className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold text-xs shrink-0">
                    {avatar}
                </div>
                <div>
                    <p className="text-white font-semibold text-sm leading-none mb-0.5">{name}</p>
                    <p className="text-white/40 text-xs">
                        {role} · {location}
                    </p>
                </div>
            </figcaption>
        </figure>
    );
}

// ─── Custom Landing Section ──────────────────────────────────────────────────

function CustomLandingSection() {
    return (
        <section className="relative py-20 md:py-32 w-full">
            <ParticleBackground isAbsolute transparent />
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <ScrollReveal>
                    <div className="max-w-2xl mb-12 md:mb-16">
                        <h2 className="mb-4 md:mb-6 text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-black text-white tracking-tight leading-tight">
                            Creación de Landing Page Personalizada
                        </h2>
                        <p className="mb-6 md:mb-8 text-gray-400 text-sm md:text-lg leading-relaxed max-w-xl">
                            Diseñamos el sitio web que tu estudio necesita para destacar. Entregamos una interfaz limpia, moderna y estratégicamente optimizada para convertir a tus visitantes en socios.
                        </p>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-400 text-sm md:text-base font-bold tracking-tight shadow-[0_0_20px_rgba(251,191,36,0.1)] animate-pulse-subtle">
                            <Sparkles className="w-4 h-4 text-amber-500" />
                            Tarifa preferencial para planes Pro y Elite
                        </div>
                    </div>
                </ScrollReveal>

                {/* Feature Cards */}
                <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 md:gap-8">
                    {LANDING_FEATURES.map((feature, i) => (
                        <ScrollReveal key={feature.id} delay={i * 0.15}>
                            <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm group hover:border-white/20 transition-all duration-300">
                                <div className="h-56 sm:h-64 md:h-72 lg:h-64 bg-white/5 overflow-hidden shrink-0">
                                    <img
                                        src={feature.image}
                                        alt={feature.title}
                                        className="h-full w-full object-cover object-top filter group-hover:brightness-110 group-hover:scale-[1.03] transition-all duration-500"
                                    />
                                </div>
                                <div className="px-5 py-5 md:px-8 md:py-6">
                                    <h3 className="mb-2 md:mb-4 text-lg md:text-2xl font-bold text-white leading-tight">
                                        {feature.title}
                                    </h3>
                                    <p className="text-gray-400 text-sm md:text-base leading-relaxed">
                                        {feature.description}
                                    </p>
                                </div>
                            </div>
                        </ScrollReveal>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function Testimonials() {
    return (
        <>
            <section className="py-24 overflow-hidden text-white">
                <ScrollReveal className="text-center px-4 mb-14">
                    <p className="text-white/50 font-semibold text-xs tracking-widest uppercase mb-3">
                        Lo que dicen nuestros clientes
                    </p>
                    <h2 className="text-4xl md:text-5xl font-semibold text-white">
                        Estudios reales.{' '}
                        <span className="text-white/50">Resultados reales.</span>
                    </h2>
                </ScrollReveal>

                <ScrollReveal delay={0.1}>
                    <Marquee pauseOnHover className="mb-5 [--duration:40s]">
                        {ROW_A.map((t) => (
                            <TestimonialCard key={t.name} {...t} />
                        ))}
                    </Marquee>
                </ScrollReveal>

                <ScrollReveal delay={0.2}>
                    <Marquee pauseOnHover reverse className="[--duration:45s]">
                        {ROW_B.map((t) => (
                            <TestimonialCard key={t.name} {...t} />
                        ))}
                    </Marquee>
                </ScrollReveal>
            </section>

            <CustomLandingSection />
        </>
    );
}
