
-- ============================================================
-- app_role enum + user_roles + has_role (for admin gating)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.hyro_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.hyro_user_roles TO authenticated;
GRANT ALL ON public.hyro_user_roles TO service_role;

ALTER TABLE public.hyro_user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_self_read" ON public.hyro_user_roles;
CREATE POLICY "user_roles_self_read" ON public.hyro_user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hyro_user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============================================================
-- Payment integrations (per-user gateway credentials)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hyro_payment_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  mode text NOT NULL DEFAULT 'live' CHECK (mode IN ('sandbox','live')),
  access_token text NOT NULL,
  public_key text,
  webhook_secret text,
  active boolean NOT NULL DEFAULT true,
  account_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hyro_payment_integrations TO authenticated;
GRANT ALL ON public.hyro_payment_integrations TO service_role;

ALTER TABLE public.hyro_payment_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pi_owner_read" ON public.hyro_payment_integrations;
CREATE POLICY "pi_owner_read" ON public.hyro_payment_integrations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "pi_owner_write" ON public.hyro_payment_integrations;
CREATE POLICY "pi_owner_write" ON public.hyro_payment_integrations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "pi_owner_update" ON public.hyro_payment_integrations;
CREATE POLICY "pi_owner_update" ON public.hyro_payment_integrations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "pi_owner_delete" ON public.hyro_payment_integrations;
CREATE POLICY "pi_owner_delete" ON public.hyro_payment_integrations
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Reseller pricing (per-reseller renewal price)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hyro_reseller_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_user_id uuid NOT NULL UNIQUE,
  renewal_price_cents integer NOT NULL DEFAULT 5900 CHECK (renewal_price_cents >= 50),
  renewal_days integer NOT NULL DEFAULT 30 CHECK (renewal_days >= 1 AND renewal_days <= 3650),
  currency text NOT NULL DEFAULT 'BRL',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hyro_reseller_pricing TO authenticated;
GRANT ALL ON public.hyro_reseller_pricing TO service_role;

ALTER TABLE public.hyro_reseller_pricing ENABLE ROW LEVEL SECURITY;

-- Todos autenticados leem (cliente precisa ver o preço do revendedor dele).
-- Só metadados públicos são consultados via server fn, nunca token.
DROP POLICY IF EXISTS "rp_authenticated_read" ON public.hyro_reseller_pricing;
CREATE POLICY "rp_authenticated_read" ON public.hyro_reseller_pricing
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "rp_owner_insert" ON public.hyro_reseller_pricing;
CREATE POLICY "rp_owner_insert" ON public.hyro_reseller_pricing
  FOR INSERT TO authenticated
  WITH CHECK (reseller_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "rp_owner_update" ON public.hyro_reseller_pricing;
CREATE POLICY "rp_owner_update" ON public.hyro_reseller_pricing
  FOR UPDATE TO authenticated
  USING (reseller_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (reseller_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "rp_owner_delete" ON public.hyro_reseller_pricing;
CREATE POLICY "rp_owner_delete" ON public.hyro_reseller_pricing
  FOR DELETE TO authenticated
  USING (reseller_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Payment orders (renewal orders)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hyro_payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL,
  reseller_user_id uuid NOT NULL,
  license_id text NOT NULL,
  provider text NOT NULL DEFAULT 'mercadopago',
  provider_payment_id text,
  amount_cents integer NOT NULL CHECK (amount_cents >= 50),
  currency text NOT NULL DEFAULT 'BRL',
  renewal_days integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled','refunded','expired')),
  qr_code text,
  qr_code_base64 text,
  ticket_url text,
  payer_name text,
  payer_email text,
  payer_cpf text,
  external_reference text,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_po_client ON public.hyro_payment_orders(client_user_id);
CREATE INDEX IF NOT EXISTS idx_po_reseller ON public.hyro_payment_orders(reseller_user_id);
CREATE INDEX IF NOT EXISTS idx_po_provider_payment ON public.hyro_payment_orders(provider, provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON public.hyro_payment_orders(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hyro_payment_orders TO authenticated;
GRANT ALL ON public.hyro_payment_orders TO service_role;

ALTER TABLE public.hyro_payment_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "po_read" ON public.hyro_payment_orders;
CREATE POLICY "po_read" ON public.hyro_payment_orders
  FOR SELECT TO authenticated
  USING (
    client_user_id = auth.uid()
    OR reseller_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "po_client_insert" ON public.hyro_payment_orders;
CREATE POLICY "po_client_insert" ON public.hyro_payment_orders
  FOR INSERT TO authenticated
  WITH CHECK (client_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.hyro_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_pi_updated ON public.hyro_payment_integrations;
CREATE TRIGGER trg_pi_updated BEFORE UPDATE ON public.hyro_payment_integrations
  FOR EACH ROW EXECUTE FUNCTION public.hyro_touch_updated_at();

DROP TRIGGER IF EXISTS trg_rp_updated ON public.hyro_reseller_pricing;
CREATE TRIGGER trg_rp_updated BEFORE UPDATE ON public.hyro_reseller_pricing
  FOR EACH ROW EXECUTE FUNCTION public.hyro_touch_updated_at();

DROP TRIGGER IF EXISTS trg_po_updated ON public.hyro_payment_orders;
CREATE TRIGGER trg_po_updated BEFORE UPDATE ON public.hyro_payment_orders
  FOR EACH ROW EXECUTE FUNCTION public.hyro_touch_updated_at();
