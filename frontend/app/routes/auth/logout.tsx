import type { Route } from "./+types/logout";
// Auth moved to dynamic import inside loader/action

export async function action({ request }: Route.ActionArgs) {
    const { logout } = await import("~/services/auth.server");
    return logout(request);
}

// If someone navigates here via GET, also log them out
export async function loader({ request }: Route.LoaderArgs) {
    const { logout } = await import("~/services/auth.server");
    return logout(request);
}
