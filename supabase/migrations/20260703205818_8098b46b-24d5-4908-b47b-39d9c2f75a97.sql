
CREATE TABLE public.hyro_redemption_links (
  slug text primary key,
  license_id text not null,
  target_email text not null,
  target_name text,
  locked_ip text,
  claimed_user_id text,
  claimed_at timestamptz,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hyro_redemption_links TO anon, authenticated;
GRANT ALL ON public.hyro_redemption_links TO service_role;
ALTER TABLE public.hyro_redemption_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read redemption links" ON public.hyro_redemption_links FOR SELECT USING (true);
CREATE POLICY "Public insert redemption links" ON public.hyro_redemption_links FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update redemption links" ON public.hyro_redemption_links FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete redemption links" ON public.hyro_redemption_links FOR DELETE USING (true);

CREATE TRIGGER touch_hyro_redemption_links
BEFORE UPDATE ON public.hyro_redemption_links
FOR EACH ROW EXECUTE FUNCTION public.hyro_lp_touch_updated_at();

CREATE TABLE public.hyro_user_flags (
  user_email text primary key,
  welcome_seen boolean not null default false,
  tutorial_seen boolean not null default false,
  first_ip text,
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hyro_user_flags TO anon, authenticated;
GRANT ALL ON public.hyro_user_flags TO service_role;
ALTER TABLE public.hyro_user_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read user flags" ON public.hyro_user_flags FOR SELECT USING (true);
CREATE POLICY "Public insert user flags" ON public.hyro_user_flags FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update user flags" ON public.hyro_user_flags FOR UPDATE USING (true) WITH CHECK (true);

CREATE TRIGGER touch_hyro_user_flags
BEFORE UPDATE ON public.hyro_user_flags
FOR EACH ROW EXECUTE FUNCTION public.hyro_lp_touch_updated_at();
