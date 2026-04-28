import { useRouteLoaderData } from "react-router";

export function useDashboardTheme() {
    const layout = useRouteLoaderData("routes/dashboard/layout") as
        | { isLight?: boolean; brandColor?: string }
        | undefined;

    const isLight = layout?.isLight ?? false;

    return isLight ? lightTokens : darkTokens;
}

// Dark theme (default — white text on dark/transparent bg)
const darkTokens = {
    // Text
    title:    "text-white",
    body:     "text-white/80",
    muted:    "text-white/60",
    faint:    "text-white/40",
    label:    "text-white/50",
    // Cards / surfaces
    card:     "bg-white/5 border border-white/10",
    cardHover:"hover:bg-white/10",
    surface:  "bg-white/[0.03]",
    // Inputs
    input:    "bg-white/10 border-white/20 text-white placeholder:text-white/30",
    // Borders
    border:   "border-white/10",
    divider:  "border-white/[0.06]",
    // Progress bars background
    track:    "bg-white/10",
    // Calendar day
    dayText:  "text-white/80",
    dayFaint: "text-white/30",
    dayToday: "bg-blue-600 text-white",
    // Pills / badges
    pill:     "bg-white/10 text-white/70",
    // Icon stroke
    icon:     "text-white/50",
} as const;

// Light theme — dark text on beige/light bg
const lightTokens = {
    title:    "text-gray-900",
    body:     "text-gray-800",
    muted:    "text-gray-600",
    faint:    "text-gray-400",
    label:    "text-gray-500",
    card:     "bg-white/70 border border-black/10",
    cardHover:"hover:bg-white/90",
    surface:  "bg-white/50",
    input:    "bg-white/70 border-black/10 text-gray-900 placeholder:text-gray-400",
    border:   "border-black/10",
    divider:  "border-black/[0.06]",
    track:    "bg-black/10",
    dayText:  "text-gray-800",
    dayFaint: "text-gray-300",
    dayToday: "bg-blue-600 text-white",
    pill:     "bg-black/[0.06] text-gray-700",
    icon:     "text-gray-400",
} as const;

export type ThemeTokens = typeof darkTokens | typeof lightTokens;
