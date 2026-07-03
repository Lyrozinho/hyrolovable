
-- Tutorials table (public read, admin write handled at app level via ext supabase)
CREATE TABLE public.hyro_tutorials (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  video_path text,
  video_mime text,
  thumbnail_path text,
  duration text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.hyro_tutorials TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hyro_tutorials TO authenticated;
GRANT ALL ON public.hyro_tutorials TO service_role;

ALTER TABLE public.hyro_tutorials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tutorials" ON public.hyro_tutorials FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert tutorials" ON public.hyro_tutorials FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update tutorials" ON public.hyro_tutorials FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete tutorials" ON public.hyro_tutorials FOR DELETE TO authenticated USING (true);

-- Storage policies for tutorials-media (public read, authenticated write)
CREATE POLICY "Public can read tutorial media" ON storage.objects FOR SELECT USING (bucket_id = 'tutorials-media');
CREATE POLICY "Authenticated can upload tutorial media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tutorials-media');
CREATE POLICY "Authenticated can update tutorial media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'tutorials-media');
CREATE POLICY "Authenticated can delete tutorial media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'tutorials-media');

-- Also allow anon uploads (since this app uses client-side sessions, not Supabase auth)
CREATE POLICY "Anon can upload tutorial media" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'tutorials-media');
CREATE POLICY "Anon can update tutorial media" ON storage.objects FOR UPDATE TO anon USING (bucket_id = 'tutorials-media');
CREATE POLICY "Anon can delete tutorial media" ON storage.objects FOR DELETE TO anon USING (bucket_id = 'tutorials-media');

-- And anon writes on tutorials table (app uses anon key)
CREATE POLICY "Anon can insert tutorials" ON public.hyro_tutorials FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update tutorials" ON public.hyro_tutorials FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete tutorials" ON public.hyro_tutorials FOR DELETE TO anon USING (true);
GRANT INSERT, UPDATE, DELETE ON public.hyro_tutorials TO anon;

-- Seed
INSERT INTO public.hyro_tutorials (id, title, description, sort_order) VALUES
  ('install-extension', 'Como instalar extensão', 'Passo a passo completo para instalar a extensão Hyro Lovable no seu navegador Chrome ou Edge. Baixe o arquivo ZIP, extraia e carregue no modo desenvolvedor.', 0)
ON CONFLICT (id) DO NOTHING;
