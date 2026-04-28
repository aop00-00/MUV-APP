# PHASE 1 ANALYSIS — Front Desk Dashboard Implementation
> Análisis previo. Sin modificaciones de código.
> Fecha: 2026-04-21

---

## 1. SISTEMA DE ROLES

### 1.1 Roles actuales

**Archivo:** `app/types/database.ts:6`
```typescript
export type UserRole = "admin" | "member" | "coach";
```

No existe ningún rol `front_desk` ni `staff`. Hay que agregarlo.

### 1.2 JWT Custom Hook

**Archivo de migración:** `migrations/001_create_gyms_and_rls.sql` (líneas 175–209)

La función `custom_access_token_hook` se configura en Supabase Dashboard → Auth → Hooks.
Inyecta dos claims en el JWT en cada autenticación:
- `gym_id` → UUID del gym tenant del perfil
- `app_role` → rol del usuario (`admin`, `member`, `coach`)

**Código relevante:**
```sql
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  claims jsonb;
  v_gym_id uuid;
  v_role text;
BEGIN
  SELECT gym_id, role INTO v_gym_id, v_role
  FROM public.profiles
  WHERE id = (event->>'user_id')::uuid;

  claims := event->'claims';
  IF v_gym_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{gym_id}', to_jsonb(v_gym_id::text));
  END IF;
  IF v_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_role}', to_jsonb(v_role));
  END IF;
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;
```

**Conclusión:** El hook es completamente aditivo — lee el campo `role` de `profiles` y lo inyecta. Para soportar `front_desk` solo hace falta:
1. Que el campo `role` en `profiles` acepte `'front_desk'` como valor válido (es un `TEXT`, no un ENUM, por lo que no hay restricción en BD).
2. Actualizar el tipo TypeScript `UserRole`.
3. Crear `requireGymFrontDesk()` en `gym.server.ts`.

### 1.3 Protección de rutas admin

**Cadena de auth:**
```
requireAuth()
  → requireGymAuth()        — valida gym_id, gym activo, trial no expirado
    → requireGymAdmin()     — verifica role === "admin"
      → requireOnboardingComplete() — verifica onboarding_completed
```

El layout `/admin` usa `requireOnboardingComplete()` en su loader. Todas las rutas admin individuales usan `requireGymAdmin()` o `requirePlanAccess()` (que llama a `requireGymAdmin()` internamente).

La protección es por **loader-guard en cada ruta** (no middleware global), lo cual es correcto para React Router 7 SSR.

**Archivo:** `app/services/gym.server.ts`

### 1.4 Rol `front_desk` — plan de acción

Para agregar el rol:
1. `app/types/database.ts` → `UserRole = "admin" | "member" | "coach" | "front_desk"`
2. `app/services/gym.server.ts` → agregar `requireGymFrontDesk()` que permite `admin | front_desk`
3. Nueva layout route `/staff` → usa `requireGymFrontDesk()` en loader
4. RLS policies → extender para incluir `'front_desk'` donde aplique

El JWT hook NO requiere cambios de código — ya lee el campo `role` de `profiles`. Si `role = 'front_desk'` en la DB, automáticamente se inyecta en el JWT.

---

## 2. MEMBRESÍAS Y ACCESO

### 2.1 Tabla `memberships`

**Definición TypeScript** (`app/types/database.ts:25`):
```typescript
export type MembershipStatus = "active" | "expired" | "cancelled";

export interface Membership {
  id: string;
  user_id: string;
  plan_name: string;       // e.g. "Plan Básico", "Plan Premium"
  status: MembershipStatus;
  price: number;
  credits_included: number;
  start_date: string;
  end_date: string;
  created_at: string;
}
```

**Nota importante:** La migración 003 tiene columnas adicionales que NO están en el tipo TS:
- `gym_id` (FK, esencial para multi-tenancy)
- `freeze_until` (DATE — para congelar membresía)
- `auto_renew` (BOOLEAN)

**La query que usa el loader de `/dashboard/profile`** consulta:
```typescript
.eq("user_id", profile.id)
.eq("gym_id", gymId)
.in("status", ["active", "frozen"])
```

Esto sugiere que `"frozen"` también es un estado válido en la BD, aunque no está en el tipo TS. Estados reales: `active | frozen | expired | cancelled`.

### 2.2 Tabla `access_logs`

**Columnas** (migration 003):
- `id` UUID PK
- `user_id` FK → profiles
- `gym_id` FK → gyms
- `access_type` → `'entry' | 'exit'`
- `qr_token` TEXT (el token escaneado)
- `validated` BOOLEAN
- `created_at` TIMESTAMPTZ

**RLS:** tenant isolation por `gym_id = (auth.jwt() ->> 'gym_id')::uuid`

### 2.3 Estado del QR en el dashboard del member

**Archivo:** `app/routes/dashboard/profile.tsx:39`

```typescript
const qrData = `GRIND:${profile.id}`;
```

El QR se muestra actualmente como **texto plano** en un `div` con borde punteado. No hay ninguna librería de QR instalada. El dato codificado es `GRIND:{profile.id}`.

**Plan:**
- Instalar `qrcode.react` para generar un QR visual real
- El Front Desk Scanner leerá `GRIND:{uuid}` → extrae `uuid` → consulta Supabase

### 2.4 Tabla `bookings`

Existe la tabla `bookings` (migration 003). Columnas clave:
- `user_id` FK → profiles
- `gym_id` FK → gyms
- `class_id` FK → classes
- `status` → `'confirmed' | 'cancelled' | 'attended' | 'waitlist'`
- `resource_id` (FK opcional → resources, para seat assignment)

---

## 3. BUG: AGREGAR SEDE (LOCATIONS)

### 3.1 Flujo completo

**Ruta:** `/admin/ubicaciones`
**Archivo:** `app/routes/admin/ubicaciones.tsx`

El loader usa `requirePlanAccess(request, "/admin/ubicaciones")` que:
1. Llama a `requireGymAdmin()` → valida rol admin
2. Obtiene `plan_id` del gym
3. Verifica que `/admin/ubicaciones` esté en las rutas permitidas del plan

El plan **Starter** incluye `/admin/ubicaciones` en sus rutas permitidas (`plan-features.ts:44`). El plan **Emprendedor** NO lo incluye.

El action usa `requireGymAdmin()` (sin `requirePlanAccess`), lo cual es correcto para el action.

### 3.2 Código `createLocation`

**Archivo:** `app/services/location.server.ts`

Usa `supabaseAdmin` (service role key) — **esto saltea RLS completamente**. Esto significa que las RLS policies NO son la causa del bug.

```typescript
const { data, error } = await supabaseAdmin
  .from("locations")
  .insert({
    gym_id: gymId,
    name, address, city, country,
    phone: phone || null,
    maps_url: mapsUrl || null,
    is_active: true,
  })
  .select()
  .single();

if (error) throw new Error(`Error creating location: ${error.message}`);
```

### 3.3 Diagnóstico del bug — causa raíz probable

**Hipótesis 1 — Límite de plan (más probable):**

`plan-features.ts` define `maxLocations`:
- Emprendedor: 1
- Starter: 1
- Pro: 3
- Elite: null (ilimitado)

**El código de `createLocation` no verifica este límite**. Si el gym ya tiene 1 sede (la creada en onboarding), al intentar crear otra desde `/admin/ubicaciones`, el INSERT se ejecuta sin error... A menos que haya un trigger en la BD.

Sin embargo, el bug reportado es un *error*, no una validación silenciosa. Esto apunta a:

**Hipótesis 2 — La tabla `locations` no existe en producción:**

El schema de `locations` está en `migration/003_create_missing_tables.sql`. Si esta migración no se ejecutó en el proyecto de Supabase de producción, el INSERT fallará con `relation "public.locations" does not exist` (código `42P01`).

El código de `createLocation` capturaría esto como: `Error creating location: relation "public.locations" does not exist`.

**Hipótesis 3 — gym_id inválido:**
Si el `gymId` extraído del perfil del admin no coincide con ningún registro en `gyms`, la INSERT podría fallar por FK constraint.

### 3.4 Fix propuesto (Fase 4)

1. Agregar verificación de límite `maxLocations` antes del INSERT:
   ```typescript
   const currentCount = await getLocationCount(gymId);
   if (plan.maxLocations !== null && currentCount >= plan.maxLocations) {
     throw new Response(JSON.stringify({ error: "Límite de sedes alcanzado para tu plan" }), { status: 403 });
   }
   ```
2. Si la tabla no existe en producción: generar y ejecutar el migration SQL.
3. Manejar el error en el UI para mostrar mensaje útil al usuario (actualmente el `fetcher.data?.success` solo cierra el modal si hay éxito, pero no muestra el error si falla).

---

## 4. FEATURE GATING

### 4.1 Implementación actual

**Archivo:** `app/config/plan-features.ts`

Feature gating está implementado en dos capas:

**Servidor:** `requirePlanAccess(request, route)` — bloquea acceso directo por URL con HTTP 403.

**Cliente:** `filterNavByPlan(nav, planId)` en `admin/layout.tsx` — filtra los ítems del sidebar por plan. El admin solo ve las rutas que su plan permite.

### 4.2 Matriz de features por plan

| Feature / Plan | Emprendedor | Starter | Pro | Elite |
|---|---|---|---|---|
| maxLocations | 1 | 1 | 3 | ∞ |
| maxMembers | 10 | 80 | 300 | ∞ |
| maxCoaches | 1 | ∞ | ∞ | ∞ |
| CRM | ❌ | ❌ | ✅ | ✅ |
| Cupones | ❌ | ❌ | ✅ | ✅ |
| Períodos Especiales | ❌ | ✅ | ✅ | ✅ |
| Sustituciones | ❌ | ✅ | ✅ | ✅ |
| Ingresos | ❌ | ❌ | ✅ | ✅ |
| Nómina | ❌ | ❌ | ✅ | ✅ |
| Eventos | ❌ | ❌ | ✅ | ✅ |
| Operaciones | ❌ | ❌ | ✅ | ✅ |
| Ubicaciones | ❌ | ✅ | ✅ | ✅ |
| CFDI | ❌ | ❌ | ❌ | ✅ |
| API | ❌ | ❌ | ✅ | ✅ |
| FitCoins | ❌ | ❌ | ✅ | ✅ |
| WhatsApp | ❌ | ❌ | ✅ | ✅ |

### 4.3 Plan del admin (al.decoplast@gmail.com)

El plan real se guarda en `gyms.plan_id`. Para verificarlo hay que consultar la BD. Dado que el admin puede acceder a `/admin/ubicaciones` (que requiere Starter+), el plan es al menos **Starter**. Si intenta agregar una segunda sede y falla, sería un problema del límite `maxLocations = 1` del plan Starter.

### 4.4 Discrepancias observadas

1. **Trial:** El sistema de trial no tiene feature gating durante el período de prueba — todos los features son accesibles. Solo al expirar el trial se redirige a upgrade.
2. **`maxLocations` no se valida en código:** Solo está definido en `plan-features.ts` como dato, pero `createLocation` no lo verifica antes del INSERT.
3. **`maxMembers` y `maxCoaches`:** Similar — definidos en config pero probablemente no verificados en las acciones de creación.

---

## 5. ESTADO DEL STACK

### 5.1 Librerías instaladas

| Librería | Estado |
|---|---|
| React Router 7.12.0 | ✅ Instalado |
| Supabase JS 2.95.3 | ✅ Instalado |
| Playwright 1.58.2 | ✅ Instalado (devDep) |
| Framer Motion 12.35 | ✅ Instalado |
| Lucide React 0.564 | ✅ Instalado |
| qrcode.react | ❌ NO instalado |
| QR Scanner (cualquier lib) | ❌ NO instalado |

### 5.2 Playwright

Instalado pero sin `playwright.config.ts`. Existe solo `tests/smoke.spec.ts` básico. Hay que crear el config completo.

---

## 6. SCHEMA DE TABLAS RELEVANTES PARA FRONT DESK

### `profiles`
```
id, email, full_name, role (admin|member|coach|*front_desk), 
avatar_url, credits, phone, balance, gym_id, metadata, created_at, updated_at
```

### `memberships`
```
id, user_id (→profiles), gym_id (→gyms), plan_name, status (active|frozen|expired|cancelled),
price, credits_included, start_date, end_date, freeze_until, auto_renew, created_at
```

### `access_logs`
```
id, user_id (→profiles), gym_id (→gyms), access_type (entry|exit),
qr_token, validated, created_at
```

### `bookings`
```
id, user_id (→profiles), gym_id (→gyms), class_id (→classes),
status (confirmed|cancelled|attended|waitlist), resource_id (→resources, nullable), created_at
```

### `classes`
```
id, gym_id, title, description, coach_id (→profiles), capacity, current_enrolled,
start_time, end_time, location, room_id (→rooms, nullable), created_at
```

### `products`
```
id, gym_id, name, description, price, stock, category, is_available, created_at
```

### `orders`
```
id, gym_id, user_id (→profiles), status, payment_method, total, created_at
```

### `order_items`
```
id, order_id (→orders), product_id (→products), quantity, unit_price
```

---

## 7. RUTAS EXISTENTES (resumen)

```
/                     → Landing
/producto             → Marketing
/auth/login|register|logout
/onboarding/**        → Wizard post-compra
/dashboard/**         → Member view (role: member)
/admin/**             → Admin panel (role: admin)
/barista/**           → Coach POS (role: admin|coach)
/:slug                → Branded gym portal
```

**No existe `/staff/*`** — hay que crearlo completo.

---

## 8. PLAN DE IMPLEMENTACIÓN (Fases 2–4)

### Fase 2 — Items de implementación en orden

1. **Instalar** `qrcode.react` y `@zxing/library` (QR scanner con cámara)
2. **Migración SQL** — agregar `front_desk` como rol válido + RLS policies para front_desk
3. **`UserRole`** type → agregar `"front_desk"`
4. **`requireGymFrontDesk()`** en `gym.server.ts`
5. **Layout `/staff`** con auth guard
6. **`/staff/checkin`** — QR scanner + búsqueda manual
7. **`/staff/schedule`** — clases del día
8. **`/staff/pos`** — POS simplificado
9. **`/staff/walkin`** — walk-in rápido
10. **Member QR** — reemplazar texto por QR visual real en `/dashboard/profile`
11. **Registrar rutas** en `routes.ts`

### Fase 4 — Bug fixes

**Bug sedes:** Agregar validación de `maxLocations` en el action de ubicaciones + mostrar error en UI.

---

*Análisis completado. Procediendo a Fase 2.*
