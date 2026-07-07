
CREATE TABLE public.hyro_telegram_allowed_users (
  telegram_id text PRIMARY KEY,
  is_super boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.hyro_telegram_allowed_users TO service_role;
ALTER TABLE public.hyro_telegram_allowed_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.hyro_telegram_bot_state (
  telegram_id text PRIMARY KEY,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.hyro_telegram_bot_state TO service_role;
ALTER TABLE public.hyro_telegram_bot_state ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.hyro_telegram_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  webhook_url text,
  webhook_set_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.hyro_telegram_config TO service_role;
ALTER TABLE public.hyro_telegram_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.hyro_telegram_allowed_users (telegram_id, is_super, note)
VALUES ('8393477913', true, 'superadmin')
ON CONFLICT (telegram_id) DO UPDATE SET is_super = true;

INSERT INTO public.hyro_telegram_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
