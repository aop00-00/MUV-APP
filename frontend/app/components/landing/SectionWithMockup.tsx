import React from "react";
import { motion } from "framer-motion";

interface SectionWithMockupProps {
    title: string | React.ReactNode;
    description: string | React.ReactNode;
    primaryImageSrc: string;
    secondaryImageSrc: string;
    reverseLayout?: boolean;
}

const SectionWithMockup: React.FC<SectionWithMockupProps> = ({
    title,
    description,
    primaryImageSrc,
    secondaryImageSrc,
    reverseLayout = false,
}) => {

    const containerVariants = {
        hidden: {},
        visible: {
            transition: {
                staggerChildren: 0.3,
                delayChildren: 0.2
            }
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 60, scale: 0.98 },
        visible: { 
            opacity: 1, 
            y: 0, 
            scale: 1,
            transition: { 
                duration: 1.4, // Slightly longer for "extra smooth" feel
                ease: [0.16, 1, 0.3, 1], // Custom smooth quintic ease
            } 
        },
    } as any;

    const layoutClasses = reverseLayout
        ? "md:grid-cols-2 md:grid-flow-col-dense"
        : "md:grid-cols-2";

    const textOrderClass = reverseLayout ? "md:col-start-2" : "";
    const imageOrderClass = reverseLayout ? "md:col-start-1" : "";

    return (
        <section className="relative py-24 md:py-48 overflow-hidden">
            {/* Background decorative glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] bg-white/[0.02] blur-[120px] rounded-full pointer-events-none" />

            <div className="container max-w-[1220px] w-full px-6 md:px-10 relative z-10 mx-auto">
                <motion.div
                    className={`grid grid-cols-1 gap-16 md:gap-8 w-full items-center ${layoutClasses}`}
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                >
                    {/* Text Content */}
                    <motion.div
                        className={`flex flex-col items-start gap-4 mt-10 md:mt-0 max-w-[546px] mx-auto md:mx-0 ${textOrderClass}`}
                        variants={itemVariants}
                    >
                        <div className="space-y-2 md:space-y-1">
                            <h2 className="text-white text-3xl md:text-[40px] font-semibold leading-tight md:leading-[53px]">
                                {title}
                            </h2>
                        </div>

                        <p className="text-[#868f97] text-sm md:text-[15px] leading-6">
                            {description}
                        </p>
                    </motion.div>

                    {/* Image Content */}
                    <motion.div
                        className={`relative mt-10 md:mt-0 mx-auto ${imageOrderClass} w-full max-w-[300px] md:max-w-[471px]`}
                        variants={itemVariants}
                    >
                        {/* Decorative Background Element */}
                        <motion.div
                            className="absolute w-[300px] h-[317px] md:w-[472px] md:h-[500px] bg-[#090909] rounded-[32px] z-0"
                            style={{
                                top: reverseLayout ? 'auto' : '10%',
                                bottom: reverseLayout ? '10%' : 'auto',
                                left: reverseLayout ? 'auto' : '-20%',
                                right: reverseLayout ? '-20%' : 'auto',
                                filter: 'blur(2px)'
                            }}
                            initial={{ y: 0 }}
                            whileInView={{ y: reverseLayout ? -20 : -30 }}
                            transition={{ duration: 1.2, ease: "easeOut" }}
                            viewport={{ once: true, amount: 0.5 }}
                        >
                            <div
                                className="relative w-full h-full bg-cover bg-center rounded-[32px] opacity-40"
                                style={{
                                    backgroundImage: `url(${secondaryImageSrc})`,
                                }}
                            />
                        </motion.div>

                        {/* Main Mockup Card */}
                        <motion.div
                            className="relative w-full h-[405px] md:h-[637px] bg-[#ffffff0a] rounded-[32px] backdrop-blur-[15px] border border-white/10 z-10 overflow-hidden shadow-2xl"
                            initial={{ y: 0 }}
                            whileInView={{ y: reverseLayout ? 20 : 30 }}
                            transition={{ duration: 1.2, ease: "easeOut", delay: 0.1 }}
                            viewport={{ once: true, amount: 0.5 }}
                        >
                            <div className="p-0 h-full">
                                <div className="h-full relative overflow-hidden">
                                    {/* Primary Image */}
                                    <img
                                        src={primaryImageSrc}
                                        alt="Dashboard Mockup"
                                        className="w-full h-full object-cover object-left"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </motion.div>
            </div>

            {/* Decorative bottom gradient */}
            <div
                className="absolute w-full h-px bottom-0 left-0 z-0 text-white"
                style={{
                    background:
                        "radial-gradient(50% 50% at 50% 50%, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 100%)",
                }}
            />
        </section>
    );
};

export default SectionWithMockup;
