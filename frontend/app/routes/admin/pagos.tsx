// admin/pagos.tsx — Mi Estudio > Métodos de Cobro
// Connect Mercado Pago, Stripe, and PayPal

import { useState } from "react";
import { Eye, EyeOff, CheckCircle2, Circle, Unlink, Link2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Gateway {
    id: string;
    name: string;
    logo: string;
    color: string;
    accentColor: string;
    description: string;
    keyLabel: string;
    keyPlaceholder: string;
    docsUrl: string;
    features: string[];
}

// ─── Gateway definitions ──────────────────────────────────────────────────────

const GATEWAYS: Gateway[] = [
    {
        id: "mercadopago",
        name: "Mercado Pago",
        logo: "https://http2.mlstatic.com/frontend-assets/mp-web-navigation/ui-navigation/6.6.74/mercadopago/logo__large@2x.png",
        color: "border-sky-400/30 bg-sky-500/5",
        accentColor: "#009EE3",
        description: "Acepta pagos con tarjeta, OXXO, transferencia SPEI y Mercado Crédito. Ideal para México y Latinoamérica.",
        keyLabel: "Access Token",
        keyPlaceholder: "APP_USR-...",
        docsUrl: "https://www.mercadopago.com.mx/developers",
        features: ["Tarjeta débito y crédito", "OXXO Pay", "SPEI / CLABE", "Meses sin intereses"],
    },
    {
        id: "stripe",
        name: "Stripe",
        logo: "https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg",
        color: "border-violet-400/30 bg-violet-500/5",
        accentColor: "#635BFF",
        description: "Cobros internacionales con tarjeta, Apple Pay y Google Pay. Perfecto para studios con clientes en el extranjero.",
        keyLabel: "Secret Key",
        keyPlaceholder: "sk_live_...",
        docsUrl: "https://dashboard.stripe.com/apikeys",
        features: ["Visa / Mastercard", "Apple Pay & Google Pay", "Pagos en divisas", "Facturación automática"],
    },
    {
        id: "paypal",
        name: "PayPal",
        logo: "https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg",
        color: "border-blue-400/30 bg-blue-500/5",
        accentColor: "#003087",
        description: "Pagos digitales globales. Tus clientes pagan con su saldo PayPal o con tarjeta sin necesidad de crear cuenta.",
        keyLabel: "Client ID",
        keyPlaceholder: "AX...",
        docsUrl: "https://developer.paypal.com",
        features: ["Saldo PayPal", "Tarjeta sin cuenta", "Protección al comprador", "135+ divisas"],
    },
];

// ─── Gateway Card ─────────────────────────────────────────────────────────────

function GatewayCard({ gateway }: { gateway: Gateway }) {
    const [apiKey, setApiKey] = useState("");
    const [connected, setConnected] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [error, setError] = useState("");

    function handleConnect() {
        if (!apiKey.trim()) {
            setError("Ingresa tu clave de API para continuar.");
            return;
        }
        setError("");
        setConnected(true);
    }

    function handleDisconnect() {
        setApiKey("");
        setConnected(false);
        setError("");
    }

    return (
        <div className={`rounded-2xl border p-6 space-y-5 transition-all duration-200 ${connected ? "border-green-400/40 bg-green-500/5" : gateway.color}`}>

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center overflow-hidden shrink-0">
                        <img src={gateway.logo} alt={gateway.name} className="w-8 h-auto object-contain" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-base leading-tight">{gateway.name}</h3>
                        <p className="text-[11px] text-white/40 mt-0.5">{gateway.description}</p>
                    </div>
                </div>

                {/* Status pill */}
                {connected ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold shrink-0 border border-green-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Conectado
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5/10 text-white/50 text-xs font-semibold shrink-0 border border-white/[0.08]">
                        <Circle className="w-3.5 h-3.5" />
                        Sin conectar
                    </span>
                )}
            </div>

            {/* Features */}
            <div className="flex flex-wrap gap-1.5">
                {gateway.features.map((f) => (
                    <span
                        key={f}
                        className="px-2 py-0.5 rounded-full text-[11px] font-medium border"
                        style={{
                            color: gateway.accentColor,
                            borderColor: gateway.accentColor + "33",
                            background: gateway.accentColor + "0D",
                        }}
                    >
                        {f}
                    </span>
                ))}
            </div>

            {/* API Key input */}
            {!connected ? (
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">
                            {gateway.keyLabel}
                        </label>
                        <div className="flex items-center border border-white/[0.08] rounded-xl overflow-hidden focus-within:border-gray-400 transition-colors bg-white/5">
                            <input
                                type={showKey ? "text" : "password"}
                                value={apiKey}
                                onChange={(e) => { setApiKey(e.target.value); setError(""); }}
                                placeholder={gateway.keyPlaceholder}
                                className="flex-1 pl-3 pr-2 py-2.5 text-sm focus:outline-none bg-transparent font-mono"
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey((v) => !v)}
                                className="px-3 text-white/40 hover:text-white/70 transition-colors"
                            >
                                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <a
                            href={gateway.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-white/40 hover:text-white/70 underline underline-offset-2 transition-colors"
                        >
                            ¿Dónde encuentro mi clave?
                        </a>
                        <button
                            type="button"
                            onClick={handleConnect}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
                            style={{ backgroundColor: gateway.accentColor }}
                        >
                            <Link2 className="w-3.5 h-3.5" />
                            Conectar
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-white/50">Clave registrada correctamente.</p>
                        <p className="text-xs font-mono text-white/40 mt-0.5">
                            {"•".repeat(8)} {apiKey.slice(-6)}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleDisconnect}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-red-500 border border-red-200 hover:bg-red-50 transition-all active:scale-95"
                    >
                        <Unlink className="w-3.5 h-3.5" />
                        Desconectar
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Pagos() {
    return (
        <div className="space-y-6 max-w-3xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-black text-white">Métodos de Cobro</h1>
                <p className="text-white/50 text-sm mt-0.5">
                    Conecta tu pasarela de pago para que tus alumnas puedan pagar membresías, clases y paquetes directamente en tu estudio.
                </p>
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <span className="text-xl mt-0.5">🔒</span>
                <p className="text-sm text-amber-800">
                    Tus claves se almacenan de forma segura y <strong>nunca se comparten</strong> con terceros.
                    Las transacciones van directamente a tu cuenta de cada pasarela.
                </p>
            </div>

            {/* Gateway cards */}
            <div className="space-y-4">
                {GATEWAYS.map((gateway) => (
                    <GatewayCard key={gateway.id} gateway={gateway} />
                ))}
            </div>
        </div>
    );
}
