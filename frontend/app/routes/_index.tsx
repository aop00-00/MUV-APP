// app/routes/_index.tsx
// Landing page — conditionally renders:
//   • SaaS marketing landing (grindproject.com)
//   • Gym subdomain landing with auth (estudio.grindproject.com)

import type { Route } from "./+types/_index";
import SaasLanding from "~/components/landing/SaasLanding";
import GymLanding from "~/components/landing/GymLanding";
import type { GymLandingData } from "~/services/gym-lookup.server";

// ─── Loader ──────────────────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { getSubdomain } = await import("~/services/subdomain.server");
    const subdomain = getSubdomain(request);

    if (!subdomain) {
        return { mode: "saas" as const, gym: null };
    }

    const { getGymLandingData } = await import("~/services/gym-lookup.server");
    const gym = await getGymLandingData(subdomain);

    if (!gym) {
        throw new Response("Estudio no encontrado", { status: 404 });
    }

    return { mode: "gym" as const, gym };
}

// ─── Meta ────────────────────────────────────────────────────────
export function meta({ data }: Route.MetaArgs) {
    if (data?.mode === "gym" && data.gym) {
        const gym = data.gym as GymLandingData;
        return [
            { title: `${gym.name} — Clases, Horarios y Planes` },
            { name: "description", content: gym.tagline || `Reserva tu lugar en ${gym.name}` },
            { property: "og:title", content: gym.name },
            { property: "og:description", content: gym.tagline || `Reserva tu lugar en ${gym.name}` },
            ...(gym.hero_image_url ? [{ property: "og:image", content: gym.hero_image_url }] : []),
        ];
    }

    return [
        { title: "Project Studio – Software para estudios de Pilates, Yoga y Barre" },
        {
            name: "description",
            content:
                "Reservas online, control de acceso QR, facturación CFDI/AFIP/SII automática y CRM de leads. El software SaaS para estudios boutique de fitness en Latinoamérica.",
        },
    ];
}

// ─── Action (gym auth only) ──────────────────────────────────────
export async function action({ request }: Route.ActionArgs) {
    const { getSubdomain } = await import("~/services/subdomain.server");
    const subdomain = getSubdomain(request);

    if (!subdomain) {
        return new Response(JSON.stringify({ error: "No permitido" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { getGymBySlug } = await import("~/services/gym-lookup.server");
    const gym = await getGymBySlug(subdomain);
    if (!gym) {
        throw new Response("Estudio no encontrado", { status: 404 });
    }

    const { handleGymAuth } = await import("~/services/gym-auth.server");
    const formData = await request.formData();
    return handleGymAuth(request, gym, formData);
}

// ─── Component ───────────────────────────────────────────────────
export default function Index({ loaderData }: Route.ComponentProps) {
    if (loaderData.mode === "gym" && loaderData.gym) {
        return <GymLanding gym={loaderData.gym as GymLandingData} />;
    }

    return <SaasLanding />;
}
