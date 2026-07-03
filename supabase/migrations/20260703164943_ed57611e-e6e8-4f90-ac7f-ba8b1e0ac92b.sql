
CREATE TABLE public.hyro_license_permissions (
  license_id text PRIMARY KEY,
  perms jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.hyro_license_permissions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hyro_license_permissions TO authenticated;
GRANT ALL ON public.hyro_license_permissions TO service_role;

ALTER TABLE public.hyro_license_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read license perms"
  ON public.hyro_license_permissions FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can insert license perms"
  ON public.hyro_license_permissions FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update license perms"
  ON public.hyro_license_permissions FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete license perms"
  ON public.hyro_license_permissions FOR DELETE TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.hyro_lp_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER hyro_lp_updated_at BEFORE UPDATE ON public.hyro_license_permissions
FOR EACH ROW EXECUTE FUNCTION public.hyro_lp_touch_updated_at();
