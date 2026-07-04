-- Suporte a links de resgate para revendedores (mesma tabela, com "kind")
ALTER TABLE public.hyro_redemption_links
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'license',
  ADD COLUMN IF NOT EXISTS reseller_slots integer,
  ADD COLUMN IF NOT EXISTS reseller_owner_id text;

-- license_id agora pode ser vazio quando kind='reseller'
ALTER TABLE public.hyro_redemption_links
  ALTER COLUMN license_id DROP NOT NULL;

-- Índice para consulta por owner
CREATE INDEX IF NOT EXISTS idx_hyro_redemption_links_kind_owner
  ON public.hyro_redemption_links (kind, reseller_owner_id);
