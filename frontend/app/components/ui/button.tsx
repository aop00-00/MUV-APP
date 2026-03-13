// app/components/ui/button.tsx
// Lightweight Button component matching the shadcn/ui API surface.

import React from "react";
import { cn } from "~/lib/utils";

type Variant = "default" | "outline" | "ghost" | "link";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    asChild?: boolean;
    children?: React.ReactNode;
}

const variantClasses: Record<Variant, string> = {
    default:
        "bg-white text-black hover:bg-white/85 shadow-sm",
    outline:
        "border border-white/20 bg-transparent text-white hover:bg-white/10",
    ghost:
        "bg-transparent text-white/70 hover:text-white hover:bg-white/5",
    link: "underline-offset-4 hover:underline text-white p-0",
};

const sizeClasses: Record<Size, string> = {
    sm: "h-8 px-4 text-xs rounded-lg",
    md: "h-9 px-4 text-sm rounded-lg",
    lg: "h-11 px-6 text-base rounded-xl",
    icon: "h-9 w-9 rounded-lg",
};

export function Button({
    variant = "default",
    size = "md",
    asChild = false,
    className,
    children,
    ...props
}: ButtonProps) {
    const classes = cn(
        "inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
        variantClasses[variant],
        sizeClasses[size],
        className
    );

    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children as React.ReactElement<React.HTMLAttributes<HTMLElement>>, {
            className: cn(classes, (children as React.ReactElement<React.HTMLAttributes<HTMLElement>>).props.className),
        });
    }

    return (
        <button className={classes} {...props}>
            {children}
        </button>
    );
}
