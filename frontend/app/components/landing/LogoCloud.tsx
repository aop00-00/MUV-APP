import { InfiniteSlider } from "~/components/ui/infinite-slider";
import { cn } from "~/lib/utils";
import React from "react";

type Logo = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
};

type LogoCloudProps = React.ComponentProps<"div"> & {
  logos: Logo[];
};

export function LogoCloud({ className, logos, ...props }: LogoCloudProps) {
  return (
    <div
      {...props}
      className={cn(
        "overflow-hidden py-16",
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-4 mb-10 text-center">
        <p className="text-white/40 text-xs font-bold uppercase tracking-[0.3em] mb-3">
          CLIENTES QUE TRANSFORMAN LA INDUSTRIA
        </p>
        <h3 className="text-white/80 text-xl md:text-2xl font-semibold">
          Más de <span className="text-white">500 estudios</span> operan con Project Studio
        </h3>
      </div>

      <div className="[mask-image:linear-gradient(to_right,transparent_0%,black_10%,black_90%,transparent_100%)]">
        <InfiniteSlider gap={80} reverse speed={40} speedOnHover={15}>
          {[...logos, ...logos, ...logos, ...logos].map((logo, idx) => (
            <img
              alt={logo.alt}
              className="pointer-events-none h-6 select-none md:h-8 opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500"
              height={logo.height || "auto"}
              key={`logo-${logo.alt}-${idx}`}
              loading="lazy"
              src={logo.src}
              width={logo.width || "auto"}
            />
          ))}
        </InfiniteSlider>
      </div>
    </div>
  );
}
