# Debug: "Database error creating new user" en Onboarding

## Problema
Al intentar registrar un nuevo usuario desde el onboarding (`/onboarding`), Supabase Auth devuelve:
```
Error en Auth: Database error creating new user
```
Este error ocurre en la llamada `supabaseAdmin.auth.admin.createUser()` en `app/routes/onboarding/_index.tsx` línea 90.

## Stack técnico
- **Framework**: React Router v7 (Remix) desplegado en Vercel
- **Auth**: Supabase Auth con service_role key (server-side)
- **Base de datos**: Supabase PostgreSQL con RLS habilitado
- **Multitenancy**: Aislamiento por `gym_id` en JWT claims + RLS policies

## Flujo del onboarding (app/routes/onboarding/_index.tsx)
1. Verifica si el email ya existe → si existe sin gym, lo elimina
2. **`supabaseAdmin.auth.admin.createUser()`** ← AQUÍ FALLA
3. Crea registro en tabla `gyms`
4. Actualiza `profiles` con `gym_id` y `role: admin`
5. Crea sesión (cookie)

## Causa raíz
Cuando Supabase Auth crea un usuario en `auth.users`, un trigger (`on_auth_user_created`) se ejecuta automáticamente para insertar un registro en `public.profiles`. Este trigger falla por una de estas razones:

### Hipótesis 1: El trigger NO existe
Si el trigger `on_auth_user_created` no fue creado en la base de datos de producción, Supabase no puede completar la creación del usuario si hay alguna dependencia.

**Verificar con:**
```sql
SELECT tgname, tgrelid::regclass, proname
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'auth.users'::regclass;
```

### Hipótesis 2: El trigger existe pero NO tiene SECURITY DEFINER
Si la función `handle_new_user()` no tiene `SECURITY DEFINER`, se ejecuta con los permisos del usuario que activó el trigger (supabase_auth_admin). Dado que la tabla `profiles` tiene RLS activado, la inserción es bloqueada.

**Verificar con:**
```sql
SELECT proname, prosecdef
FROM pg_proc
WHERE proname = 'handle_new_user';
-- prosecdef = true significa SECURITY DEFINER está activo
```

### Hipótesis 3: La RLS policy en profiles bloquea inserciones con gym_id = NULL
La policy original es:
```sql
CREATE POLICY "tenant_isolation" ON public.profiles
  FOR ALL USING (
    gym_id = (auth.jwt() ->> 'gym_id')::uuid
  );
```
Un usuario nuevo NO tiene gym_id ni JWT, así que la policy bloquea la inserción.

**La policy correcta debería ser:**
```sql
CREATE POLICY "tenant_isolation" ON public.profiles
  FOR ALL USING (
    gym_id IS NULL
    OR gym_id = (auth.jwt() ->> 'gym_id')::uuid
  );
```

### Hipótesis 4: Columnas NOT NULL sin default en profiles
Si alguna columna requerida no se incluye en el INSERT del trigger, falla.

**Esquema completo de profiles:**

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID (PK) | YES | - |
| email | TEXT | YES | - |
| full_name | TEXT | YES | '' |
| role | TEXT | YES | 'member' |
| avatar_url | TEXT | NO | NULL |
| credits | INT | YES | 0 |
| phone | TEXT | NO | NULL |
| balance | NUMERIC(10,2) | NO | 0 |
| gym_id | UUID (FK→gyms) | NO | NULL |
| metadata | JSONB | NO | '{}' |
| created_at | TIMESTAMPTZ | YES | now() |
| updated_at | TIMESTAMPTZ | YES | now() |

**El trigger DEBE incluir al menos:** id, email, full_name, role, credits.

### Hipótesis 5: Otro trigger o constraint en auth.users bloquea la creación
Podría existir otro trigger (ej: `custom_access_token_hook` mal configurado) que interfiere.

**Verificar TODOS los triggers en auth.users:**
```sql
SELECT tgname, proname, tgenabled
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'auth.users'::regclass
ORDER BY tgname;
```

## Queries de diagnóstico (ejecutar en SQL Editor de Supabase)

### 1. Ver todos los triggers en auth.users
```sql
SELECT tgname AS trigger_name,
       proname AS function_name,
       tgenabled AS enabled,
       CASE tgtype & 2 WHEN 2 THEN 'BEFORE' ELSE 'AFTER' END AS timing,
       CASE tgtype & 28
         WHEN 4 THEN 'INSERT'
         WHEN 8 THEN 'DELETE'
         WHEN 16 THEN 'UPDATE'
         WHEN 20 THEN 'INSERT OR UPDATE'
         WHEN 28 THEN 'INSERT OR UPDATE OR DELETE'
       END AS event
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'auth.users'::regclass
  AND NOT tgisinternal;
```

### 2. Ver el código fuente de handle_new_user (si existe)
```sql
SELECT proname, prosrc, prosecdef
FROM pg_proc
WHERE proname = 'handle_new_user';
```

### 3. Ver las policies de RLS en profiles
```sql
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr
FROM pg_policy
WHERE polrelid = 'public.profiles'::regclass;
```

### 4. Ver la estructura actual de profiles
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;
```

### 5. Intentar crear un usuario de test para ver el error exacto
```sql
-- Ejecutar esto y ver el error detallado en los logs de Supabase (Dashboard → Logs → Edge)
SELECT * FROM auth.users LIMIT 1;
```

## Fix completo (ya aplicado parcialmente en 005_fix_profiles_trigger.sql)

```sql
-- 1. Recrear la función con SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, credits, gym_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'member'),
    0,
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2. Recrear el trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Arreglar la policy de RLS
DROP POLICY IF EXISTS "tenant_isolation" ON public.profiles;
CREATE POLICY "tenant_isolation" ON public.profiles
  FOR ALL USING (
    gym_id IS NULL
    OR gym_id = (auth.jwt() ->> 'gym_id')::uuid
  );
```

## Si el fix anterior NO funcionó

El problema puede ser que la función `handle_new_user()` existe pero tiene un error interno (ej: referencia a una columna que no existe, o el INSERT no coincide con el esquema actual de profiles).

**Acción recomendada:**
1. Ejecutar las queries de diagnóstico (#1 a #4 arriba)
2. Compartir los resultados exactos
3. Con esa info, se puede escribir el trigger correcto que coincida con el esquema real de la tabla

- [x] Diagnosticar la causa de la falla en el inicio de sesión <!-- id: 0 -->
    - [x] Verificar si el usuario tiene un perfil en `public.profiles` <!-- id: 1 -->
    - [x] Revisar la configuración de confirmación de email en Supabase <!-- id: 2 -->
    - [x] Examinar la lógica de login en `app/routes/auth/login.tsx` <!-- id: 3 -->
- [x] Implementar la solución <!-- id: 4 -->
- [x] Verificar que el login funcione post-registro <!-- id: 5 -->

## Archivos relevantes
- `frontend/app/routes/onboarding/_index.tsx` — Flujo de onboarding (líneas 88-104 = createUser)
- `frontend/app/services/supabase.server.ts` — Cliente Supabase con service_role
- `frontend/app/services/auth.server.ts` — Manejo de sesiones (cookie)
- `frontend/app/routes/auth/login.tsx` — Login (funciona independiente del onboarding)
- `frontend/001_create_gyms_and_rls.sql` — Schema de gyms + RLS policies
- `frontend/003_create_missing_tables.sql` — Schema de profiles + trigger original
- `frontend/005_fix_profiles_trigger.sql` — Fix del trigger (ya aplicado)

## Variables de entorno en Vercel
- `SUPABASE_URL` — Solo en Production (FALTA en Preview y Development)
- `SUPABASE_ANON_KEY` — Production, Preview, Development
- `SUPABASE_SERVICE_ROLE_KEY` — Production, Preview, Development
- `SESSION_SECRET` — Production, Preview, Development
