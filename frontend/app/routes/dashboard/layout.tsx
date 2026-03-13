import { Link, Outlet, useLocation } from "react-router";
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

export default function DashboardLayout() {
    const location = useLocation();

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
            <ParticleBackground />
            <div className="relative z-10 min-h-screen flex flex-col md:flex-row text-white">
                {/* Sidebar Navigation */}
                <aside className="w-full md:w-64 bg-white/5 border-r border-white/10 hidden md:flex flex-col backdrop-blur-md">
                    <div className="p-6 border-b border-gray-200">
                        <h1 className="text-2xl font-bold text-gray-900">Grind Project</h1>
                    </div>

                    <nav className="flex-1 p-4 space-y-1">
                        {navigation.map((item) => {
                            const isActive = location.pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    to={item.href}
                                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                >
                                    <item.icon className="w-5 h-5 mr-3" />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="p-4 border-t border-gray-200">
                        <form action="/auth/logout" method="post">
                            <button
                                type="submit"
                                className="flex items-center w-full px-4 py-3 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            >
                                <LogOut className="w-5 h-5 mr-3" />
                                Sign Out
                            </button>
                        </form>
                    </div>
                </aside>

                {/* Mobile Navigation */}
                <div className="md:hidden bg-white border-b border-gray-200 p-4 flex justify-between items-center">
                    <h1 className="text-xl font-bold text-gray-900">Grind Project</h1>
                    {/* Mobile menu button could go here */}
                </div>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto">
                    <div className="p-8">
                        <Outlet />
                    </div>
                </main>

                {/* Bottom Navigation for Mobile */}
                <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 z-50">
                    {navigation.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                className={`flex flex-col items-center p-2 rounded-lg ${isActive ? 'text-blue-600' : 'text-gray-500'
                                    }`}
                            >
                                <item.icon className="w-6 h-6" />
                                <span className="text-xs mt-1">{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </>
    );
}
