# 🤖 CONTEXTO PROYECTO PARA AGENTE IA

**Última actualización:** 2026-03-20
**Versión:** 1.0
**Propósito:** Documento de contexto para agentes IA que trabajen en el proyecto

---

## 📋 INFORMACIÓN BÁSICA

### Identificación del Proyecto

```yaml
nombre: "Project Studio" (anteriormente "Grind Project")
tipo: SaaS B2B Multi-tenant
vertical: Boutique Fitness Studios
geografía: Latinoamérica (México primary)
etapa: MVP Funcional / Beta Privada
usuarios_activos: 0-2 estudios pilot
mrr_actual: $0
```

### Stack Tecnológico

```yaml
frontend:
  framework: React Router 7.12.0
  ui: React 19.2.4 + Tailwind CSS 4.1.13
  animaciones: Framer Motion 12.35.0
  lenguaje: TypeScript 5.9.2 (strict mode)

backend:
  runtime: Node.js 20.x
  server: "@react-router/serve 7.12.0"
  database: Supabase PostgreSQL
  auth: Supabase Auth + Custom JWT hooks
  orm: Supabase JS SDK 2.95.3 (NO Prisma/Drizzle)

infraestructura:
  hosting: Vercel (production + previews)
  build: Vite 7.1.7
  deploy: Auto-deploy on git push
  cdn: Vercel Edge Network

integraciones:
  pagos: [Stripe, Conekta, Mercado Pago]
  facturacion: [Facturama CFDI, AFIP, SII]
  email: Supabase Email (SMTP)
```

---

## 🎯 PROPUESTA DE VALOR CORE

### Problema que Resuelve

Dueños de estudios boutique de fitness (50-300 socios, 1-3 sedes) gastan **15-20 horas semanales** en:
- Facturación fiscal manual (CFDI México, AFIP Argentina, SII Chile)
- Gestión de reservas en WhatsApp/Excel
- Detección manual de churn de socios
- Nómina de coaches freelance

### Solución

Sistema operativo todo-en-uno que automatiza:
1. Reservas online 24/7 + calendario inteligente
2. Check-in con código QR (trazabilidad accesos)
3. Facturación fiscal automática por región
4. CRM de leads con email marketing
5. POS (Punto de Venta) integrado
6. Nómina y gestión de coaches
7. Gamificación (FitCoins) para retención

### Diferenciador Clave

**Facturación fiscal LATAM nativa** → Único en el mercado que genera CFDI (México), AFIP (Argentina), SII (Chile) automáticamente. Competidores globales (Mindbody, Wodify) no tienen esta funcionalidad.

---

## 💰 MODELO DE NEGOCIO

### Planes de Suscripción (MXN/mes)

```yaml
starter:
  precio_mensual: 999
  precio_anual: 799 (20% descuento)
  sedes: 1
  alumnos_max: 80
  features: [reservas, qr, pos_basico, email_notif]

pro:
  precio_mensual: 2099
  precio_anual: 1679
  sedes: 3
  alumnos_max: 300
  features: [starter + crm, fitcoins, email_marketing, whatsapp, soporte_prioritario]

elite:
  precio_mensual: 4099
  precio_anual: 3279
  sedes: infinito
  alumnos_max: infinito
  features: [pro + cfdi_automatico, reporteria_avanzada, soporte_vip, onboarding_dedicado]
```

### Unit Economics

```yaml
starter:
  arpa_anual: 9588 USD
  cac_estimado: 3500 USD
  ltv_cac_ratio: 2.7
  payback_period: 4 meses

pro:
  arpa_anual: 20148 USD
  cac_estimado: 5000 USD
  ltv_cac_ratio: 4.0
  payback_period: 3 meses

elite:
  arpa_anual: 39348 USD
  cac_estimado: 8000 USD
  ltv_cac_ratio: 4.9
  payback_period: 2.5 meses
```

---

## 🏗️ ARQUITECTURA TÉCNICA

### Multi-Tenancy Strategy

```yaml
tipo: Shared Database + Row Level Security (RLS)

nivel_1_aislamiento:
  metodo: Supabase RLS policies
  ejemplo: |
    CREATE POLICY "tenant_isolation" ON profiles
      FOR ALL USING (gym_id = (auth.jwt() ->> 'gym_id')::uuid);

nivel_2_jwt:
  metodo: Custom access token hook
  funcion: custom_access_token_hook(event jsonb)
  accion: Inyecta gym_id y app_role en JWT al login

nivel_3_routing:
  metodo: Subdomain routing (DNS + middleware)
  ejemplo: "estudio.projectstudio.com" → gym_id lookup → landing personalizada

ventajas:
  - Single DB = bajo costo ($0.05/GB)
  - RLS = seguridad a nivel BD
  - Escalabilidad horizontal con Supabase
  - Backup simple (single snapshot)

desventajas:
  - GDPR compliance complejo (data co-located)
  - Noisy neighbor problem posible
  - Migrations afectan todos los tenants simultáneamente
```

### Modelo de Datos Principal (26 Tablas)

```yaml
multitenancy:
  - gyms (id, owner_id, name, slug, plan_id, trial_ends_at, features, ...)
  - profiles (id, email, full_name, role, gym_id, credits, balance, ...)

scheduling:
  - classes (gym_id, title, coach_id, capacity, start_time, ...)
  - bookings (user_id, class_id, gym_id, status, ...)
  - waitlist (user_id, class_id, position, status, ...)
  - schedules (gym_id, class_name, days, time, duration, ...)
  - class_types (gym_id, name, color, credits_required, ...)

operations:
  - coaches (gym_id, name, role, rate_per_session, ...)
  - locations (gym_id, name, address, city, ...)
  - rooms (gym_id, location_id, name, capacity, ...)

commerce:
  - products (gym_id, name, price, category, stock, ...)
  - orders (gym_id, user_id, status, payment_method, total, ...)
  - order_items (order_id, product_id, quantity, unit_price, ...)
  - memberships (user_id, gym_id, plan_name, price, start_date, ...)

crm_gamification:
  - leads (gym_id, full_name, stage, source, engagement_score, ...)
  - fitcoins (user_id, gym_id, amount, source, balance_after, ...)

finance:
  - invoices (gym_id, order_id, cfdi_uuid, afip_cae, sii_folio, ...)
  - coach_payroll (gym_id, coach_id, period, total, is_paid, ...)
```

### Flujos Críticos

**Onboarding (5 pasos):**
```
1. Selección plan (Bento grid) → plan_id
2. Info studio (nombre, país, ciudad) → gym data
3. Cuenta (email, password, nombre dueño) → auth.users + profiles
4. Pago (Stripe/Conekta) → payment_intent
5. Confirmación → redirect /auth/login

Backend:
  1. Verificar email existe (eliminar si sin gym)
  2. createUser(email, password, metadata)
  3. INSERT profiles (id, email, full_name, role: 'admin')
  4. INSERT gyms (owner_id, name, slug, trial_ends_at: +7d)
  5. UPDATE profiles SET gym_id
  6. Inyectar gym_id en JWT claims
  7. CREATE session cookie
```

**Reserva de Clase:**
```
Usuario: /dashboard/schedule → Click "Reservar"
  ↓
RPC: book_class(class_id, user_id, gym_id)
  ↓
Validaciones:
  - Clase existe y tiene cupo
  - Usuario tiene ≥1 crédito
  - No está ya reservado
  ↓
Transacción atómica:
  - INSERT booking (user_id, class_id, status: 'confirmed')
  - UPDATE profiles SET credits = credits - 1
  - UPDATE classes SET current_enrolled = current_enrolled + 1
  ↓
Return: {success: true, booking_id, credits_remaining}
```

---

## 🌎 MERCADO Y COMPETENCIA

### TAM/SAM/SOM

```yaml
tam:
  mercado: 17000 boutique studios en top 5 países LATAM
  precio_promedio: 1500 USD/año
  total: 25.5M USD/año

sam:
  filtro: Studios con 50+ socios, >1 año operando, tech-savvy
  porcentaje: 40% del TAM
  total: 6800 studios = 10.2M USD/año

som_año_3:
  market_share: 0.5%
  studios: 34
  revenue: 51k USD/año
  meta_agresiva: 1-2% = 100-200k USD
```

### Competidores Principales

```yaml
mindbody:
  precio: 139-299 USD/mes
  fortaleza: Brand recognition, ecosystem maduro
  debilidad: Sin CFDI nativo, caro, soporte inglés

wodify:
  precio: 125-275 USD/mes
  fortaleza: Fuerte en CrossFit
  debilidad: Nicho CrossFit-only, sin facturación LATAM

glofox:
  precio: 109-279 EUR/mes
  fortaleza: UI moderna, marketing tools
  debilidad: Sin presencia LATAM, pricing EUR incómodo

fitco_mx:
  precio: 600-1500 MXN/mes
  fortaleza: Local México
  debilidad: Sin facturación automática, features limitados
```

---

## ⚠️ ESTADO ACTUAL Y PRIORIDADES

### Completado ✅

- Multi-tenant arquitectura con RLS
- Onboarding wizard 5 pasos
- Dashboard admin (schedule, users, POS, CRM)
- Dashboard usuario (reservas, créditos, QR)
- Reservas funcionando (book_class RPC)
- POS básico (orders, products)
- Deploy en Vercel con auto-deploy

### En Desarrollo 🔄

- Facturación CFDI (diseñado, no deployed)
- WhatsApp notifications (roadmap)
- Testing automatizado (suite vacía)

### Bloqueadores Críticos 🔴

1. **0 usuarios paying** → No PMF validado
2. **CFDI no deployed** → Feature diferenciador ausente
3. **Founder único** → Bus factor = 100%
4. **Sin testing** → Regresiones frecuentes
5. **Onboarding frágil** → Trigger profile falla

### Deuda Técnica Conocida

```yaml
trigger_profile_auto_create:
  problema: on_auth_user_created no se ejecuta correctamente
  workaround: Inserción manual en onboarding
  ubicacion: "005_fix_profiles_trigger.sql"

migrations:
  problema: Ejecutadas manualmente en SQL Editor
  riesgo: Downtime 10-30 segundos
  solucion_futura: pg-migrator o Supabase CLI

trial_duration_hardcoded:
  problema: trial_ends_at = now() + 7 días (no configurable)
  ubicacion: "app/routes/onboarding/_index.tsx"
  mejora: Agregar trial_duration_days a plan_features.ts

no_rate_limiting:
  riesgo: API abuse (script automatizado de reservas)
  solucion: Vercel rate limit + Redis (Upstash)

testing_ausente:
  setup: Playwright instalado en tests/
  estado: 0 tests escritos
  accion: Escribir 10 tests E2E críticos
```

---

## 🎯 TOP 5 PRIORIDADES (Próximos 60 días)

### 1. Validar PMF con 10 Studios Pilot
```yaml
accion: Outreach manual a 50 studios, ofrecer 3 meses gratis
meta: 10 studios activos en 60 días
success_metric: >70% retention post-trial
rationale: Sin usuarios reales, arquitectura y features = especulación
```

### 2. Deploy CFDI Automático
```yaml
accion: Integrar Facturama API (PAC certificado SAT)
meta: CFDI generado con 1 click desde POS
ubicacion: "app/services/tax.server.ts" (crear)
rationale: Feature más diferenciador, sin esto Elite no vendible en MX
```

### 3. Contratar Co-founder o VA
```yaml
accion: Buscar co-founder sales/marketing O VA filipino $500-1500/mes
responsabilidades: [soporte_inicial, onboarding_calls, content_marketing]
meta: Founder 100% enfocado en producto
rationale: Mitigar riesgo #1 (founder burnout 70% probabilidad)
```

### 4. Tests E2E Críticos
```yaml
accion: Playwright tests para flujos core
tests: [onboarding_completo, login, book_class, cancel_booking, create_order, generate_invoice]
meta: 80% coverage flujos críticos
rationale: Prevenir regresiones que matan conversión trial → paid
```

### 5. Content Marketing SEO
```yaml
accion: Publicar 1 blog post/semana
temas: ["Cómo facturar CFDI en tu gym", "Reducir churn yoga studio", "WhatsApp vs software reservas"]
tools: Webflow blog + Ahrefs keyword research
meta: 500 visitas orgánicas/mes en 90 días
rationale: CAC orgánico $0 vs $300-500 pagado (ads)
```

---

## 🤖 INSTRUCCIONES PARA AGENTES IA

### Al Trabajar en el Código

1. **SIEMPRE respetar multi-tenancy:**
   - Toda query debe filtrar por `gym_id`
   - Usar `requireGymAuth()` o `requireGymAdmin()` en loaders
   - RLS policies protegen, pero ser explícito

2. **NUNCA usar ORM externo:**
   - Proyecto usa Supabase SDK directo (NO Prisma/Drizzle)
   - Queries type-safe con codegen automático
   - RLS funciona mejor con queries raw

3. **Mantener convenciones existentes:**
   - Server functions en `app/routes/*.ts` (actions/loaders)
   - Servicios en `app/services/*.server.ts`
   - Componentes UI en `app/components/`
   - Types en `app/types/database.ts`

4. **Al crear features nuevas:**
   - Primero verificar si beneficia a los 3 tiers o solo Elite
   - Actualizar `plan-features.ts` si es feature-gated
   - Agregar a setup checklist si es configuración inicial
   - Escribir test E2E si es flujo crítico

5. **Al refactorizar:**
   - NO romper RLS policies existentes
   - NO cambiar estructura de subdomain routing
   - NO modificar JWT hook sin testing exhaustivo
   - Migrations deben ser idempotentes (IF NOT EXISTS)

### Al Analizar el Proyecto

1. **Contexto de negocio:**
   - Mercado: Studios boutique 50-300 socios (NO gyms comerciales >500)
   - Geografía: México primary, luego CO/AR/CL/PE
   - Diferenciador: CFDI/AFIP nativo (moat 6-12 meses)

2. **Prioridades actuales:**
   - PMF validation > new features
   - Stability > innovation
   - Core flows (onboarding, booking) > nice-to-haves

3. **Decisiones de arquitectura a respetar:**
   - Shared DB + RLS (NO DB per tenant)
   - React Router 7 (NO Next.js)
   - Supabase (NO Firebase/MongoDB)
   - Vercel (NO Railway/Fly.io por ahora)

### Al Proponer Mejoras

1. **Siempre considerar:**
   - ¿Esto ayuda a validar PMF con 10 studios?
   - ¿Esto reduce churn o aumenta conversión trial → paid?
   - ¿Esto libera tiempo al founder?
   - ¿ROI claro vs. esfuerzo de implementación?

2. **Red flags (NO hacer):**
   - Agregar features que solo 1-2 studios pedirían
   - Sobre-ingeniería (abstracciones innecesarias)
   - Cambios breaking sin migración clara
   - Features que aumentan complejidad sin valor proporcional

---

## 📚 DOCUMENTOS RELACIONADOS

- `ANALISIS_PROYECTO_COMPLETO.md` → Análisis exhaustivo 7 fases
- `RESUMEN_EJECUTIVO.md` → Versión ejecutiva condensada
- `frontend/README.md` → Setup técnico
- `frontend/DEBUG_ONBOARDING.md` → Troubleshooting onboarding
- `frontend/000_full_setup.sql` → Schema DB completo

---

**Última actualización:** 2026-03-20
**Próxima revisión:** Post-validación PMF (60 días)
**Maintainer:** Equipo Project Studio
