// app/routes/admin/layout.tsx
// Premium collapsible sidebar — groups mirror Koreo's nav structure.

import { useState } from "react";
import { Link, Outlet, useLocation, useRouteLoaderData } from "react-router";
import ParticleBackground from "~/components/landing/ParticleBackground";
import { TrialBanner } from "~/components/admin/TrialBanner";
import { isRouteAllowed, type PlanId } from "~/config/plan-features";
import type { Route } from "./+types/layout";
import {
    LayoutDashboard,
    CalendarDays,
    Clock,
    CalendarOff,
    ArrowLeftRight,
    Sparkles,
    BookOpen,
    Users,
    CreditCard,
    Banknote,
    Briefcase,
    Ticket,
    TrendingUp,
    Wallet,
    Settings2,
    MapPin,
    Wrench,
    UserCog,
    UserCircle,
    LogOut,
    ChevronDown,
    ChevronRight,
    Menu,
    X,
} from "lucide-react";

// ─── Nav structure ────────────────────────────────────────────────────────────

type NavItem =
    | { kind: "link"; name: string; href: string; icon: React.ElementType }
    | {
        kind: "group";
        name: string;
        icon: React.ElementType;
        children: { name: string; href: string; icon: React.ElementType }[];
    };

const NAV: NavItem[] = [
    {
        kind: "link",
        name: "Inicio",
        href: "/admin",
        icon: LayoutDashboard,
    },
    {
        kind: "group",
        name: "Agenda",
        icon: CalendarDays,
        children: [
            { name: "Sesiones", href: "/admin/schedule", icon: CalendarDays },
            { name: "Horarios", href: "/admin/horarios", icon: Clock },
            { name: "Períodos Especiales", href: "/admin/periodos", icon: CalendarOff },
            { name: "Sustituciones", href: "/admin/sustituciones", icon: ArrowLeftRight },
            { name: "Eventos", href: "/admin/events", icon: Sparkles },
            { name: "Reservas", href: "/admin/reservas", icon: BookOpen },
        ],
    },
    {
        kind: "group",
        name: "Clientes",
        icon: Users,
        children: [
            { name: "Usuarios", href: "/admin/users", icon: Users },
            { name: "Créditos", href: "/admin/subscriptions", icon: CreditCard },
            { name: "Pagos", href: "/admin/finance", icon: Banknote },
        ],
    },
    {
        kind: "group",
        name: "Negocio",
        icon: Briefcase,
        children: [
            { name: "CRM (Leads)", href: "/admin/crm", icon: UserCircle },
            { name: "Planes", href: "/admin/planes", icon: CreditCard },
            { name: "Cupones", href: "/admin/cupones", icon: Ticket },
            { name: "Mis Ingresos", href: "/admin/ingresos", icon: TrendingUp },
            { name: "Nómina", href: "/admin/nomina", icon: Wallet },
            { name: "Config. Pagos", href: "/admin/pos", icon: Settings2 },
        ],
    },
    {
        kind: "group",
        name: "Mi Estudio",
        icon: Wrench,
        children: [
            { name: "General", href: "/admin/studio", icon: Settings2 },
            { name: "Ubicaciones", href: "/admin/ubicaciones", icon: MapPin },
            { name: "Operaciones", href: "/admin/operaciones", icon: Wrench },
            { name: "Coaches", href: "/admin/coaches", icon: UserCog },
            { name: "Métodos de Cobro", href: "/admin/pagos", icon: CreditCard },
        ],
    },
];

// ─── Nav filtering by plan ────────────────────────────────────────────────────

function filterNavByPlan(nav: NavItem[], planId: PlanId): NavItem[] {
    return nav
        .map((item) => {
            if (item.kind === "link") {
                return isRouteAllowed(planId, item.href) ? item : null;
            }
            const allowedChildren = item.children.filter((child) =>
                isRouteAllowed(planId, child.href)
            );
            if (allowedChildren.length === 0) return null;
            return { ...item, children: allowedChildren };
        })
        .filter(Boolean) as NavItem[];
}

// ─── Loader: fetch gym branding from Supabase ─────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
    // Use requireOnboardingComplete instead of requireGymAdmin
    // This blocks admin access until post-checkout onboarding is done
    const { requireOnboardingComplete } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requireOnboardingComplete(request);

    const { data: gym } = await supabaseAdmin
        .from("gyms")
        .select("name, logo_url, primary_color, brand_color, studio_type, plan_id, plan_status, trial_ends_at")
        .eq("id", gymId)
        .single();

    // Compute trial banner info
    let trialDaysLeft: number | null = null;
    if (gym?.plan_status === "trial" && gym?.trial_ends_at) {
        const msLeft = new Date(gym.trial_ends_at).getTime() - Date.now();
        trialDaysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    }

    // Demo mode: treat demo gyms as elite so all nav items show
    const isDemoGym = gymId.startsWith("00000000-");
    const planId = isDemoGym ? "elite" : (gym?.plan_id || "starter");

    return {
        gymBranding: {
            name: gym?.name || "Mi Estudio",
            logo: gym?.logo_url || "",
            primaryColor: gym?.brand_color || gym?.primary_color || "#7c3aed",
            studioType: gym?.studio_type || null,
        },
        planInfo: {
            planId: planId as PlanId,
            planStatus: gym?.plan_status || "trial",
            trialDaysLeft,
            isTrialActive: gym?.plan_status === "trial" && trialDaysLeft !== null && trialDaysLeft > 0,
        },
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useDefaultOpen(nav: NavItem[], pathname: string): Record<string, boolean> {
    const initial: Record<string, boolean> = {};
    nav.forEach((item) => {
        if (item.kind === "group") {
            initial[item.name] = item.children.some((c) => pathname.startsWith(c.href));
        }
    });
    return initial;
}

// ─── Sidebar content ──────────────────────────────────────────────────────────

function SidebarContent({ branding, planId, onLinkClick }: { branding: { name: string; logo: string; primaryColor: string }; planId: PlanId; onLinkClick?: () => void }) {
    const location = useLocation();
    const filteredNav = filterNavByPlan(NAV, planId);
    const [open, setOpen] = useState<Record<string, boolean>>(
        () => useDefaultOpen(filteredNav, location.pathname)
    );

    const toggle = (name: string) =>
        setOpen((prev) => ({ ...prev, [name]: !prev[name] }));

    const isActive = (href: string) => location.pathname === href;
    const groupActive = (children: { href: string }[]) =>
        children.some((c) => location.pathname.startsWith(c.href));

    return (
        <div className="flex flex-col h-full">
            {/* Logo / Studio name */}
            <div className="px-5 py-5 border-b border-white/[0.07]">
                <div className="flex items-center gap-3">
                    {branding.logo && (
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                            {branding.logo.startsWith("http") || branding.logo.startsWith("data:") ? (
                                <img src={branding.logo} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-xl">{branding.logo}</span>
                            )}
                        </div>
                    )}
                    <div className="flex flex-col min-w-0">
                        <span className="text-white font-black text-lg tracking-tight truncate leading-tight">
                            {branding.name}
                        </span>
                        <p className="text-white/30 text-[10px] uppercase font-bold tracking-widest mt-0.5">Admin</p>
                    </div>
                </div>
            </div>

            {/* Scrollable nav */}
            <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
                {filteredNav.map((item) => {
                    if (item.kind === "link") {
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                onClick={onLinkClick}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${active
                                    ? "bg-white/10 text-white shadow-sm"
                                    : "text-white/50 hover:text-white hover:bg-white/[0.05]"
                                    }`}
                                style={active ? { borderColor: branding.primaryColor } : {}}
                            >
                                <item.icon className="w-4 h-4 shrink-0" style={active ? { color: branding.primaryColor } : {}} />
                                {item.name}
                            </Link>
                        );
                    }

                    // Group
                    const isOpen = open[item.name] ?? false;
                    const hasActive = groupActive(item.children);

                    return (
                        <div key={item.name}>
                            <button
                                onClick={() => toggle(item.name)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${hasActive
                                    ? "text-white bg-white/[0.05]"
                                    : "text-white/50 hover:text-white hover:bg-white/[0.05]"
                                    }`}
                            >
                                <item.icon className="w-4 h-4 shrink-0" style={hasActive ? { color: branding.primaryColor } : {}} />
                                <span className="flex-1 text-left">{item.name}</span>
                                {isOpen
                                    ? <ChevronDown className="w-3.5 h-3.5 opacity-40" />
                                    : <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                                }
                            </button>

                            {/* Children */}
                            <div
                                className={`overflow-hidden transition-all duration-200 ease-in-out ${isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                                    }`}
                            >
                                <div className="ml-4 pl-3 border-l border-white/[0.07] mt-0.5 mb-1 space-y-0.5">
                                    {item.children.map((child) => {
                                        const active = isActive(child.href);
                                        return (
                                            <Link
                                                key={child.href}
                                                to={child.href}
                                                onClick={onLinkClick}
                                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${active
                                                    ? "bg-white/10 text-white"
                                                    : "text-white/40 hover:text-white hover:bg-white/[0.05]"
                                                    }`}
                                            >
                                                <child.icon className="w-3.5 h-3.5 shrink-0" style={active ? { color: branding.primaryColor } : {}} />
                                                {child.name}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* Bottom section */}
            <div className="px-3 pb-4 pt-3 border-t border-white/[0.07] space-y-0.5">
                <form action="/auth/logout" method="post">
                    <button
                        type="submit"
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-400/70 hover:text-red-300 hover:bg-red-500/10 transition-all duration-150"
                    >
                        <LogOut className="w-4 h-4 shrink-0" />
                        Cerrar sesión
                    </button>
                </form>
            </div>
        </div>
    );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const branding = loaderData.gymBranding;
    const { planId, isTrialActive, trialDaysLeft } = loaderData.planInfo;

    return (
        <>
            <ParticleBackground />
            <div className="relative z-10 min-h-screen flex flex-col">

                {/* ── Trial banner ── */}
                {isTrialActive && trialDaysLeft !== null && (
                    <TrialBanner daysLeft={trialDaysLeft} />
                )}

                <div className="flex-1 flex">
                    {/* ── Desktop sidebar ── */}
                    <aside className="hidden md:flex flex-col w-60 shrink-0 bg-black/40 border-r border-white/[0.07] backdrop-blur-xl">
                        <SidebarContent branding={branding} planId={planId} />
                    </aside>

                    {/* ── Mobile overlay sidebar ── */}
                    {mobileOpen && (
                        <div className="md:hidden fixed inset-0 z-50 flex">
                            {/* Backdrop */}
                            <div
                                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                                onClick={() => setMobileOpen(false)}
                            />
                            {/* Drawer */}
                            <aside className="relative w-full md:w-64 bg-[#0a0a0a] border-r border-white/[0.08] flex flex-col h-full">
                                <button
                                    onClick={() => setMobileOpen(false)}
                                    className="absolute top-4 right-4 text-white/40 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                                <SidebarContent branding={branding} planId={planId} onLinkClick={() => setMobileOpen(false)} />
                            </aside>
                        </div>
                    )}

                    {/* ── Main content ── */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {/* Mobile top bar */}
                        <header className="md:hidden flex items-center justify-between p-4 md:px-4 md:py-3 bg-black/40 border-b border-white/[0.07] backdrop-blur-xl">
                            <div className="flex items-center gap-2">
                                {branding.logo && (
                                    <div className="w-6 h-6 rounded-md overflow-hidden bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                        {branding.logo.startsWith("http") || branding.logo.startsWith("data:") ? (
                                            <img src={branding.logo} alt="Logo" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-sm">{branding.logo}</span>
                                        )}
                                    </div>
                                )}
                                <span className="text-white font-black text-base tracking-tight truncate max-w-[150px]">
                                    {branding.name}
                                </span>
                            </div>
                            <button
                                onClick={() => setMobileOpen(true)}
                                className="text-white/50 hover:text-white transition-colors"
                            >
                                <Menu className="w-5 h-5" />
                            </button>
                        </header>

                        <main className="flex-1 overflow-y-auto p-6 md:p-8 text-white">
                            <Outlet />
                        </main>
                    </div>
                </div>
            </div>
        </>
    );
}
