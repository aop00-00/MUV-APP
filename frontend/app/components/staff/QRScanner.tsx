// app/components/staff/QRScanner.tsx
// Real camera-based QR code scanner using @zxing/library.
// Lazy-loaded — never runs during SSR.
// Uses rear camera on mobile, falls back to any available camera.

import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, CameraOff, RotateCcw } from "lucide-react";

interface QRScannerProps {
    onScan: (data: string) => void;
    active?: boolean;
}

type ScannerState = "requesting" | "active" | "paused" | "error";

export default function QRScanner({ onScan, active = true }: QRScannerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [state, setState] = useState<ScannerState>("requesting");
    const [errorMsg, setErrorMsg] = useState("");
    const readerRef = useRef<any>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const startScanner = useCallback(async () => {
        setState("requesting");
        setErrorMsg("");

        try {
            // Dynamic import to avoid SSR issues
            const { BrowserQRCodeReader } = await import("@zxing/library");

            const reader = new BrowserQRCodeReader();
            readerRef.current = reader;

            // Prefer rear camera on mobile devices
            const devices = await reader.listVideoInputDevices();
            let selectedDeviceId: string | undefined;
            if (devices.length > 0) {
                // Prefer camera labeled "back" / "rear" / "environment"
                const rear = devices.find((d: MediaDeviceInfo) =>
                    /back|rear|environment/i.test(d.label)
                );
                selectedDeviceId = rear?.deviceId ?? devices[devices.length - 1]?.deviceId;
            }

            if (!videoRef.current) return;

            setState("active");

            await reader.decodeFromVideoDevice(
                selectedDeviceId ?? null,
                videoRef.current,
                (result, error) => {
                    if (result) {
                        const text = result.getText();
                        // Haptic feedback on supported devices
                        if (navigator.vibrate) navigator.vibrate(100);
                        onScan(text);
                    }
                }
            );
        } catch (err: any) {
            const msg = err?.message ?? String(err);
            if (msg.includes("Permission") || msg.includes("NotAllowed")) {
                setErrorMsg("Permiso de cámara denegado. Actívalo en la configuración del navegador.");
            } else if (msg.includes("NotFound") || msg.includes("DevicesNotFound")) {
                setErrorMsg("No se encontró ninguna cámara en este dispositivo.");
            } else if (msg.includes("https") || msg.includes("secure")) {
                setErrorMsg("Se requiere HTTPS para acceder a la cámara.");
            } else {
                setErrorMsg(`Error de cámara: ${msg}`);
            }
            setState("error");
        }
    }, [onScan]);

    const stopScanner = useCallback(() => {
        if (readerRef.current) {
            readerRef.current.reset();
            readerRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setState("paused");
    }, []);

    useEffect(() => {
        if (active) {
            startScanner();
        } else {
            stopScanner();
        }
        return () => { stopScanner(); };
    }, [active, startScanner, stopScanner]);

    return (
        <div className="relative w-full aspect-square max-w-sm mx-auto rounded-2xl overflow-hidden bg-black">
            {/* Camera feed */}
            <video
                ref={videoRef}
                className={`w-full h-full object-cover ${state === "active" ? "opacity-100" : "opacity-0"}`}
                playsInline
                muted
            />

            {/* Viewfinder overlay */}
            {state === "active" && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-56 h-56 relative">
                        {/* Corner brackets */}
                        <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
                        <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
                        <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
                        <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />
                        {/* Scan line animation */}
                        <div className="absolute inset-x-4 top-4 h-0.5 bg-amber-400/70 animate-scan-line" />
                    </div>
                    <p className="absolute bottom-4 text-white/70 text-xs font-medium text-center px-4">
                        Apunta al QR del socio
                    </p>
                </div>
            )}

            {/* Requesting camera */}
            {state === "requesting" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-900">
                    <Camera className="w-10 h-10 text-amber-400 animate-pulse" />
                    <p className="text-white/60 text-sm text-center px-6">Activando cámara…</p>
                </div>
            )}

            {/* Paused */}
            {state === "paused" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-900">
                    <CameraOff className="w-10 h-10 text-white/30" />
                    <p className="text-white/40 text-sm">Escáner pausado</p>
                </div>
            )}

            {/* Error state */}
            {state === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gray-900 p-6">
                    <CameraOff className="w-10 h-10 text-red-400" />
                    <p className="text-red-300 text-sm text-center">{errorMsg}</p>
                    <button
                        onClick={startScanner}
                        className="flex items-center gap-2 bg-amber-400 text-black font-bold px-4 py-2.5 rounded-xl text-sm"
                    >
                        <RotateCcw className="w-4 h-4" /> Reintentar
                    </button>
                </div>
            )}
        </div>
    );
}
