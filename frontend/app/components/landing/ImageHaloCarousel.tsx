import {
  motion,
  type PanInfo,
  animate,
  useAnimationFrame,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion"
import React, { useEffect, useMemo, useRef, useState } from "react"

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

function RingCard({
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
  angle: ReturnType<typeof useSpring>
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
  const y = useTransform(a, (rad) => Math.sin(rad) * (isMobile ? 8 : 12))

  // depth 0..1 según z
  const depth01 = useTransform(z, (zz) => (zz + radiusZ) / (2 * radiusZ))

  const scale = useTransform(depth01, (d) => 0.7 + d * 0.38)
  const opacity = useTransform(depth01, (d) => 0.25 + d * 0.75)

  /**
   * ROTATEY FLUIDO:
   * En vez de normalizeAngleDeg (que tiene salto en 180/-180),
   * usamos una función periódica continua.
   * - sin(rad) es continua, sin cortes.
   * - Máxima rotación en los lados, 0 al frente/atrás.
   */
  const rotateYRaw = useTransform(a, (rad) => {
    const max = isMobile ? 16 : 22 // grados máximos de giro
    return -Math.sin(rad) * max
  })

  // Suaviza aún más el giro propio (evita “micro-jitters”)
  const rotateY = useSpring(rotateYRaw, { stiffness: 260, damping: 34, mass: 0.9 })

  const shadow = useTransform(depth01, (d) =>
    d > 0.85
      ? "0 28px 60px -16px rgba(255,255,255,0.18), 0 0 0 1px rgba(255,255,255,0.06)"
      : "0 12px 34px -14px rgba(255,255,255,0.10)",
  )

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
          className="h-full w-full object-cover"
          draggable={false}
        />
        {/* Label overlay */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-6">
          <span className="text-white text-xl font-bold tracking-tight transform-gpu translate-z-10">
            {image.label}
          </span>
        </div>
      </motion.div>
    </motion.div>
  )
}

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

  // “Más alejado” en móvil: cámara más lejos
  const perspective = isMobile ? 1700 : 1200
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

  // Auto-rotación: estable y sin “cosas raras”
  useAnimationFrame((_t, deltaMs) => {
    if (total <= 1) return

    const now = Date.now()
    const recently = now - lastInteractTs.current < 800
    if (isInteractingRef.current || recently) return

    // Evita números enormes con el tiempo (sin brincos visibles)
    const a = angleRaw.get()
    if (Math.abs(a) > 100000) angleRaw.set(normalizeAngleDeg(a))

    const deltaSec = deltaMs / 1000
    angleRaw.set(angleRaw.get() + autoRotateSpeedDeg * deltaSec)
  })

  // Active index
  useAnimationFrame(() => {
    if (total <= 0) return
    const a = angleRaw.get()
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
    <div className="relative flex h-[600px] w-full items-center justify-center overflow-hidden">
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

      {/* Counter */}
      <div className="absolute left-8 top-1/2 -translate-y-1/2">
        <div className="flex flex-col items-center">
          <span className="tabular-nums text-4xl font-light text-white">
            {String(activeIndex + 1).padStart(2, "0")}
          </span>
          <div className="my-2 h-px w-8 bg-white/20" />
          <span className="tabular-nums text-sm text-neutral-400">{String(total).padStart(2, "0")}</span>
        </div>
      </div>
    </div>
  )
}
