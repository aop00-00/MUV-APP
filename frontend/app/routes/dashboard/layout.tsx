// app/routes/dashboard/layout.tsx
// Dashboard layout — reads gym branding from DB to apply brand color across the nav.
import type { Route } from "./+types/layout";
import { Link, Outlet, useLocation, useRouteLoaderData } from "react-router";
import ParticleBackground from "~/components/landing/ParticleBackground";
import {
    LayoutDashboard,
    Calendar,
    ShoppingBag,
    User,
    LogOut,
    CreditCard,
    Zap
} from "lucide-react";

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAuth } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requireGymAuth(request);

    const { data: gym } = await supabaseAdmin
        .from("gyms")
        .select("name, brand_color, primary_color, studio_type, booking_mode, theme")
        .eq("id", gymId)
        .single();

    const studioType = gym?.studio_type || null;
    const dbTheme = gym?.theme;
    const theme = dbTheme || ((studioType?.toLowerCase() === "pilates" || studioType?.toLowerCase() === "yoga") ? "light" : "dark");

    return {
        brandColor: gym?.brand_color || gym?.primary_color || "#7c3aed",
        studioType,
        bookingMode: gym?.booking_mode || "capacity_only",
        gymName: gym?.name || "Mi Estudio",
        theme,
        isLight: theme === "light",
    };
}

// ─── Layout ──────────────────────────────────────────────────────────────────

export default function DashboardLayout({ loaderData }: Route.ComponentProps) {
    const location = useLocation();
    const rootData = useRouteLoaderData("root") as { tenant?: { name: string } } | undefined;
    const gymName = (loaderData as any)?.gymName || rootData?.tenant?.name || "Mi Estudio";
    const brandColor = (loaderData as any)?.brandColor || "#7c3aed";
    const theme = (loaderData as any)?.theme || "dark";
    const isLight = (loaderData as any)?.isLight ?? false;

    const navigation = [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Agenda', href: '/dashboard/schedule', icon: Calendar },
        { name: 'Paquetes', href: '/dashboard/packages', icon: CreditCard },
        { name: 'FitCoins', href: '/dashboard/fitcoins', icon: Zap },
        { name: 'Tienda', href: '/dashboard/store', icon: ShoppingBag },
        { name: 'Perfil', href: '/dashboard/profile', icon: User },
    ];

    return (
        <>
            <ParticleBackground variant={theme} />
            {/* 
                NOTE: Currently the dashboard children components hardcode `text-white`, `bg-white/5`, etc.
                If isLight is true, readability will be an issue without a refactor for adaptive typography.
                For now, we inject a class "dashboard-light-mode" that we could target in app.css or refactor later.
            */}
            <div className={`relative z-10 min-h-screen flex flex-col md:flex-row ${isLight ? 'text-gray-900 dashboard-light-mode' : 'text-white'}`}>
                {/* Sidebar Navigation */}
                <aside className={`w-full md:w-64 border-r hidden md:flex flex-col backdrop-blur-md ${isLight ? 'bg-white/40 border-black/5' : 'bg-white/5 border-white/10'}`}>
                    <div className={`p-6 border-b ${isLight ? 'border-black/5' : 'border-white/10'}`}>
                        {/* Brand color accent bar */}
                        <div className="w-8 h-1 rounded-full mb-3" style={{ backgroundColor: brandColor }} />
                        <h1 className="text-2xl font-bold text-white">{gymName}</h1>
                    </div>

                    <nav className="flex-1 p-4 space-y-1">
                        {navigation.map((item) => {
                            const isActive = location.pathname === item.href ||
                                (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
                            return (
                                <Link
                                    key={item.name}
                                    to={item.href}
                                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all ${isActive
                                        ? 'text-white'
                                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                                    }`}
                                    style={isActive ? {
                                        backgroundColor: `${brandColor}20`,
                                        borderLeft: `3px solid ${brandColor}`,
                                    } : {}}
                                >
                                    <item.icon
                                        className="w-5 h-5 mr-3"
                                        style={isActive ? { color: brandColor } : {}}
                                    />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="p-4 border-t border-white/10">
                        <form action="/auth/logout" method="post">
                            <button
                                type="submit"
                                className="flex items-center w-full px-4 py-3 text-sm font-medium text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                            >
                                <LogOut className="w-5 h-5 mr-3" />
                                Cerrar sesión
                            </button>
                        </form>
                    </div>
                </aside>

                {/* Mobile Navigation */}
                <div className="md:hidden bg-white/5 backdrop-blur-md border-b border-white/10 p-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-6 rounded-full" style={{ backgroundColor: brandColor }} />
                        <h1 className="text-xl font-bold text-white">{gymName}</h1>
                    </div>
                </div>

                {/* Main Content — extra bottom padding accounts for bottom nav + iOS home indicator */}
                <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
                    <div className="p-4 md:p-8 md:pb-8">
                        <Outlet />
                    </div>
                </main>

                {/* Bottom Navigation for Mobile — safe area aware */}
                <nav
                    className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-950/95 backdrop-blur-md border-t border-white/10 z-50"
                    style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
                >
                    <div className="flex items-stretch overflow-x-auto scrollbar-none px-1 pt-1 pb-1">
                        {navigation.map((item) => {
                            const isActive = location.pathname === item.href ||
                                (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
                            return (
                                <Link
                                    key={item.name}
                                    to={item.href}
                                    className={`flex flex-col items-center justify-center shrink-0 py-2 px-3 rounded-lg transition-colors min-h-[52px] min-w-[64px] ${isActive ? 'text-white' : 'text-white/70'}`}
                                >
                                    <item.icon
                                        className="w-5 h-5 mb-0.5 shrink-0"
                                        style={isActive ? { color: brandColor } : {}}
                                    />
                                    <span className="text-[9px] leading-tight text-center font-medium whitespace-nowrap">
                                        {item.name}
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                </nav>
            </div>
        </>
    );
}
