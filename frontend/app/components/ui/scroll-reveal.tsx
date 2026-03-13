import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function ScrollReveal({
    children,
    className,
    delay = 0,
    y = 20,
    duration = 0.5,
}: {
    children: ReactNode;
    className?: string;
    delay?: number;
    y?: number;
    duration?: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration, delay, ease: "easeOut" }}
            className={className}
        >
            {children}
        </motion.div>
    );
}
