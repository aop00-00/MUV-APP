// app/root.tsx
// Root layout for the entire app.
// The root loader identifies the gym and makes its config available to all routes.

import React, { type ReactNode } from "react";

// Workaround for Vercel SSR "ReferenceError: React is not defined"
if (typeof globalThis !== "undefined" && !globalThis.React) {
  Object.defineProperty(globalThis, "React", { value: React, writable: true, enumerable: false, configurable: true });
}

import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import type { Route } from "./+types/root";
import "./app.css";

import { Toaster } from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────
type TenantConfig = {
  id: string;
  name: string;
  logo: string;
  primaryColor: string;
  accentColor: string;
  taxRegion: "MX" | "AR" | "CL";
  currency: string;
  timezone: string;
  features: {
    fiscal: boolean;
    mercadoPago: boolean;
    accessControl: boolean;
  };
  coaches: Array<{ id: string; name: string }>;
};

const DEFAULT_TENANT: TenantConfig = {
  id: "default",
  name: "GRIND PROJECT",
  logo: "💪",
  primaryColor: "#3b82f6",
  accentColor: "#8b5cf6",
  taxRegion: "MX",
  currency: "MXN",
  timezone: "America/Mexico_City",
  features: { fiscal: false, mercadoPago: false, accessControl: false },
  coaches: [],
};

// ─── Google Fonts ─────────────────────────────────────────────────
export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Outfit:wght@100..900&display=swap",
  },
];

// ─── HTML Shell ───────────────────────────────────────────────────
export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// ─── Root Loader: identify tenant ─────────────────────────────────
// This runs on every navigation and makes the TenantConfig available
// to the entire app tree. In production, replace the TODO below with
// a Supabase query:
//
//   const profile = await requireAuth(request).catch(() => null);
//   const { data: studio } = await supabase
//     .from("studios")
//     .select("*")
//     .eq("id", profile?.studio_id)
//     .single();
//   tenant = studioToTenantConfig(studio);
//
// Until then, the default tenant (Project Studio MX) is used, with
// an optional STUDIO_TAX_REGION env-var override for staging deploys.

export async function loader({ request }: Route.LoaderArgs) {
  let tenant: TenantConfig = DEFAULT_TENANT;

  // Detect subdomain (e.g. "estudio" from estudio.grindproject.com)
  const { getSubdomain } = await import("./services/subdomain.server");
  const subdomain = getSubdomain(request);

  // Only attempt Supabase if env vars are present (avoids 500 in local dev
  // without a configured .env file or when SUPABASE_URL is missing)
  const supabaseUrl = typeof process !== "undefined" ? process.env.SUPABASE_URL : undefined;
  if (!supabaseUrl) {
    return { tenant, subdomain };
  }

  try {
    const { supabaseAdmin } = await import("./services/supabase.server");

    // Resolve which gym to display:
    // Priority: 1) subdomain slug  2) session gym_id  3) first gym in DB
    let gymId: string | null = null;

    // 1. If on a subdomain, resolve gym by slug (takes priority)
    if (subdomain) {
      const { getGymBySlug } = await import("./services/gym-lookup.server");
      const subdomainGym = await getGymBySlug(subdomain);
      if (subdomainGym) gymId = subdomainGym.id;
    }

    // 2. Try to get the authenticated user's gym_id from the session
    if (!gymId) {
      try {
        const { getSession } = await import("./services/auth.server");
        const session = await getSession(request);
        const userId = session.get("userId");
        if (userId) {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("gym_id")
            .eq("id", userId)
            .single();
          gymId = profile?.gym_id ?? null;
        }
      } catch {
        // No active session — demo mode
      }
    }

    // 3. If still no gymId (unauthenticated visitor on main domain), use first gym
    if (!gymId) {
      const { data: firstGym } = await supabaseAdmin
        .from("gyms")
        .select("id")
        .eq("plan_status", "trial")
        .order("created_at", { ascending: true })
        .limit(1)
        .single();
      gymId = firstGym?.id ?? null;
    }

    if (!gymId) return { tenant, subdomain };

    const { data: gym } = await supabaseAdmin
      .from("gyms")
      .select("id, name, logo_url, primary_color, accent_color, tax_region, currency, timezone, features")
      .eq("id", gymId)
      .single();

    if (gym) {
      tenant = {
        id: gym.id,
        name: gym.name,
        logo: gym.logo_url ?? "💪",
        primaryColor: gym.primary_color,
        accentColor: gym.accent_color,
        taxRegion: gym.tax_region as TenantConfig["taxRegion"],
        currency: gym.currency,
        timezone: gym.timezone,
        features: gym.features as TenantConfig["features"],
        coaches: [],
      };
    }
  } catch (error) {
    // Never crash the root loader — silently fall back to DEFAULT_TENANT
    if (process.env.NODE_ENV !== "production") {
      console.warn("Root loader: falling back to DEFAULT_TENANT.", (error as Error).message);
    }
  }

  return { tenant, subdomain };
}

// ─── App Root ─────────────────────────────────────────────────────
// The tenant config is available via useRouteLoaderData("root") in any route

export default function App() {
  return (
    <>
      <Outlet />
      <Toaster position="top-right" />
    </>
  );
}

// ─── Error Boundary ───────────────────────────────────────────────
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "Ocurrió un error inesperado.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "La página solicitada no existe."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">{message}</h1>
      <p className="text-gray-600 mt-2">{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto bg-gray-100 rounded-lg mt-4 text-xs">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
