import { createContext, useContext, useState, type ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────────

export interface Coach {
    id: string;
    name: string;
    email: string;
    role: "titular" | "part-time" | "sustituto";
    specialties: string[];
    status: "activo" | "invitado" | "inactivo";
    sessionsThisMonth: number;
    joinedAt: string;
    avatar: string;
}

export interface TenantConfig {
    id: string;
    name: string;
    logo: string;           // URL or emoji fallback
    primaryColor: string;   // e.g. "#8e44ad" for a Yoga studio
    accentColor: string;    // Secondary color for gradients
    taxRegion: "MX" | "AR" | "CL";
    currency: string;       // e.g. "MXN", "ARS", "CLP"
    timezone: string;       // e.g. "America/Mexico_City"
    features: {
        fitcoins: boolean;
        waitlist: boolean;
        fiscal: boolean;
        qrAccess: boolean;
    };
    coaches: Coach[];
}

interface TenantContextType {
    config: TenantConfig;
    updateTenant: (updates: Partial<TenantConfig>) => void;
    addCoach: (coach: Coach) => void;
    removeCoach: (id: string) => void;
}

// ─── Default Tenant (GrindProject) ───────────────────────────────
export const DEFAULT_TENANT: TenantConfig = {
    id: "project-studio-mx",
    name: "Project Studio",
    logo: "💪",
    primaryColor: "#7c3aed",  // violet-700
    accentColor: "#2563eb",   // blue-600
    taxRegion: "MX",
    currency: "MXN",
    timezone: "America/Mexico_City",
    features: {
        fitcoins: true,
        waitlist: true,
        fiscal: true,
        qrAccess: true,
    },
    coaches: [],
};

// ─── Context ──────────────────────────────────────────────────────
const TenantContext = createContext<TenantContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────
export function TenantProvider({
    config: initialConfig,
    children,
}: {
    config: TenantConfig;
    children: ReactNode;
}) {
    const [config, setConfig] = useState<TenantConfig>(initialConfig);

    const updateTenant = (updates: Partial<TenantConfig>) => {
        setConfig(prev => ({ ...prev, ...updates }));
    };

    const addCoach = (coach: Coach) => {
        setConfig(prev => ({ ...prev, coaches: [...prev.coaches, coach] }));
    };

    const removeCoach = (id: string) => {
        setConfig(prev => ({ ...prev, coaches: prev.coaches.filter(c => c.id !== id) }));
    };

    return (
        <TenantContext.Provider value={{ config, updateTenant, addCoach, removeCoach }}>
            <div
                style={
                    {
                        "--primary-brand": config.primaryColor,
                        "--accent-brand": config.accentColor,
                    } as React.CSSProperties
                }
            >
                {children}
            </div>
        </TenantContext.Provider>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────
export function useTenant() {
    const context = useContext(TenantContext);
    if (!context) {
        throw new Error("useTenant debe usarse dentro de un TenantProvider");
    }
    return context;
}

