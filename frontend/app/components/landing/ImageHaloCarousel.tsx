import {
  motion,
  type PanInfo,
  animate,
  useAnimationFrame,
  useMotionValue,
  useSpring,
  useTransform,
  MotionValue,
} from "framer-motion"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "~/lib/utils"

interface ImageItems {
  id: number
  src: string
  label?: string
  alt: string
}

interface HorizontalRingCarouselProps {
  images: ImageItems[]
  radiusX?: number
  radiusZ?: number
  cardW?: number
  cardH?: number
  autoRotateSpeedDeg?: number // deg/s
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function normalizeAngleDeg(a: number) {
  // (-180, 180]
  let x = ((a % 360) + 360) % 360
  if (x > 180) x -= 360
  return x
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()

    if (mql.addEventListener) mql.addEventListener("change", onChange)
    else mql.addListener(onChange)

    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange)
      else mql.removeListener(onChange)
    }
  }, [query])

  return matches
}

const RingCard = React.memo(function RingCard({
  image,
  index,
  stepDeg,
  angle, // spring motion value (deg)
  radiusX,
  radiusZ,
  cardW,
  cardH,
  isMobile,
}: {
  image: ImageItems
  index: number
  stepDeg: number
  angle: MotionValue<number>
  radiusX: number
  radiusZ: number
  cardW: number
  cardH: number
  isMobile: boolean
}) {
  // a = (index*step + angle) en radianes
  const a = useTransform(angle, (deg) => ((index * stepDeg + deg) * Math.PI) / 180)
  const x = useTransform(a, (rad) => Math.cos(rad) * radiusX)
  const z = useTransform(a, (rad) => Math.sin(rad) * radiusZ)

  // Consolidamos todos los cálculos en un solo transform por propiedad para evitar errores de iteración y mejorar performance
  const scale = useTransform(a, (rad) => {
    const f = (Math.cos(rad) + 1) / 2
    return 0.7 + f * 0.38
  })

  const opacity = useTransform(a, (rad) => {
    const f = (Math.cos(rad) + 1) / 2
    // Mapeo: 0..0.2..1 -> 0.15..0.4..1
    if (f < 0.2) return 0.15 + (f / 0.2) * (0.4 - 0.15)
    return 0.4 + ((f - 0.2) / 0.8) * (1 - 0.4)
  })

  const y = useTransform(a, (rad) => (isMobile ? 0 : Math.sin(rad) * 12))

  const rotateYRaw = useTransform(a, (rad) => {
    const max = isMobile ? 16 : 22
    return -Math.sin(rad) * max
  })

  const rotateYSpring = useSpring(rotateYRaw, { stiffness: 260, damping: 34, mass: 0.9 })
  const rotateY = isMobile ? rotateYRaw : rotateYSpring

  const shadow = useTransform(a, (rad) => {
    const f = (Math.cos(rad) + 1) / 2
    if (isMobile) {
      return f > 0.8 ? "0 10px 20px rgba(0,0,0,0.4)" : "0 4px 10px rgba(0,0,0,0.2)"
    }
    return f > 0.8
      ? "0 28px 60px -16px rgba(255,255,255,0.18), 0 0 0 1px rgba(255,255,255,0.06)"
      : "0 12px 34px -14px rgba(255,255,255,0.10)"
  })

  return (
    <motion.div
      className="absolute"
      style={{
        transformStyle: "preserve-3d",
        x,
        y,
        z, // translateZ
        scale,
        opacity,
        rotateY,
        willChange: "transform, opacity",
      }}
    >
      <motion.div
        className="relative overflow-hidden rounded-3xl bg-neutral-900 border border-white/10 shadow-none transition-all duration-300"
        style={{
          width: cardW,
          height: cardH,
          boxShadow: shadow as unknown as string,
        }}
      >
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/10 via-transparent to-transparent" />
        <img
          src={image.src || "/placeholder.svg"}
          alt={image.alt}
          decoding="async"
          className="h-full w-full object-cover"
          draggable={false}
        />
        {/* Label overlay */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/95 via-black/40 to-transparent flex flex-col justify-end p-6">
          <span className={cn(
            "text-white text-xl font-bold tracking-tight",
            !isMobile && "transform-gpu translate-z-10"
          )}>
            {image.label}
          </span>
        </div>
      </motion.div>
    </motion.div>
  )
})

export default function ImageHaloCarousel({
  images,
  radiusX = 320,
  radiusZ = 240,
  cardW = 280,
  cardH = 420,
  autoRotateSpeedDeg = 10,
}: HorizontalRingCarouselProps) {
  const total = images.length
  const stepDeg = useMemo(() => (total > 0 ? 360 / total : 0), [total])

  const isMobile = useMediaQuery("(max-width: 640px)")

  // Ajustes responsivos (más pequeñas en móvil)
  const rx = isMobile ? Math.round(radiusX * 0.72) : radiusX
  const rz = isMobile ? Math.round(radiusZ * 0.72) : radiusZ
  const cw = isMobile ? Math.round(cardW * 0.8) : cardW
  const ch = isMobile ? Math.round(cardH * 0.8) : cardH

  // “Más alejado” en móvil: cámara más lejos (perspectiva alta = menos distorsión 3D costosa)
  const perspective = isMobile ? 2200 : 1200
  const mobileRingScale = isMobile ? 0.9 : 1
  const mobileRingZ = isMobile ? -140 : 0 // aleja el aro en el eje Z

  // Motion values para estabilidad
  const angleRaw = useMotionValue(0) // deg
  const angle = useSpring(angleRaw, { stiffness: 220, damping: 32, mass: 1 })

  const isInteractingRef = useRef(false)
  const lastInteractTs = useRef(0)
  const inertiaAnimRef = useRef<ReturnType<typeof animate> | null>(null)

  const [activeIndex, setActiveIndex] = useState(0)

  const setInteracting = (v: boolean) => {
    isInteractingRef.current = v
    if (v) lastInteractTs.current = Date.now()
  }

  const stopInertia = () => {
    inertiaAnimRef.current?.stop()
    inertiaAnimRef.current = null
  }

  // Unificamos loops de animación para mejorar el rendimiento
  useAnimationFrame((_t, deltaMs) => {
    if (total <= 1) return

    const now = Date.now()
    const recently = now - lastInteractTs.current < 800
    const a = angleRaw.get()

    // 1. Auto-rotación
    if (!isInteractingRef.current && !recently) {
      if (Math.abs(a) > 100000) angleRaw.set(normalizeAngleDeg(a))
      const deltaSec = deltaMs / 1000
      angleRaw.set(a + autoRotateSpeedDeg * deltaSec)
    }

    // 2. Cálculo de Active Index (solo actualiza si cambia)
    let bestI = 0
    let best = Number.POSITIVE_INFINITY
    for (let i = 0; i < total; i++) {
      const d = Math.abs(normalizeAngleDeg(i * stepDeg + a))
      if (d < best) {
        best = d
        bestI = i
      }
    }
    setActiveIndex((prev) => (prev === bestI ? prev : bestI))
  })

  const handleDragStart = () => {
    setInteracting(true)
    stopInertia()
  }

  const handleDrag = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setInteracting(true)
    const sensitivity = 0.22 // deg/px
    const deltaDeg = -info.delta.x * sensitivity
    angleRaw.set(angleRaw.get() + deltaDeg)
  }

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const v = info.velocity.x // px/s
    const velocityToDeg = 0.018
    const impulse = clamp(-v * velocityToDeg, -28, 28)

    stopInertia()
    inertiaAnimRef.current = animate(angleRaw, angleRaw.get() + impulse, {
      type: "spring",
      stiffness: 260,
      damping: 26,
      mass: 0.9,
    })

    setInteracting(false)
    lastInteractTs.current = Date.now()
  }

  const goToIndex = (i: number) => {
    if (total <= 1) return
    setInteracting(true)
    stopInertia()

    const target = -i * stepDeg
    inertiaAnimRef.current = animate(angleRaw, target, {
      type: "spring",
      stiffness: 240,
      damping: 30,
      mass: 1,
    })

    lastInteractTs.current = Date.now()
    window.setTimeout(() => setInteracting(false), 350)
  }

  return (
    <div className="relative flex h-[750px] w-full items-center justify-center overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.02] blur-3xl" />
      </div>

      {/* Stage */}
      <motion.div className="relative select-none" style={{ perspective }}>
        <motion.div
          className="relative"
          style={{
            width: isMobile ? 380 : 760,
            height: isMobile ? 430 : 560,
            transformStyle: "preserve-3d",
          }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.06}
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
        >
          {/* Este wrapper aleja el “aro” en móvil */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transformStyle: "preserve-3d",
              transform: `translateZ(${mobileRingZ}px) scale(${mobileRingScale})`,
            }}
          >
            {images.map((img, i) => (
              <RingCard
                key={img.id}
                image={img}
                index={i}
                stepDeg={stepDeg}
                angle={angle}
                radiusX={rx}
                radiusZ={rz}
                cardW={cw}
                cardH={ch}
                isMobile={isMobile}
              />
            ))}
          </div>
        </motion.div>
      </motion.div>

      {/* Dots */}
      <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 items-center gap-2">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => goToIndex(i)}
            className={`h-2 w-2 rounded-full transition-all duration-300 ${
              i === activeIndex ? "w-6 bg-white" : "bg-white/30 hover:bg-white/50"
            }`}
            aria-label={`Go to image ${i + 1}`}
          />
        ))}
      </div>

      {/* Counter — hidden on mobile */}
      {!isMobile && (
        <div className="absolute left-8 top-1/2 -translate-y-1/2">
          <div className="flex flex-col items-center">
            <span className="tabular-nums text-4xl font-light text-white">
              {String(activeIndex + 1).padStart(2, "0")}
            </span>
            <div className="my-2 h-px w-8 bg-white/20" />
            <span className="tabular-nums text-sm text-neutral-400">{String(total).padStart(2, "0")}</span>
          </div>
        </div>
      )}
    </div>
  )
}
