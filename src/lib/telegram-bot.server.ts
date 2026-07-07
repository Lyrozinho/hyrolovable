// Server-only Telegram bot helper.
// Handles updates, authorization, conversation state and license/reseller creation.
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const EXT_URL = "https://zoxdnsjhdpdhwyxbluax.supabase.co";
const EXT_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpveGRuc2poZHBkaHd5eGJsdWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MzU0ODIsImV4cCI6MjA5ODUxMTQ4Mn0.Tb_TKnYsIroEmmjoIFLJcQCrtCZw3AlUWHf6dzj_4g0";

function ext() {
  return createClient(EXT_URL, EXT_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const PANEL_URL = "https://hyrolovable.lovable.app";
const EXTENSION_URL = PANEL_URL + "/upgrade";
const SUPPORT_WHATSAPP = "(27) 98135-9051";

// ---------- Telegram API ----------

function botToken(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN não configurado");
  return t;
}

export async function tg(method: string, body: unknown): Promise<any> {
  const res = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({}));
}

export async function setWebhook(url: string): Promise<any> {
  const secret = deriveWebhookSecret();
  const r = await tg("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  await supabaseAdmin
    .from("hyro_telegram_config")
    .upsert(
      {
        id: 1,
        webhook_url: url,
        webhook_set_at: new Date().toISOString(),
        last_error: r?.ok ? null : JSON.stringify(r),
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "id" },
    );
  return r;
}

export async function getWebhookInfo(): Promise<any> {
  return tg("getWebhookInfo", {});
}

export function deriveWebhookSecret(): string {
  // Derive a stable secret from the bot token itself.
  // Uses SHA-256 hex (only [a-f0-9], matches Telegram's allowed charset A-Za-z0-9_-).
  const token = botToken();
  // Node crypto is available on the worker runtime with nodejs_compat.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("crypto") as typeof import("crypto");
  return createHash("sha256").update(`telegram-webhook:${token}`).digest("hex");
}

// ---------- Auth ----------

export async function isAllowed(telegramId: string): Promise<{ allowed: boolean; isSuper: boolean }> {
  const { data } = await supabaseAdmin
    .from("hyro_telegram_allowed_users")
    .select("is_super")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  if (!data) return { allowed: false, isSuper: false };
  return { allowed: true, isSuper: !!(data as any).is_super };
}

export async function listAllowed(): Promise<Array<{ telegram_id: string; is_super: boolean; note: string | null; created_at: string }>> {
  const { data } = await supabaseAdmin
    .from("hyro_telegram_allowed_users")
    .select("telegram_id,is_super,note,created_at")
    .order("created_at", { ascending: true });
  return (data as any) ?? [];
}

export async function allowUser(telegramId: string, note?: string | null) {
  const id = String(telegramId).trim();
  if (!/^\d+$/.test(id)) throw new Error("ID do Telegram inválido (somente números)");
  const { error } = await supabaseAdmin
    .from("hyro_telegram_allowed_users")
    .upsert({ telegram_id: id, is_super: false, note: note ?? null } as any, { onConflict: "telegram_id" });
  if (error) throw error;
}

export async function revokeUser(telegramId: string) {
  await supabaseAdmin
    .from("hyro_telegram_allowed_users")
    .delete()
    .eq("telegram_id", String(telegramId).trim())
    .eq("is_super", false);
}

// ---------- State ----------

type BotState = {
  flow?: "lic_normal" | "lic_perso" | "reseller" | "allow_user" | "revoke_user";
  step?: string;
  data?: Record<string, any>;
};

async function getState(chatId: string): Promise<BotState> {
  const { data } = await supabaseAdmin
    .from("hyro_telegram_bot_state")
    .select("state")
    .eq("telegram_id", chatId)
    .maybeSingle();
  return ((data as any)?.state as BotState) ?? {};
}

async function setState(chatId: string, state: BotState) {
  await supabaseAdmin
    .from("hyro_telegram_bot_state")
    .upsert({ telegram_id: chatId, state: state as any, updated_at: new Date().toISOString() } as any, {
      onConflict: "telegram_id",
    });
}

async function clearState(chatId: string) {
  await supabaseAdmin.from("hyro_telegram_bot_state").delete().eq("telegram_id", chatId);
}

// ---------- Helpers ----------

async function sha256Hex(input: string): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(input).digest("hex");
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateLicenseKey(): string {
  const { randomBytes } = require("crypto") as typeof import("crypto");
  const rand = (n: number) => {
    const b = randomBytes(n);
    let s = "";
    for (let i = 0; i < n; i++) s += ALPHABET[b[i] % ALPHABET.length];
    return s;
  };
  return [rand(3), rand(4), rand(3), rand(3)].join("-");
}
function generateSlug(): string {
  const alpha = "abcdefghjkmnpqrstuvwxyz23456789";
  const { randomBytes } = require("crypto") as typeof import("crypto");
  const b = randomBytes(10);
  let s = "";
  for (let i = 0; i < 10; i++) s += alpha[b[i] % alpha.length];
  return s;
}

function buildLicenseMessage(input: {
  key?: string;
  email: string;
  password?: string;
  validity: string;
  redemptionUrl?: string;
}): string {
  const warning = [
    "━━━━━━━━━━━━━━━━━━",
    "⚠️ *Aviso importante*",
    "Esta licença é *pessoal e intransferível*. É *proibido revender, ceder ou compartilhar*.",
    "Casos identificados de revenda resultam em *suspensão imediata sem reembolso*.",
  ];
  if (input.redemptionUrl) {
    return [
      "🎉 *Sua licença Hyro Lovable está pronta!*",
      "",
      "Olá! Criamos um link exclusivo pra você resgatar sua licença. Só você poderá abrir — o link trava no seu IP no primeiro acesso.",
      "",
      "🔗 *Seu link de resgate*",
      input.redemptionUrl,
      "",
      "📧 *E-mail de acesso*",
      input.email,
      "",
      "📅 *Validade*",
      input.validity,
      "",
      "📥 *Baixar a extensão*",
      EXTENSION_URL,
      "",
      "━━━━━━━━━━━━━━━━━━",
      "*Como resgatar:*",
      "1️⃣ Abra o link de resgate no seu navegador",
      "2️⃣ Preencha nome, sobrenome e senha (o e-mail já vem preenchido)",
      "3️⃣ Baixe e instale a extensão pelo link acima",
      "4️⃣ Sua licença será liberada automaticamente",
      "",
      ...warning,
      "",
      `💬 Dúvidas? WhatsApp: ${SUPPORT_WHATSAPP}`,
      "",
      "_Obrigado por escolher a Hyro Lovable! 🚀_",
    ].join("\n");
  }
  return [
    "🎉 *Sua licença Hyro Lovable está pronta!*",
    "",
    "Olá! Sua licença foi ativada com sucesso. Guarde estes dados em local seguro:",
    "",
    "🔑 *Chave de licença*",
    "`" + input.key + "`",
    "",
    "📧 *E-mail de acesso*",
    input.email,
    ...(input.password ? ["", "🔒 *Senha do painel*", input.password] : []),
    "",
    "📅 *Validade*",
    input.validity,
    "",
    "🌐 *Acesse o painel*",
    PANEL_URL,
    "",
    "📥 *Baixar a extensão*",
    EXTENSION_URL,
    "",
    "━━━━━━━━━━━━━━━━━━",
    "*Como começar:*",
    "1️⃣ Acesse o painel pelo link acima",
    ...(input.password
      ? ["2️⃣ Faça login com o e-mail e senha enviados"]
      : ["2️⃣ Solicite sua senha de acesso pelo suporte"]),
    "3️⃣ Baixe e instale a extensão pelo link de download",
    "4️⃣ Ative com sua chave de licença",
    "",
    ...warning,
    "",
    `💬 Dúvidas? WhatsApp: ${SUPPORT_WHATSAPP}`,
    "",
    "_Obrigado por escolher a Hyro Lovable! 🚀_",
  ].join("\n");
}

function validityLabel(days: number, lifetime: boolean): { validity: string; expiresAt: Date } {
  if (lifetime) return { validity: "Vitalícia (nunca expira)", expiresAt: new Date("2099-12-31T23:59:59Z") };
  const d = new Date(Date.now() + days * 24 * 3600 * 1000);
  return {
    validity: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }),
    expiresAt: d,
  };
}

// ---------- Core actions ----------

export async function createLicenseNormal(input: {
  email: string;
  password: string;
  days: number; // 0 or negative => lifetime? we treat 0=lifetime
  lifetime?: boolean;
}): Promise<{ key: string; message: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("E-mail inválido");
  if (!input.password || input.password.length < 6) throw new Error("Senha mínima 6 caracteres");
  const lifetime = !!input.lifetime;
  const days = Math.max(1, Number(input.days) || 30);
  const { validity, expiresAt } = validityLabel(days, lifetime);
  const key = generateLicenseKey();

  const client = ext();
  const passwordHash = await sha256Hex(input.password);

  // upsert user
  const { data: existing } = await client
    .from("hyro_extension_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  let userId: string;
  if (existing) {
    userId = (existing as any).id;
    await client
      .from("hyro_extension_users")
      .update({ password_hash: passwordHash, active: true } as any)
      .eq("id", userId);
  } else {
    const { data: created, error } = await client
      .from("hyro_extension_users")
      .insert({
        email,
        name: email.split("@")[0],
        role: "user",
        password_hash: passwordHash,
        active: true,
      } as any)
      .select("id")
      .single();
    if (error) throw error;
    userId = (created as any).id;
  }

  const { error: licErr } = await client.from("hyro_extension_licenses").insert({
    id: key,
    user_id: userId,
    status: "ativa",
    expires_at: expiresAt.toISOString(),
    created_by: null,
    reseller_id: null,
  } as any);
  if (licErr) throw licErr;

  const message = buildLicenseMessage({ key, email, password: input.password, validity });
  return { key, message };
}

export async function createLicensePerso(input: {
  email: string;
  days: number;
  lifetime?: boolean;
}): Promise<{ key: string; url: string; message: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("E-mail inválido");
  const lifetime = !!input.lifetime;
  const days = Math.max(1, Number(input.days) || 30);
  const { validity, expiresAt } = validityLabel(days, lifetime);
  const key = generateLicenseKey();

  const client = ext();

  const { data: existing } = await client
    .from("hyro_extension_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  let userId: string;
  if (existing) {
    userId = (existing as any).id;
  } else {
    const { data: created, error } = await client
      .from("hyro_extension_users")
      .insert({
        email,
        name: email.split("@")[0],
        role: "user",
        password_hash: "",
        active: false,
      } as any)
      .select("id")
      .single();
    if (error) throw error;
    userId = (created as any).id;
  }

  const { error: licErr } = await client.from("hyro_extension_licenses").insert({
    id: key,
    user_id: userId,
    status: "ativa",
    expires_at: expiresAt.toISOString(),
  } as any);
  if (licErr) throw licErr;

  const slug = generateSlug();
  const { error: linkErr } = await supabaseAdmin
    .from("hyro_redemption_links")
    .insert({
      slug,
      license_id: key,
      target_email: email,
      created_by: "telegram-bot",
      kind: "license",
    } as any);
  if (linkErr) throw linkErr;

  const url = `${PANEL_URL}/r/${slug}`;
  const message = buildLicenseMessage({ email, validity, redemptionUrl: url });
  return { key, url, message };
}

export async function createReseller(input: {
  email: string;
  password: string;
  balance: number;
  name?: string;
}): Promise<{ email: string; balance: number; message: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("E-mail inválido");
  if (!input.password || input.password.length < 6) throw new Error("Senha mínima 6 caracteres");
  const balance = Math.max(0, Number(input.balance) || 0);
  const passwordHash = await sha256Hex(input.password);
  const client = ext();

  const { data: existing } = await client
    .from("hyro_extension_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  let resellerId: string;
  if (existing) {
    resellerId = (existing as any).id;
    await client
      .from("hyro_extension_users")
      .update({
        name: (input.name || email.split("@")[0]).trim(),
        role: "reseller",
        password_hash: passwordHash,
        active: true,
      } as any)
      .eq("id", resellerId);
  } else {
    const { data: created, error } = await client
      .from("hyro_extension_users")
      .insert({
        email,
        name: (input.name || email.split("@")[0]).trim(),
        role: "reseller",
        password_hash: passwordHash,
        active: true,
      } as any)
      .select("id")
      .single();
    if (error) throw error;
    resellerId = (created as any).id;
  }

  // Set initial balance via RPC (falls back to direct upsert).
  const { error: rpcErr } = await client.rpc("admin_adjust_reseller_balance", {
    p_reseller_id: resellerId,
    p_delta: balance,
    p_note: "Saldo inicial (via bot Telegram)",
  } as any);
  if (rpcErr) {
    await client
      .from("hyro_reseller_balances")
      .upsert({ reseller_id: resellerId, balance } as any, { onConflict: "reseller_id" });
  }

  const message = [
    "🎉 *Revendedor criado com sucesso!*",
    "",
    "📧 *E-mail*",
    email,
    "",
    "🔒 *Senha*",
    input.password,
    "",
    "💳 *Saldo inicial*",
    `${balance} licença(s)`,
    "",
    "🌐 *Acesse o painel*",
    PANEL_URL,
    "",
    "━━━━━━━━━━━━━━━━━━",
    "⚠️ *Aviso importante*",
    "É *proibido revender, ceder ou compartilhar* fora dos termos combinados.",
    "Casos identificados resultam em *suspensão imediata sem reembolso*.",
    "",
    `💬 Dúvidas? WhatsApp: ${SUPPORT_WHATSAPP}`,
  ].join("\n");

  return { email, balance, message };
}

// ---------- Update dispatcher ----------

const MAIN_MENU = {
  inline_keyboard: [
    [{ text: "🔑 Criar licença (normal)", callback_data: "lic_normal" }],
    [{ text: "🔗 Criar licença (link personalizado)", callback_data: "lic_perso" }],
    [{ text: "👥 Criar revendedor", callback_data: "reseller" }],
    [{ text: "✅ Liberar usuário (super)", callback_data: "allow_user" }],
    [{ text: "🚫 Remover usuário (super)", callback_data: "revoke_user" }],
    [{ text: "📋 Listar usuários", callback_data: "list_users" }],
    [{ text: "❌ Cancelar operação", callback_data: "cancel" }],
  ],
};

async function sendMenu(chatId: string, text = "*Menu principal*\nEscolha uma ação:") {
  return tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    reply_markup: MAIN_MENU,
  });
}

async function sendText(chatId: string, text: string, extra: Record<string, any> = {}) {
  return tg("sendMessage", { chat_id: chatId, text, parse_mode: "Markdown", ...extra });
}

export async function handleUpdate(update: any): Promise<void> {
  try {
    // Callback query
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = String(cq.message?.chat?.id ?? cq.from?.id);
      const userId = String(cq.from?.id);
      await tg("answerCallbackQuery", { callback_query_id: cq.id });

      const { allowed, isSuper } = await isAllowed(userId);
      if (!allowed) return void (await sendText(chatId, "🚫 Acesso negado. Peça ao administrador para liberar seu ID: `" + userId + "`"));

      const action = String(cq.data || "");
      if (action === "cancel") {
        await clearState(chatId);
        return void (await sendMenu(chatId, "❌ Operação cancelada.\n\n*Menu principal*"));
      }
      if (action === "list_users") {
        const users = await listAllowed();
        const lines = users.length
          ? users.map((u) => `• \`${u.telegram_id}\`${u.is_super ? " 👑" : ""}${u.note ? ` — ${u.note}` : ""}`).join("\n")
          : "_Nenhum usuário autorizado._";
        return void (await sendText(chatId, `*Usuários autorizados:*\n${lines}`, { reply_markup: MAIN_MENU }));
      }
      if (action === "allow_user") {
        if (!isSuper) return void (await sendText(chatId, "🚫 Apenas o superadmin pode liberar usuários."));
        await setState(chatId, { flow: "allow_user", step: "id", data: {} });
        return void (await sendText(chatId, "Envie o *ID do Telegram* a liberar (somente números):"));
      }
      if (action === "revoke_user") {
        if (!isSuper) return void (await sendText(chatId, "🚫 Apenas o superadmin pode remover usuários."));
        await setState(chatId, { flow: "revoke_user", step: "id", data: {} });
        return void (await sendText(chatId, "Envie o *ID do Telegram* a remover:"));
      }
      if (action === "lic_normal") {
        await setState(chatId, { flow: "lic_normal", step: "email", data: {} });
        return void (await sendText(chatId, "📧 Envie o *e-mail* do cliente:"));
      }
      if (action === "lic_perso") {
        await setState(chatId, { flow: "lic_perso", step: "email", data: {} });
        return void (await sendText(chatId, "📧 Envie o *e-mail* do cliente:"));
      }
      if (action === "reseller") {
        await setState(chatId, { flow: "reseller", step: "email", data: {} });
        return void (await sendText(chatId, "📧 Envie o *e-mail* do revendedor:"));
      }
      return;
    }

    const msg = update.message ?? update.edited_message;
    if (!msg?.chat?.id) return;
    const chatId = String(msg.chat.id);
    const fromId = String(msg.from?.id ?? chatId);
    const text = (msg.text ?? "").trim();

    const { allowed, isSuper } = await isAllowed(fromId);
    if (!allowed) {
      return void (await sendText(
        chatId,
        "🚫 *Acesso negado*\n\nEste bot é privado. Peça ao administrador para liberar seu ID abaixo:\n\n`" + fromId + "`",
      ));
    }

    if (text === "/start" || text === "/menu") {
      await clearState(chatId);
      return void (await sendMenu(chatId, `👋 Olá! Bot *Hyro Lovable*\nSeu ID: \`${fromId}\`${isSuper ? " 👑" : ""}\n\n*Menu principal*`));
    }
    if (text === "/cancel") {
      await clearState(chatId);
      return void (await sendMenu(chatId, "❌ Operação cancelada.\n\n*Menu principal*"));
    }
    if (text === "/id") {
      return void (await sendText(chatId, `Seu ID: \`${fromId}\``));
    }

    const state = await getState(chatId);
    if (!state.flow) return void (await sendMenu(chatId));

    // --- Flow handlers ---
    if (state.flow === "allow_user") {
      if (!isSuper) {
        await clearState(chatId);
        return void (await sendText(chatId, "🚫 Sem permissão."));
      }
      try {
        await allowUser(text);
        await clearState(chatId);
        return void (await sendText(chatId, `✅ Usuário \`${text}\` liberado.`, { reply_markup: MAIN_MENU }));
      } catch (e: any) {
        return void (await sendText(chatId, `❌ ${e.message || "Erro"}`));
      }
    }
    if (state.flow === "revoke_user") {
      if (!isSuper) {
        await clearState(chatId);
        return void (await sendText(chatId, "🚫 Sem permissão."));
      }
      await revokeUser(text);
      await clearState(chatId);
      return void (await sendText(chatId, `✅ Usuário \`${text}\` removido (se existia e não era super).`, { reply_markup: MAIN_MENU }));
    }

    if (state.flow === "lic_normal") {
      const data = state.data ?? {};
      if (state.step === "email") {
        data.email = text;
        await setState(chatId, { ...state, step: "password", data });
        return void (await sendText(chatId, "🔒 Envie a *senha* do painel (mín. 6 caracteres):"));
      }
      if (state.step === "password") {
        data.password = text;
        await setState(chatId, { ...state, step: "days", data });
        return void (await sendText(chatId, "📅 Envie a *validade em dias* (ex.: 30) ou digite `vitalicia` para nunca expirar:"));
      }
      if (state.step === "days") {
        const lifetime = /^vital[ií]cia?$/i.test(text);
        const days = lifetime ? 0 : parseInt(text) || 30;
        try {
          const res = await createLicenseNormal({ email: data.email, password: data.password, days, lifetime });
          await clearState(chatId);
          await sendText(chatId, `✅ *Licença criada*\nChave: \`${res.key}\`\n\n*Mensagem pronta abaixo:*`);
          await sendText(chatId, res.message, { reply_markup: MAIN_MENU });
          return;
        } catch (e: any) {
          await clearState(chatId);
          return void (await sendText(chatId, `❌ Falhou: ${e.message || e}`, { reply_markup: MAIN_MENU }));
        }
      }
    }

    if (state.flow === "lic_perso") {
      const data = state.data ?? {};
      if (state.step === "email") {
        data.email = text;
        await setState(chatId, { ...state, step: "days", data });
        return void (await sendText(chatId, "📅 Envie a *validade em dias* (ex.: 30) ou `vitalicia`:"));
      }
      if (state.step === "days") {
        const lifetime = /^vital[ií]cia?$/i.test(text);
        const days = lifetime ? 0 : parseInt(text) || 30;
        try {
          const res = await createLicensePerso({ email: data.email, days, lifetime });
          await clearState(chatId);
          await sendText(chatId, `✅ *Link personalizado criado*\nChave: \`${res.key}\`\nLink: ${res.url}\n\n*Mensagem pronta abaixo:*`);
          await sendText(chatId, res.message, { reply_markup: MAIN_MENU });
          return;
        } catch (e: any) {
          await clearState(chatId);
          return void (await sendText(chatId, `❌ Falhou: ${e.message || e}`, { reply_markup: MAIN_MENU }));
        }
      }
    }

    if (state.flow === "reseller") {
      const data = state.data ?? {};
      if (state.step === "email") {
        data.email = text;
        await setState(chatId, { ...state, step: "password", data });
        return void (await sendText(chatId, "🔒 Envie a *senha* do revendedor (mín. 6):"));
      }
      if (state.step === "password") {
        data.password = text;
        await setState(chatId, { ...state, step: "balance", data });
        return void (await sendText(chatId, "💳 Envie o *saldo inicial* de licenças (número, ex.: 10):"));
      }
      if (state.step === "balance") {
        const balance = parseInt(text) || 0;
        try {
          const res = await createReseller({ email: data.email, password: data.password, balance });
          await clearState(chatId);
          await sendText(chatId, "✅ *Revendedor criado.*\n\n*Mensagem pronta abaixo:*");
          await sendText(chatId, res.message, { reply_markup: MAIN_MENU });
          return;
        } catch (e: any) {
          await clearState(chatId);
          return void (await sendText(chatId, `❌ Falhou: ${e.message || e}`, { reply_markup: MAIN_MENU }));
        }
      }
    }
  } catch (e: any) {
    console.error("[telegram-bot] handleUpdate error", e);
  }
}
