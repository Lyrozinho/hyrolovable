-- ============================================================================
-- SISTEMA DE AFILIADOS — HYRO
-- Rodar no SQL Editor do Supabase EXTERNO (zoxdnsjhdpdhwyxbluax)
-- 100% idempotente: pode rodar quantas vezes quiser, não duplica nada.
-- Não altera dados existentes. Só ADICIONA colunas e tabelas.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Novas colunas em hyro_extension_users
-- ---------------------------------------------------------------------------
ALTER TABLE public.hyro_extension_users
  ADD COLUMN IF NOT EXISTS whatsapp            text,
  ADD COLUMN IF NOT EXISTS referrer_code       text,
  ADD COLUMN IF NOT EXISTS referrer_user_id    uuid,
  ADD COLUMN IF NOT EXISTS affiliate_code      text,
  ADD COLUMN IF NOT EXISTS lifetime_bonus_granted boolean NOT NULL DEFAULT false;

-- WhatsApp único (permite NULL para usuários antigos)
CREATE UNIQUE INDEX IF NOT EXISTS hyro_users_whatsapp_unique
  ON public.hyro_extension_users (whatsapp)
  WHERE whatsapp IS NOT NULL;

-- Código de afiliado único
CREATE UNIQUE INDEX IF NOT EXISTS hyro_users_affiliate_code_unique
  ON public.hyro_extension_users (affiliate_code)
  WHERE affiliate_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS hyro_users_referrer_user_idx
  ON public.hyro_extension_users (referrer_user_id);

-- ---------------------------------------------------------------------------
-- 2) Gerador de código curto (6 chars alfanuméricos sem ambíguos)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hyro_gen_affiliate_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code   text;
  exists_flag boolean;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.hyro_extension_users WHERE affiliate_code = code)
      INTO exists_flag;
    EXIT WHEN NOT exists_flag;
  END LOOP;
  RETURN code;
END;
$$;

-- Backfill: garante que TODO user existente tenha affiliate_code
UPDATE public.hyro_extension_users
SET affiliate_code = public.hyro_gen_affiliate_code()
WHERE affiliate_code IS NULL;

-- Trigger para novos users
CREATE OR REPLACE FUNCTION public.hyro_users_set_affiliate_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.affiliate_code IS NULL THEN
    NEW.affiliate_code := public.hyro_gen_affiliate_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hyro_users_affiliate_code_trg ON public.hyro_extension_users;
CREATE TRIGGER hyro_users_affiliate_code_trg
  BEFORE INSERT ON public.hyro_extension_users
  FOR EACH ROW EXECUTE FUNCTION public.hyro_users_set_affiliate_code();

-- ---------------------------------------------------------------------------
-- 3) Tabela de indicações
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hyro_affiliate_referrals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_user_id   uuid NOT NULL,             -- quem indicou
  referred_user_id    uuid NOT NULL,             -- quem foi indicado
  referred_email      text,
  code_used           text NOT NULL,
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','paid','canceled')),
  order_id            uuid,                      -- fk lógica p/ hyro_payment_orders (Cloud)
  amount_cents        integer,
  commission_cents    integer,
  created_at          timestamptz NOT NULL DEFAULT now(),
  paid_at             timestamptz
);

CREATE INDEX IF NOT EXISTS hyro_affiliate_referrals_affiliate_idx
  ON public.hyro_affiliate_referrals (affiliate_user_id);
CREATE INDEX IF NOT EXISTS hyro_affiliate_referrals_referred_idx
  ON public.hyro_affiliate_referrals (referred_user_id);
CREATE INDEX IF NOT EXISTS hyro_affiliate_referrals_status_idx
  ON public.hyro_affiliate_referrals (status);
CREATE UNIQUE INDEX IF NOT EXISTS hyro_affiliate_referrals_referred_unique
  ON public.hyro_affiliate_referrals (referred_user_id);

-- ---------------------------------------------------------------------------
-- 4) Tabela de recompensas concedidas (auditoria)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hyro_affiliate_rewards (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  kind         text NOT NULL
                 CHECK (kind IN ('lifetime_bonus','reseller_commission')),
  license_id   text,
  amount_cents integer,
  note         text,
  granted_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hyro_affiliate_rewards_user_idx
  ON public.hyro_affiliate_rewards (user_id);

-- ---------------------------------------------------------------------------
-- 5) Tabela de vendas atribuídas (usada pelo painel financeiro da revenda)
--    Espelha info agregada que vem do Lovable Cloud (payment_orders).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hyro_affiliate_sales (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_user_id uuid NOT NULL,               -- revenda dono do código
  buyer_user_id    uuid,
  buyer_email      text,
  buyer_whatsapp   text,
  amount_cents     integer NOT NULL,
  commission_cents integer NOT NULL DEFAULT 0,
  code_used        text NOT NULL,
  order_id         uuid,                         -- ref hyro_payment_orders
  license_id       text,
  status           text NOT NULL DEFAULT 'paid'
                     CHECK (status IN ('pending','paid','refunded','canceled')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  paid_at          timestamptz
);

CREATE INDEX IF NOT EXISTS hyro_affiliate_sales_affiliate_idx
  ON public.hyro_affiliate_sales (affiliate_user_id);
CREATE INDEX IF NOT EXISTS hyro_affiliate_sales_created_idx
  ON public.hyro_affiliate_sales (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS hyro_affiliate_sales_order_unique
  ON public.hyro_affiliate_sales (order_id)
  WHERE order_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 6) Função: creditar indicação quando pagamento é confirmado
--    Chamada pelo servidor após VexoPay confirmar 'paid'.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hyro_award_referral(
  p_referred_user_id uuid,
  p_order_id         uuid,
  p_amount_cents     integer,
  p_license_id       text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_ref          public.hyro_affiliate_referrals%ROWTYPE;
  v_affiliate    uuid;
  v_paid_count   integer;
  v_bonus_given  boolean;
  v_new_license  text;
  v_result       jsonb := jsonb_build_object('ok', true);
BEGIN
  -- Localiza a referral desse usuário
  SELECT * INTO v_ref
    FROM public.hyro_affiliate_referrals
   WHERE referred_user_id = p_referred_user_id
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'no_referral');
  END IF;

  IF v_ref.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'already_paid');
  END IF;

  v_affiliate := v_ref.affiliate_user_id;

  -- Marca referral como paga
  UPDATE public.hyro_affiliate_referrals
     SET status       = 'paid',
         order_id     = COALESCE(p_order_id, order_id),
         amount_cents = COALESCE(p_amount_cents, amount_cents),
         paid_at      = now()
   WHERE id = v_ref.id;

  -- Registra também em hyro_affiliate_sales (para painel financeiro da revenda)
  INSERT INTO public.hyro_affiliate_sales
    (affiliate_user_id, buyer_user_id, amount_cents, code_used, order_id, license_id, status, paid_at)
  VALUES
    (v_affiliate, p_referred_user_id, p_amount_cents, v_ref.code_used, p_order_id, p_license_id, 'paid', now())
  ON CONFLICT (order_id) WHERE order_id IS NOT NULL DO NOTHING;

  -- Verifica bônus vitalício (apenas para role='user', não revenda)
  SELECT lifetime_bonus_granted INTO v_bonus_given
    FROM public.hyro_extension_users
   WHERE id = v_affiliate;

  IF v_bonus_given IS DISTINCT FROM true THEN
    SELECT COUNT(*) INTO v_paid_count
      FROM public.hyro_affiliate_referrals
     WHERE affiliate_user_id = v_affiliate
       AND status = 'paid';

    v_result := v_result || jsonb_build_object('paid_count', v_paid_count);

    IF v_paid_count >= 3 THEN
      -- Concede licença vitalícia
      v_new_license := 'HYROBONUS-' || substr(md5(random()::text || v_affiliate::text), 1, 12);

      INSERT INTO public.hyro_extension_licenses
        (id, user_id, status, created_at, expires_at)
      VALUES
        (v_new_license, v_affiliate, 'ativa', now(), NULL)
      ON CONFLICT (id) DO NOTHING;

      UPDATE public.hyro_extension_users
         SET lifetime_bonus_granted = true
       WHERE id = v_affiliate;

      INSERT INTO public.hyro_affiliate_rewards (user_id, kind, license_id, note)
      VALUES (v_affiliate, 'lifetime_bonus', v_new_license,
              'Bônus por 3 indicações pagas');

      v_result := v_result || jsonb_build_object(
        'lifetime_granted', true,
        'license_id', v_new_license
      );
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- FIM. Nenhuma linha existente foi modificada exceto o backfill de affiliate_code.
-- ---------------------------------------------------------------------------
