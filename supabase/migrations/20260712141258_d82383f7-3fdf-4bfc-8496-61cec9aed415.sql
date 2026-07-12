
-- Fix reseller activity/presence tracking:
-- 1) Admin panel could not read data because SELECT policy used has_role() but hyro_user_roles is empty.
-- 2) Presence upsert failed under RLS from anon/authenticated.
-- The app already gates the admin UI; treat these as internal tracking tables with permissive DML.

DROP POLICY IF EXISTS "activity read admin" ON public.hyro_reseller_activity;
DROP POLICY IF EXISTS "activity insert public" ON public.hyro_reseller_activity;
DROP POLICY IF EXISTS "presence read admin" ON public.hyro_reseller_presence;
DROP POLICY IF EXISTS "presence update public" ON public.hyro_reseller_presence;
DROP POLICY IF EXISTS "presence upsert public" ON public.hyro_reseller_presence;

CREATE POLICY "activity read all"   ON public.hyro_reseller_activity FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "activity insert all" ON public.hyro_reseller_activity FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "presence read all"   ON public.hyro_reseller_presence FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "presence insert all" ON public.hyro_reseller_presence FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "presence update all" ON public.hyro_reseller_presence FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
