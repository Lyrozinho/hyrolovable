CREATE TABLE IF NOT EXISTS public.hyro_partner_plans_config (
  id integer PRIMARY KEY DEFAULT 1,
  plans jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hyro_partner_plans_config_singleton CHECK (id = 1)
);

GRANT SELECT ON public.hyro_partner_plans_config TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hyro_partner_plans_config TO authenticated;
GRANT ALL ON public.hyro_partner_plans_config TO service_role;

ALTER TABLE public.hyro_partner_plans_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read partner plans config"
  ON public.hyro_partner_plans_config FOR SELECT
  TO public USING (true);

CREATE POLICY "Authenticated can insert partner plans config"
  ON public.hyro_partner_plans_config FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update partner plans config"
  ON public.hyro_partner_plans_config FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.hyro_partner_plans_config (id, plans)
VALUES (1, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;