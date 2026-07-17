# Sistema de Afiliados — Plano de Execução

Dado o escopo grande e o pedido explícito de "sem bugs, precisão total", vou dividir em **4 fases**. Cada fase é isolada e testável — nada quebra o que já existe.

---

## Fase 1 — Banco de dados (migration única)

Novas tabelas (todas com RLS + GRANTs corretos):

- **`hyro_affiliate_codes`** — código único por usuário (cliente OU revenda)
  - `user_id`, `code` (slug 6-8 chars único), `kind` ('customer' | 'reseller'), `created_at`
  - trigger para gerar automaticamente ao criar usuário

- **`hyro_affiliate_referrals`** — cada indicação atribuída
  - `affiliate_user_id` (quem indicou), `referred_user_id`, `referred_email`,
    `code_used`, `status` ('pending' | 'paid' | 'canceled'),
    `order_id` (fk hyro_payment_orders), `amount_cents`,
    `commission_cents` (para revenda), `created_at`, `paid_at`

- **`hyro_affiliate_rewards`** — recompensas concedidas (auditoria)
  - `user_id`, `kind` ('lifetime_bonus' | 'reseller_commission'),
    `license_id` (nullable), `amount_cents` (nullable), `granted_at`, `note`

Adicionar em `hyro_extension_users`:
- `whatsapp` (text, unique, index) — E.164 BR
- `referrer_code` (text, nullable) — código usado no cadastro
- `referrer_user_id` (uuid, nullable, fk lógica)

Adicionar em `hyro_payment_orders`:
- `affiliate_code` (text nullable) — captura no checkout
- `referral_id` (uuid nullable) — link para hyro_affiliate_referrals

Função SQL `award_referral_on_payment(order_id)` chamada quando pagamento é confirmado:
- marca referral como `paid`
- se atingiu 3 pagos únicos → cria licença vitalícia + registra reward + marca contador
- flag `lifetime_bonus_granted` (bool) em `hyro_extension_users` para evitar duplicação

---

## Fase 2 — Cadastro & Link de afiliado

- Atualizar `src/routes/signup.tsx`:
  - Adicionar campo **WhatsApp** com máscara `(XX) XXXXX-XXXX`, validação silenciosa
    (regex + verifica DDD válido BR + unicidade via query maybeSingle antes do submit)
  - Adicionar **"Lembrar senha"** checkbox (persistSession local)
  - Se URL tem `?aff=CODIGO`, resolve o código, salva em `referrer_code`/`referrer_user_id`
    e mostra "Você foi indicado por X"
- Nova rota `/a/$code` que redireciona para `/signup?aff=$code` (curta e compartilhável)
- Ao criar user, trigger no BD gera automaticamente seu próprio `affiliate_code`

---

## Fase 3 — Checkout mensal R$69,90 (cliente)

- Novo componente `MonthlyCheckoutDialog` reusando VexoPay PIX existente
- Botão "Adquirir licença mensal" no dashboard do cliente (`_dash.my-license.tsx`)
  visível quando o user **não tem licença ativa**
- Server fn `createMonthlyOrder`:
  - cria order 6990 cents, associa `affiliate_code = user.referrer_code`
  - dispara `createVexoPayPixCharge` já existente
- Webhook/pooling de status: quando `paid`, server fn `finalizeMonthlyOrder`:
  1. cria `hyro_extension_licenses` com `duration = 30 dias`, user_id = comprador
  2. chama `award_referral_on_payment(order_id)` → marca referral como paid,
     verifica se afiliado atingiu 3 → concede vitalícia
- Card de **Progresso de Indicações** no dashboard:
  `[●●○] 2 de 3 indicações pagas — falta 1 para sua licença vitalícia!`
  com lista dos indicados (email mascarado + status)

---

## Fase 4 — Painel Financeiro da Revenda

Nova rota `_dash.finance.tsx` (só role='reseller' e 'admin'):

- **Cards de resumo**: total vendido, total no mês, comissão acumulada, ticket médio
- **Gráfico de linhas** (recharts) — receita últimos 30 dias
- **Gráfico de barras** — top clientes por volume
- **Tabela paginada** — todas as vendas atribuídas ao código da revenda
- **Card de código de afiliado** com botão copy + QR code do link
- Tudo responsivo (grid → stack no mobile), skeleton loaders, sem delay perceptível

---

## Segurança / qualidade

- Todas as queries usam RLS scoped a `auth.uid()`
- Server fn `finalizeMonthlyOrder` só executa depois de VexoPay confirmar
  (idempotente via `order_id` único)
- WhatsApp validado no cliente + constraint UNIQUE no BD
- Sem `useEffect` polling agressivo — usa React Query com `staleTime` adequado
- Zero mudanças em fluxos existentes (renew, bonus, licenses admin)

---

## Ordem de execução

1. Confirmar plano com você
2. Rodar migration (Fase 1) — requer sua aprovação
3. Fase 2 (signup + link)
4. Fase 3 (checkout + progresso)
5. Fase 4 (painel financeiro)

Cada fase eu testo antes de seguir para a próxima. **Confirma que posso começar pela migration?**