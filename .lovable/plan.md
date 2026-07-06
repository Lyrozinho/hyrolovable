# Segurança e rastreio ao vivo das licenças

## Diagnóstico (estado atual, sem inventar)

- Licenças ficam no Supabase externo (`hyro_extension_licenses`), sem nenhuma coluna de dispositivo/IP/heartbeat.
- `hyro_redemption_links` já trava o **link** por IP (`locked_ip`), mas isso protege só o resgate — não a licença em uso depois.
- `extension/background.js` está vazio: hoje a extensão **não valida a key**, **não envia telemetria** e **não pode ser bloqueada**. Sem tocar na extensão, "rastrear PCs" é impossível — o painel web não enxerga o computador de quem usa a key.
- Não existe tabela de sessões/dispositivos, nem policy admin em `hyro_extension_licenses` que dê ao `adminpainel@gmail.com` visão completa.

Ou seja: dá para implementar **segurança máxima real** — só que exige mexer nos 3 lados (banco + extensão + painel). É isso que o plano abaixo faz. Nada de "moda", só o essencial.

## Objetivo

1. Toda vez que a extensão sobe, ela se identifica no backend com a key + um `device_id` estável do PC.
2. Backend registra dispositivo (device_id, IP, user-agent, primeiro/último acesso, cidade aprox. via IP).
3. Regra dura: **1 licença = 1 dispositivo ativo**. Qualquer 2º device/IP diferente → licença entra em `bloqueada_compartilhamento`, extensão para de funcionar em segundos, admin vê no painel.
4. `adminpainel@gmail.com` tem uma tela "Rastreio ao vivo" por licença: lista de devices, IPs, heartbeat por segundo, botão de desbloquear/forçar logout/trocar device autorizado.

## Arquitetura

```text
 extensão (background.js)
   │  a cada 15s: POST /api/public/lic/heartbeat { key, device_id, ua }
   ▼
 server route (TanStack) — verifica assinatura + IP real (cf-connecting-ip)
   │
   ├─► RPC lic_register_heartbeat(key, device_id, ip, ua)
   │      • cria/atualiza hyro_license_devices
   │      • se device_id diferente do "authorized_device_id" da licença → marca suspeito
   │      • se >1 device_id ativo nos últimos 60s ou IP mudou de país → status = 'bloqueada_compartilhamento'
   │      • grava evento em hyro_license_events (audit log)
   │
   └─► resposta: { ok, status, reason }  ← extensão desliga se status != 'ativa'

 painel admin (/licenses/:id/rastreio)
   • Realtime subscribe em hyro_license_devices + hyro_license_events
   • Mostra devices online (heartbeat < 30s), IP, cidade, UA, tempo
   • Ações: desbloquear, revogar device, autorizar novo device, forçar logout
```

## Mudanças no banco (migration única)

Tabelas novas no Supabase da extensão:

- `hyro_license_devices(license_id, device_id, first_seen, last_seen, ip, ua, city, country, is_authorized, revoked_at)` — PK (license_id, device_id).
- `hyro_license_events(id, license_id, kind, device_id, ip, meta jsonb, created_at)` — kind: `heartbeat`, `new_device`, `ip_change`, `blocked_share`, `admin_unblock`, `admin_revoke_device`, `admin_authorize_device`.
- Colunas novas em `hyro_extension_licenses`: `authorized_device_id text`, `device_locked_at timestamptz`, `share_blocked_at timestamptz`, `share_block_reason text`. Status ganha valor `bloqueada_compartilhamento`.
- Função `lic_register_heartbeat(...)` (SECURITY DEFINER) faz toda a lógica atômica.
- RLS: dono da licença lê só as próprias linhas; `adminpainel@gmail.com` (via `has_role admin`) lê tudo. Escrita só via RPC do server route com service role.
- `ALTER PUBLICATION supabase_realtime ADD TABLE hyro_license_devices, hyro_license_events` → painel atualiza ao vivo.

## Mudanças na extensão (`extension/`)

- `background.js`: gera `device_id` uma vez (`crypto.randomUUID`) e salva em `chrome.storage.local`. Loop `setInterval` de 15s chamando `/api/public/lic/heartbeat`. Cacheia último `status`; se != `ativa`, desabilita popup e mostra motivo ("Licença bloqueada por compartilhamento — contate suporte").
- `popup.html`: campo pra colar a key na 1ª vez; depois só mostra status + device_id + botão "sair deste dispositivo".
- `manifest.json`: adicionar `host_permissions` para o domínio do painel (necessário pro fetch autenticado). Sem novas permissões abusivas.

## Mudanças no painel

- **Server route** `src/routes/api/public/lic/heartbeat.ts`: valida payload (Zod), lê IP real do header, chama RPC com `supabaseAdmin` (import dentro do handler), responde `{ status, reason }`. Rate limit simples por key+IP.
- **Tela nova** `src/routes/_dash.licenses.$id.rastreio.tsx` (só admin): lista devices ao vivo (Realtime), timeline de eventos, badge "online agora" quando `last_seen < 30s`, botões:
  - Desbloquear compartilhamento
  - Revogar device X
  - Autorizar novo device (força `authorized_device_id`)
  - Forçar logout de todos (limpa devices, extensão volta a pedir key)
- **Lista de licenças**: coluna "Devices" (contagem online) + ícone 🔴 quando `share_blocked_at is not null`.
- Cliente comum vê **só suas licenças e seus devices** (nada de ver outros). Admin vê tudo.

## Regras de bloqueio (precisas, sem "achismo")

- `authorized_device_id IS NULL` no 1º heartbeat → grava esse device como autorizado.
- Heartbeat com `device_id != authorized_device_id` → evento `new_device` + status `bloqueada_compartilhamento` + resposta `{ status: 'blocked', reason: 'device_mismatch' }`.
- Heartbeat do device autorizado mas de país diferente do último visto → evento `ip_change`; se mudar 2x em <10min → bloqueia.
- Depois de bloqueada, só admin desbloqueia; ao desbloquear pode escolher qual device_id fica como autorizado.
- Extensão que receber `blocked` fica inutilizável até próximo heartbeat autorizado.

## Ordem de implementação

1. Migration (tabelas, colunas, RPC, RLS, GRANTs, realtime publication).
2. Server route `/api/public/lic/heartbeat` + assinatura HMAC leve com secret compartilhado (`add_secret` `LIC_HEARTBEAT_SECRET`).
3. Extensão: device_id + heartbeat + tratamento de status.
4. Painel: tela de rastreio ao vivo + ações admin + coluna na lista.
5. Testes: 1 key em 2 PCs simulados (2 device_ids) → tem que bloquear em <30s e aparecer no painel em tempo real.

## Riscos / trade-offs honestos

- **Sem extensão publicada nova, nada disso funciona** — usuários atuais precisam atualizar a extensão. Vou avisar isso na UI.
- IP muda sozinho (4G, VPN, troca de Wi-Fi). Por isso a regra dura é **device_id**, não IP. IP é sinal secundário (país/cidade).
- Geo por IP é aproximado (uso `cf-connecting-ip` + serviço gratuito tipo `ipapi.co` server-side, com cache). Não prometo precisão de rua.
- "Por segundo" real custa caro; uso heartbeat de 15s + Realtime. Na UI mostro "online agora / há X seg" — percepção de tempo real, sem estourar quota.

## O que NÃO vou fazer (pra não bagunçar)

- Não mudo login, permissões atuais, welcome modal, upgrade, tutoriais.
- Não removo nada da lista de licenças existente.
- Não mexo em `auth.users`, `storage`, `realtime`, `supabase_functions`.

Confirma que posso executar nessa ordem?
