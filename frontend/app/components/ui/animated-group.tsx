// app/components/ui/animated-group.tsx
// CSS-based staggered animation wrapper (no framer-motion needed).
// Children animate in when the container enters the viewport.

import React, { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";

export interface AnimatedGroupProps {
    children: React.ReactNode;
    className?: string;
    /** Stagger delay between children in ms. Default 80ms. */
    staggerMs?: number;
    /** Base delay before first child animates, in ms. Default 0. */
    delayMs?: number;
    /** Tailwind class applied to each child wrapper BEFORE visible */
    hiddenClass?: string;
    /** Tailwind class applied to each child wrapper WHEN visible */
    visibleClass?: string;
    /** Pass the framer-motion-style variants object; only 'container.visible.transition' is used for timing. */
    variants?: {
        container?: {
            visible?: {
                transition?: {
                    staggerChildren?: number; // in seconds
                    delayChildren?: number;   // in seconds
                };
            };
        };
        item?: unknown;
    };
}

export function AnimatedGroup({
    children,
    className,
    staggerMs,
    delayMs,
    variants,
}: AnimatedGroupProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    // Extract timing from framer-motion-style variants
    const stagger =
        staggerMs ??
        (variants?.container?.visible?.transition?.staggerChildren ?? 0.08) * 1000;
    const baseDelay =
        delayMs ??
        (variants?.container?.visible?.transition?.delayChildren ?? 0) * 1000;

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.1 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const childArray = React.Children.toArray(children);

    return (
        <div ref={ref} className={className}>
            {childArray.map((child, i) => (
                <div
                    key={i}
                    style={{
                        opacity: visible ? 1 : 0,
                        transform: visible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.98)",
                        filter: visible ? "blur(0px)" : "blur(8px)",
                        transition: `opacity 0.7s ease, transform 0.7s ease, filter 0.7s ease`,
                        transitionDelay: `${baseDelay + i * stagger}ms`,
                    }}
                >
                    {child}
                </div>
            ))}
        </div>
    );
}
