// app/routes/barista/layout.tsx
import { Outlet, Link, useLocation, Form } from "react-router";
import ParticleBackground from "~/components/landing/ParticleBackground";
import { Coffee, Package, LogOut } from "lucide-react";

const navItems = [
    { to: "/barista", label: "Órdenes", icon: Coffee, end: true },
    { to: "/barista/products", label: "Productos", icon: Package },
];

export default function BaristaLayout() {
    const location = useLocation();

    return (
        <>
            <ParticleBackground />
            <div className="relative z-10 min-h-screen flex text-white">
                {/* Sidebar */}
                <aside className="w-64 bg-white/5 border-r border-white/10 hidden lg:flex flex-col backdrop-blur-md">
                    <div className="p-6 border-b border-stone-700">
                        <h1 className="text-2xl font-black tracking-tight">
                            ☕ Barista
                        </h1>
                        <p className="text-stone-400 text-xs mt-1">Panel de barista</p>
                    </div>

                    <nav className="flex-1 px-3 py-4 space-y-1">
                        {navItems.map((item) => {
                            const isActive = item.end
                                ? location.pathname === item.to
                                : location.pathname.startsWith(item.to);

                            return (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm font-medium ${isActive
                                        ? "bg-amber-600 text-white"
                                        : "text-stone-300 hover:bg-stone-800"
                                        }`}
                                >
                                    <item.icon className="w-5 h-5" />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="p-4 border-t border-stone-700 space-y-2">
                        <Link
                            to="/dashboard"
                            className="block text-xs text-stone-400 hover:text-white transition-colors px-4 py-1"
                        >
                            ← Vista de usuario
                        </Link>
                        <form action="/auth/logout" method="post">
                            <button
                                type="submit"
                                className="flex items-center gap-2 text-stone-400 hover:text-red-400 transition-colors text-sm px-4 py-1 w-full"
                            >
                                <LogOut className="w-4 h-4" />
                                Cerrar sesión
                            </button>
                        </form>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 flex flex-col">
                    {/* Mobile nav */}
                    <div className="lg:hidden flex items-center justify-between p-4 bg-stone-900 text-white">
                        <h1 className="text-xl font-bold">☕ Barista</h1>
                        <div className="flex gap-3">
                            {navItems.map((item) => (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    className="text-xs text-stone-300 hover:text-white"
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
        </>
    );
}
