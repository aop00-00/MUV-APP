// app/routes/staff/layout.tsx
// Front Desk panel layout — accessible by admin and front_desk roles.
// Optimized for tablet touch use in gym reception.

import { Link, Outlet, useLocation } from "react-router";
import { QrCode, CalendarDays, ShoppingCart, UserPlus, LogOut } from "lucide-react";
import type { Route } from "./+types/layout";

export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymFrontDesk } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymFrontDesk(request);
    return { profile, gymId };
}

const TABS = [
    { href: "/staff/checkin",  label: "Check-in",  icon: QrCode },
    { href: "/staff/schedule", label: "Clases",    icon: CalendarDays },
    { href: "/staff/pos",      label: "POS",        icon: ShoppingCart },
    { href: "/staff/walkin",   label: "Walk-in",    icon: UserPlus },
];

export default function StaffLayout({ loaderData }: Route.ComponentProps) {
    const { profile } = loaderData;
    const location = useLocation();

    return (
        <div className="min-h-screen bg-gray-950 flex flex-col">
            {/* Top header */}
            <header className="bg-gray-900 border-b border-white/10 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center">
                        <QrCode className="w-5 h-5 text-black" />
                    </div>
                    <div>
                        <p className="text-white font-bold text-sm leading-none">Front Desk</p>
                        <p className="text-white/40 text-xs mt-0.5">{profile.full_name}</p>
                    </div>
                </div>
                <Link
                    to="/auth/logout"
                    className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-xs transition-colors p-2"
                >
                    <LogOut className="w-4 h-4" />
                    Salir
                </Link>
            </header>

            {/* Page content */}
            <main className="flex-1 overflow-auto pb-24">
                <Outlet />
            </main>

            {/* Bottom tab bar — touch-first navigation */}
            <nav className="fixed bottom-0 inset-x-0 bg-gray-900 border-t border-white/10 flex safe-area-inset-bottom">
                {TABS.map(({ href, label, icon: Icon }) => {
                    const active = location.pathname === href || location.pathname.startsWith(href + "/");
                    return (
                        <Link
                            key={href}
                            to={href}
                            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${
                                active ? "text-amber-400" : "text-white/40 hover:text-white/70"
                            }`}
                        >
                            <Icon className="w-6 h-6" />
                            <span className="text-xs font-medium">{label}</span>
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
