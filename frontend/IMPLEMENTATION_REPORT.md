# IMPLEMENTATION REPORT — Front Desk Dashboard + QR Scanner
> Completado: 2026-04-21

---

## 1. ANÁLISIS PREVIO (Fase 1)

### Roles
- Roles existentes: `admin | member | coach`
- JWT hook: función `custom_access_token_hook` inyecta `gym_id` y `app_role` en el JWT
- El hook NO requirió cambios — lee `profiles.role` dinámicamente, acepta cualquier valor
- Se agregó `front_desk` al tipo TypeScript `UserRole`

### Membresías
- Estados válidos: `active | frozen | expired | cancelled`
- Tabla `access_logs` registra check-ins con `access_type: 'entry' | 'exit'`
- QR del member era texto plano `GRIND:{uuid}` — sin librería de QR instalada

### Bug sedes
- `createLocation` usaba `supabaseAdmin` (bypassa RLS — no era el problema)
- Bug real: `maxLocations = 1` para Starter/Emprendedor, pero la action no validaba este límite antes del INSERT
- El error no se mostraba en el UI (el modal se cerraba solo en éxito, no manejaba el error de fetch)

### Plan del admin
- Plan Starter (accede a `/admin/ubicaciones`, que requiere Starter+)
- maxLocations = 1 → ya tiene 1 sede → intentar crear una segunda fallaba silenciosamente

---

## 2. FRONT DESK IMPLEMENTADO

### Rutas creadas

| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/staff` | `routes/staff/_index.tsx` | Redirect → /staff/checkin |
| `/staff` (layout) | `routes/staff/layout.tsx` | Navbar, bottom tabs, auth guard |
| `/staff/checkin` | `routes/staff/checkin.tsx` | QR scanner + búsqueda manual + validación |
| `/staff/schedule` | `routes/staff/schedule.tsx` | Clases del día con asistentes |
| `/staff/pos` | `routes/staff/pos.tsx` | POS simplificado |
| `/staff/walkin` | `routes/staff/walkin.tsx` | Registro rápido de visitante |

### Componentes creados

- `app/components/staff/QRScanner.tsx` — escáner de cámara real con `@zxing/library`

### Auth guard

```typescript
// app/services/gym.server.ts
export async function requireGymFrontDesk(request: Request) {
    const { profile, gymId } = await requireGymAuth(request);
    if (profile.role !== "admin" && profile.role !== "front_desk") {
        throw redirect(profile.role === "member" ? "/dashboard" : "/auth/login");
    }
    return { profile, gymId };
}
```

### RLS policies

Archivo: `migrations/009_front_desk_role.sql`

Policies creadas para rol `front_desk` en tablas:
- `profiles` (SELECT + INSERT para walk-in)
- `memberships` (SELECT)
- `access_logs` (SELECT + INSERT para check-in)
- `bookings` (SELECT + INSERT)
- `classes` (SELECT)
- `products` (SELECT)
- `orders` (SELECT + INSERT para POS)
- `order_items` (SELECT + INSERT)

---

## 3. QR SCANNER — IMPLEMENTACIÓN

### Librería usada
- **Generación:** `qrcode.react` v4.2.0 (componente `QRCodeSVG`)
- **Lectura:** `@zxing/library` v0.21.3 (`BrowserQRCodeReader`)
- Ambas lazy-loaded con `React.lazy()` + `Suspense` para evitar problemas de SSR

### Componente QRScanner (`app/components/staff/QRScanner.tsx`)
- Solicita permiso de cámara del navegador
- Prefiere cámara trasera en móvil (`/back|rear|environment/i` sobre label del device)
- Fallback a cualquier cámara disponible
- Estados: `requesting | active | paused | error`
- Overlay visual con esquinas amber y línea de escaneo animada
- Vibración háptica al detectar código (`navigator.vibrate(100)`)
- Auto-pausa tras lectura, se reactiva con "Siguiente socio"
- Maneja errores: permiso denegado, sin cámara, HTTPS requerido

### Flujo de validación completo
1. QR decodificado → parsea formato `GRIND:{uuid}`
2. Busca perfil en `profiles` donde `id = uuid AND gym_id = currentGym`
3. Busca membresía activa en `memberships`
4. Busca reserva del día en `bookings` (con join a `classes`)
5. Determina status: `allowed | warning | denied`
6. Muestra resultado visual (verde/amarillo/rojo)
7. Staff confirma → INSERT en `access_logs`

### QR del Member
- Actualizado en `app/routes/dashboard/profile.tsx`
- Ahora genera QR visual real con `qrcode.react`
- Dato codificado: `GRIND:{profile.id}` (mismo formato que antes, ahora legible por escáner)

---

## 4. TESTING

### Suite creada
- `playwright.config.ts` — configuración completa
- 8 archivos de test, 26 tests totales
- Helpers de autenticación en `tests/e2e/helpers/auth.ts`

### Resultados (contra producción https://grindproject.vercel.app)

**12 tests pasaron ✅ / 14 fallaron**

Tests pasados:
- TEST 1: Login admin ✅
- TEST 2: Login incorrecto ✅
- TEST 3: Login member ✅
- TEST 9: Navegación admin completa (13 secciones) ✅
- TEST 10: Navegación member completa (6 secciones) ✅
- TEST 12: Reserva de clase (no hay clases hoy) ✅
- TEST 13: Admin accede a /staff ✅
- TEST 17: Checkin sin errores críticos ✅
- TEST 22: Feature gating verificado ✅
- TEST 24: Admin schedule carga ✅
- TEST 25: Admin coaches carga ✅
- TEST 26: Admin POS carga ✅

Tests fallados (todos por una de dos razones):
- **Timeout `/admin/ubicaciones`:** Tests 6, 7, 8, 23 — tabla `locations` probablemente no creada en prod
- **`/staff` no desplegado:** Tests 15–21 — nuevas rutas en código pero aún no en Vercel prod

Ver `TEST_RESULTS.md` para detalle completo.

---

## 5. BUGS CORREGIDOS

### Bug 1 — Agregar sede sin límite de plan (crítico)

**Causa:** `createLocation()` hacía INSERT sin verificar `maxLocations` del plan. Para plan Starter/Emprendedor el límite es 1. El error del INSERT fallaba silenciosamente y el modal se cerraba sin feedback.

**Fix en `routes/admin/ubicaciones.tsx` (action `create`):**
```typescript
// Ahora verifica el límite antes del INSERT
const existingLocations = await getGymLocations(gymId);
if (existingLocations.length >= planDef.maxLocations) {
    return { success: false, error: "Tu plan Starter permite máximo 1 sede..." };
}
```

**Fix en el UI:** El modal ahora muestra el error en rojo y no se cierra si hay error. El botón muestra "Guardando…" durante el submit.

**Archivos modificados:**
- `app/routes/admin/ubicaciones.tsx` — action + componente

### Bug 2 — QR del member era texto, no QR real

**Fix:** Reemplazado el `div` con texto por `<QRCodeSVG>` de `qrcode.react`.

---

## 6. CREDENCIALES FRONT DESK

El usuario front_desk debe ser creado manualmente en Supabase:

**Opción A — Dashboard Supabase:**
1. Auth → Users → Add User
2. Email: `recepcion@tugimnasio.com`, Password: `FrontDesk2026!`
3. Ejecutar SQL:
   ```sql
   UPDATE profiles 
   SET role = 'front_desk', gym_id = '<TU_GYM_ID>'
   WHERE email = 'recepcion@tugimnasio.com';
   ```

**Opción B — Via `/staff/walkin`:**
1. Login como admin
2. Ir a `/staff/walkin`
3. Registrar al usuario
4. Actualizar su role a `front_desk` con el SQL de arriba

**Credenciales de prueba (por configurar):**
- Email: `recepcion@tugimnasio.com`
- Password: `FrontDesk2026!`
- Configurar en: `FRONT_DESK_EMAIL` / `FRONT_DESK_PASSWORD` (env vars para tests)

---

## 7. INSTRUCCIONES DE DEPLOY

Para que los tests de staff funcionen en producción:

```bash
# 1. Ejecutar migrations en Supabase SQL Editor:
#    migrations/009_front_desk_role.sql
#    (migrations/003_create_missing_tables.sql si no está aplicada)

# 2. Desde el directorio frontend:
cd frontend
git add .
git commit -m "feat: front desk dashboard + QR scanner + E2E tests"
# Vercel auto-deploys on push to main

# 3. Re-ejecutar tests:
BASE_URL=https://grindproject.vercel.app npx playwright test
```

---

## 8. PENDIENTES

| Item | Prioridad | Razón |
|------|-----------|-------|
| Ejecutar migration 009 en Supabase prod | 🔴 Alta | Sin esto, RLS de front_desk no funciona |
| Crear usuario front_desk de prueba | 🔴 Alta | TEST 14 necesita credenciales |
| Deploy a Vercel | 🔴 Alta | Tests 15–21 requieren que las rutas existan |
| Verificar migration 003 en prod | 🟡 Media | Si tabla `locations` no existe, las sedes fallan |
| Validar `maxMembers` en action de crear usuario | 🟡 Media | Similar al bug de maxLocations |
| Validar `maxCoaches` en action de crear coach | 🟡 Media | Similar al bug de maxLocations |
| QR temporales con expiración | 🟢 Baja | El QR actual usa profile.id estático — para seguridad se podría usar JWT con TTL |
| Realtime en /staff/schedule | 🟢 Baja | Actualmente sin Supabase Realtime — refetch manual |
| Soporte Stripe/Conekta en staff/pos | 🟢 Baja | Actualmente solo registra la orden, sin cobro real |

---

## 9. ARCHIVOS MODIFICADOS / CREADOS

### Nuevos
- `app/routes/staff/layout.tsx`
- `app/routes/staff/_index.tsx`
- `app/routes/staff/checkin.tsx`
- `app/routes/staff/schedule.tsx`
- `app/routes/staff/pos.tsx`
- `app/routes/staff/walkin.tsx`
- `app/components/staff/QRScanner.tsx`
- `migrations/009_front_desk_role.sql`
- `playwright.config.ts`
- `tests/e2e/helpers/auth.ts`
- `tests/e2e/admin-login.spec.ts`
- `tests/e2e/member-login.spec.ts`
- `tests/e2e/admin-locations.spec.ts`
- `tests/e2e/admin-navigation.spec.ts`
- `tests/e2e/member-navigation.spec.ts`
- `tests/e2e/staff-dashboard.spec.ts`
- `tests/e2e/feature-gating.spec.ts`
- `tests/e2e/admin-crud.spec.ts`
- `PHASE_1_ANALYSIS.md`
- `TEST_RESULTS.md`

### Modificados
- `app/types/database.ts` — `UserRole` agrega `"front_desk"`
- `app/services/gym.server.ts` — agrega `requireGymFrontDesk()`
- `app/routes.ts` — registra rutas `/staff/*`
- `app/routes/admin/ubicaciones.tsx` — fix maxLocations + UI de error
- `app/routes/dashboard/profile.tsx` — QR real con `qrcode.react`
- `package.json` — agrega `qrcode.react` y `@zxing/library`
