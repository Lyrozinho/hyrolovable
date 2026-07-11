
CREATE TABLE public.hyro_reseller_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID,
  actor_email TEXT,
  actor_role TEXT,
  event TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip TEXT,
  user_agent TEXT,
  path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hyro_reseller_activity_actor_created_idx ON public.hyro_reseller_activity (actor_id, created_at DESC);
CREATE INDEX hyro_reseller_activity_email_created_idx ON public.hyro_reseller_activity (actor_email, created_at DESC);
CREATE INDEX hyro_reseller_activity_created_idx ON public.hyro_reseller_activity (created_at DESC);

GRANT SELECT, INSERT ON public.hyro_reseller_activity TO anon;
GRANT SELECT, INSERT ON public.hyro_reseller_activity TO authenticated;
GRANT ALL ON public.hyro_reseller_activity TO service_role;

ALTER TABLE public.hyro_reseller_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity insert public" ON public.hyro_reseller_activity
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "activity read admin" ON public.hyro_reseller_activity
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.hyro_reseller_presence (
  actor_id UUID,
  actor_email TEXT NOT NULL PRIMARY KEY,
  actor_role TEXT,
  actor_name TEXT,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip TEXT,
  user_agent TEXT,
  path TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hyro_reseller_presence_actor_idx ON public.hyro_reseller_presence (actor_id);
CREATE INDEX hyro_reseller_presence_last_seen_idx ON public.hyro_reseller_presence (last_seen DESC);

GRANT SELECT, INSERT, UPDATE ON public.hyro_reseller_presence TO anon;
GRANT SELECT, INSERT, UPDATE ON public.hyro_reseller_presence TO authenticated;
GRANT ALL ON public.hyro_reseller_presence TO service_role;

ALTER TABLE public.hyro_reseller_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presence upsert public" ON public.hyro_reseller_presence
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "presence update public" ON public.hyro_reseller_presence
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "presence read admin" ON public.hyro_reseller_presence
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER hyro_reseller_presence_touch
  BEFORE UPDATE ON public.hyro_reseller_presence
  FOR EACH ROW EXECUTE FUNCTION public.hyro_touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.hyro_reseller_activity;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hyro_reseller_presence;
ALTER TABLE public.hyro_reseller_activity REPLICA IDENTITY FULL;
ALTER TABLE public.hyro_reseller_presence REPLICA IDENTITY FULL;
