-- ══════════════════════════════════════════════════════════════════
-- Migration 028: Backfill default rooms for onboarding gyms
-- ══════════════════════════════════════════════════════════════════
--
-- Problem: the onboarding room-layout step saved resources with room_id = NULL
-- because saveRoomLayout() never created a rooms record. As a result, the admin
-- dashboard RoomLayoutWidget showed nothing (getGymRooms returned []).
--
-- Fix applied in: frontend/app/services/onboarding.server.ts (saveRoomLayout)
--
-- This migration backfills existing gyms that have orphaned resources
-- (room_id = NULL) by either creating a default room or reassigning them.
--
-- Safe to run multiple times (idempotent via DO $$...$$).
-- ══════════════════════════════════════════════════════════════════

DO $$
DECLARE
    rec RECORD;
    v_room_id UUID;
    v_capacity INT;
    v_deleted INT;
BEGIN
    -- ── Pass 1: gyms with orphaned resources and NO existing room ──────────────
    -- Create "Sala Principal" and assign all orphaned resources to it.
    FOR rec IN
        SELECT DISTINCT r.gym_id
        FROM public.resources r
        WHERE r.room_id IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.rooms ro WHERE ro.gym_id = r.gym_id
          )
    LOOP
        SELECT COUNT(*) INTO v_capacity
        FROM public.resources
        WHERE gym_id = rec.gym_id AND room_id IS NULL;

        INSERT INTO public.rooms (gym_id, name, capacity, is_active)
        VALUES (rec.gym_id, 'Sala Principal', GREATEST(v_capacity, 1), true)
        RETURNING id INTO v_room_id;

        UPDATE public.resources
        SET room_id = v_room_id
        WHERE gym_id = rec.gym_id
          AND room_id IS NULL;

        RAISE NOTICE 'Gym %: created room % and assigned % resources', rec.gym_id, v_room_id, v_capacity;
    END LOOP;

    -- ── Pass 2: gyms with orphaned resources AND an existing room ─────────────
    -- These orphans are stale duplicates (same positions already exist in the
    -- room). Delete the conflicting orphans; assign the non-conflicting ones.
    FOR rec IN
        SELECT DISTINCT r.gym_id
        FROM public.resources r
        WHERE r.room_id IS NULL
          AND EXISTS (
              SELECT 1 FROM public.rooms ro WHERE ro.gym_id = r.gym_id
          )
    LOOP
        SELECT id INTO v_room_id
        FROM public.rooms
        WHERE gym_id = rec.gym_id
        ORDER BY created_at ASC
        LIMIT 1;

        -- Delete orphans whose position already exists in the target room
        DELETE FROM public.resources
        WHERE gym_id = rec.gym_id
          AND room_id IS NULL
          AND (position_row, position_col) IN (
              SELECT position_row, position_col
              FROM public.resources
              WHERE room_id = v_room_id
          );

        GET DIAGNOSTICS v_deleted = ROW_COUNT;

        -- Assign remaining non-conflicting orphans
        SELECT COUNT(*) INTO v_capacity
        FROM public.resources
        WHERE gym_id = rec.gym_id AND room_id IS NULL;

        IF v_capacity > 0 THEN
            UPDATE public.resources
            SET room_id = v_room_id
            WHERE gym_id = rec.gym_id
              AND room_id IS NULL;
        END IF;

        RAISE NOTICE 'Gym %: deleted % duplicate orphans, reassigned % remaining to room %',
            rec.gym_id, v_deleted, v_capacity, v_room_id;
    END LOOP;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
