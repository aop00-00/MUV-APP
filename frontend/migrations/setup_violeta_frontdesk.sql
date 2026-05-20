-- =============================================================================
-- Crear usuario Front Desk: violeta@gmail.com / 12345678
-- Ejecutar en Supabase Dashboard > SQL Editor
-- =============================================================================
-- PASO 1: El usuario debe ser creado primero desde Auth > Users > Add User
--   Email: violeta@gmail.com
--   Password: 12345678
--   Auto Confirm User: ✅
--
-- PASO 2: Ejecutar este SQL para asignarle el rol y gym correcto.
-- Reemplaza '<GYM_ID>' con el UUID real de tu gym (lo puedes ver en la tabla gyms)
-- =============================================================================

-- Verificar si el usuario ya tiene perfil (creado por trigger)
SELECT id, email, full_name, role, gym_id
FROM public.profiles
WHERE email = 'violeta@gmail.com';

-- Asignar rol front_desk y gym_id al perfil de Violeta
-- ⚠️ Reemplaza <TU_GYM_ID> con el UUID real de tu gym
UPDATE public.profiles
SET 
    role    = 'front_desk',
    gym_id  = '<TU_GYM_ID>',          -- ← cambiar esto
    full_name = COALESCE(NULLIF(full_name, ''), 'Violeta')
WHERE email = 'violeta@gmail.com';

-- Verificar el resultado
SELECT id, email, full_name, role, gym_id
FROM public.profiles
WHERE email = 'violeta@gmail.com';

-- Si el UPDATE afecta 0 filas, el trigger no creó el perfil. Crear manualmente:
-- (Reemplaza ambos <...> con los UUIDs correctos)
/*
INSERT INTO public.profiles (id, email, full_name, role, gym_id, credits)
VALUES (
    (SELECT id FROM auth.users WHERE email = 'violeta@gmail.com'),  -- auth user id
    'violeta@gmail.com',
    'Violeta',
    'front_desk',
    '<TU_GYM_ID>',   -- ← cambiar esto
    0
)
ON CONFLICT (id) DO UPDATE SET
    role   = 'front_desk',
    gym_id = '<TU_GYM_ID>';
*/
