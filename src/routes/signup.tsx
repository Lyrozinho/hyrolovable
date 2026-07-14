import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Mail, Lock, User as UserIcon, ShieldCheck, ArrowRight, Eye, EyeOff, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase as ext } from "@/lib/supabase";
import { getSessionHome, sha256Hex, useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import {
  getClientIP, bindOrCheckIP, fetchLink, markLinkClaimed,
  type RedemptionLink,
} from "@/lib/redemption";
import hyroLogo from "@/assets/hyro-logo.png";

type SignupSearch = { ref?: string };

export const Route = createFileRoute("/signup")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): SignupSearch => ({
    ref: typeof s.ref === "string" ? s.ref : undefined,
  }),
  component: SignupPage,
});

function SignupPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const { ref } = useSearch({ from: "/signup" });





  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [link, setLink] = useState<RedemptionLink | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(!!ref);

  useEffect(() => {
    if (!loading && session) navigate({ to: getSessionHome(session), replace: true });
  }, [loading, session, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ref) return;
      setInitializing(true);
      try {
        const ip = await getClientIP();
        const bound = await bindOrCheckIP(ref, ip);
        if (cancelled) return;
        if (bound.claimed_user_id) {
          setLinkError("Este link já foi utilizado. Faça login para acessar sua conta.");
          setLink(bound);
        } else {
          setLink(bound);
          setEmail(bound.target_email);
          if (bound.target_name) {
            const parts = bound.target_name.trim().split(/\s+/);
            setFirstName(parts[0] ?? "");
            setLastName(parts.slice(1).join(" "));
          }
        }
      } catch (e: any) {
        if (!cancelled) setLinkError(e?.message ?? "Link inválido.");
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ref]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) return toast.error("Informe seu nome.");
    if (!lastName.trim()) return toast.error("Informe seu sobrenome.");
    const em = (link?.target_email ?? email ?? "").trim().toLowerCase();
    if (!em || !em.includes("@") || em.length < 5) return toast.error("E-mail inválido.");
    if (password.length < 6) return toast.error("Senha deve ter no mínimo 6 caracteres.");
    if (password !== confirm) return toast.error("As senhas não coincidem.");

    setSubmitting(true);
    try {
      // Bloqueia se link já resgatado ou IP não confere
      let boundLink = link;
      if (ref) {
        const ip = await getClientIP();
        boundLink = await bindOrCheckIP(ref, ip);
        if (boundLink.claimed_user_id) throw new Error("Este link já foi utilizado.");
      }

      const passwordHash = await sha256Hex(password);
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

      // Verifica se e-mail já existe
      const { data: existing } = await ext
        .from("hyro_extension_users")
        .select("id, password_hash")
        .eq("email", em)
        .maybeSingle();

      let userId: string;
      const isResellerInvite = (boundLink as any)?.kind === "reseller";

      if (existing) {
        if (existing.password_hash) {
          throw new Error("Este e-mail já possui cadastro. Faça login.");
        }
        const { error: upErr } = await ext
          .from("hyro_extension_users")
          .update({
            email: em,
            password_hash: passwordHash,
            name: fullName,
            active: true,
            role: isResellerInvite ? "reseller" : "user",
          })
          .eq("id", existing.id);
        if (upErr) throw upErr;
        userId = existing.id;
      } else {
        if (!em) throw new Error("E-mail obrigatório para criar conta.");
        const { data: created, error: cErr } = await ext
          .from("hyro_extension_users")
          .insert({
            email: em,
            name: fullName,
            role: isResellerInvite ? "reseller" : "user",
            password_hash: passwordHash,
            active: true,
          })
          .select("id, email")
          .single();
        if (cErr) throw cErr;
        if (!created?.email) {
          // rollback defensivo caso o backend tenha rejeitado o email silenciosamente
          await ext.from("hyro_extension_users").delete().eq("id", created.id);
          throw new Error("Falha ao registrar e-mail. Tente novamente.");
        }
        userId = created.id;
      }

      // Se veio de link:
      //   - Licença (kind='license'): vincula a licença existente
      //   - Revenda (kind='reseller'): aplica saldo inicial via RPC (se disponível)
      if (boundLink) {
        const kind = (boundLink as any).kind ?? "license";
        if (kind === "reseller") {
          const slots = (boundLink as any).reseller_slots ?? 0;
          if (slots > 0) {
            try {
              await ext.rpc("admin_adjust_reseller_balance" as any, {
                p_reseller_id: userId,
                p_delta: slots,
                p_note: `Pacote inicial via link ${boundLink.slug}`,
              });
            } catch { /* fail-open — o admin pode ajustar depois */ }
          }
        } else if (boundLink.license_id) {
          await ext
            .from("hyro_extension_licenses")
            .update({ user_id: userId, status: "ativa" })
            .eq("id", boundLink.license_id);
        }
        await markLinkClaimed(boundLink.slug, userId);
      }


      toast.success("Conta criada! Faça login para continuar.");
      navigate({ to: "/login", replace: true });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao cadastrar");
    } finally {
      setSubmitting(false);
    }
  };

  const emailLocked = !!link && !link.claimed_user_id;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="h-14 flex items-center px-6 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <img src={hyroLogo} alt="Hyro" className="h-8 w-8 object-contain select-none" draggable={false} />
          <span className="text-sm font-semibold tracking-tight">Hyro</span>
          <span className="text-[11px] text-muted-foreground uppercase tracking-[0.14em]">Cadastro</span>
        </div>
        <div className="ml-auto"><ThemeToggle /></div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[440px]">
          <div className="rounded-2xl bg-card border border-border shadow-elegant p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
                  {ref ? "Link personalizado" : "Cadastro público"}
                </div>
                <h1 className="text-[22px] font-semibold tracking-tight">Criar sua conta</h1>
                <p className="text-[13px] text-muted-foreground mt-1.5">
                  {ref
                    ? "Complete seus dados para resgatar sua licença."
                    : "Preencha os dados abaixo para acessar o painel."}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg border border-border bg-secondary/40 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-4 w-4 text-foreground/70" />
              </div>
            </div>

            {initializing ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Validando link…
              </div>
            ) : linkError ? (
              <div className="space-y-4">
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-[13px] text-destructive flex gap-2">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>{linkError}</div>
                </div>
                <Link to="/login" className="text-[13px] text-primary hover:underline block text-center">
                  Ir para login →
                </Link>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3.5">
                {ref && link && (
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-[12px] flex gap-2">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                    <div>
                      Você foi convidado. Uma licença já está reservada para{" "}
                      <span className="font-medium">{link.target_email}</span>.
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Nome</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-10 pl-9 text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Sobrenome</Label>
                    <Input required value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-10 text-sm" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="email" required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      readOnly={emailLocked}
                      disabled={emailLocked}
                      placeholder="voce@exemplo.com"
                      className="h-10 pl-9 text-sm"
                    />
                  </div>
                  {emailLocked && (
                    <p className="text-[11px] text-muted-foreground">E-mail definido pelo administrador — não pode ser alterado.</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"} required minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-10 pl-9 pr-10 text-sm"
                    />
                    <button type="button" onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Confirmar senha</Label>
                  <Input type={showPassword ? "text" : "password"} required minLength={6}
                    value={confirm} onChange={(e) => setConfirm(e.target.value)}
                    className="h-10 text-sm" />
                </div>

                <Button type="submit" disabled={submitting} className="w-full h-11 gap-2 mt-2">
                  {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando…</> : <>Criar conta <ArrowRight className="h-3.5 w-3.5" /></>}
                </Button>

                <div className="text-center text-[12px] text-muted-foreground pt-2">
                  Já tem conta? <Link to="/login" className="text-primary hover:underline">Fazer login</Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
