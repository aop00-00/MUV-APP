// app/routes/onboarding/layout.tsx
// Clean onboarding layout with progress bar and Grind branding.

import { Outlet, Link } from "react-router";
import ParticleBackground from "~/components/landing/ParticleBackground";
import { Logo } from "~/components/landing/Hero";

export default function OnboardingLayout() {
    return (
        <>
            <ParticleBackground />
            <div className="relative z-10 min-h-screen text-white flex flex-col">
                {/* Top bar */}
                <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <Link to="/" className="flex items-center gap-2">
                        <Logo />
                    </Link>
                    <Link to="/auth/login" className="text-sm text-gray-400 hover:text-white transition-colors">
                        Ya tengo cuenta →
                    </Link>
                </header>

                {/* Main */}
                <div className="flex-1 flex items-center justify-center px-4 py-12">
                    <Outlet />
                </div>

                {/* Footer */}
                <footer className="px-6 py-4 border-t border-white/5 text-center">
                    <p className="text-xs text-gray-600">
                        Al continuar aceptas nuestros{" "}
                        <a href="#" className="text-gray-400 hover:text-white">Términos de Servicio</a>
                        {" "}y{" "}
                        <a href="#" className="text-gray-400 hover:text-white">Política de Privacidad</a>
                    </p>
                </footer>
            </div>
        </>
    );
}

