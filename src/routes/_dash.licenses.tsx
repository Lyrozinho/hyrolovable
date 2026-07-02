import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus, Pencil, Ban, CheckCircle2, Trash2, Search, Loader2,
  KeyRound, Copy, Check, Infinity as InfinityIcon, Mail, CalendarClock, RefreshCw,
  FlaskConical, User as UserIcon, Timer,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { generateLicenseKey } from "@/lib/license-key";
import { toast } from "sonner";

export const Route = createFileRoute("/_dash/licenses")({
  component: LicensesPage,
});

type License = {
  id: string;
  user_id: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  user_email?: string | null;
};

const PAGE_SIZE = 15;
const TEST_EMAIL_DOMAIN = "teste.local";
const TEST_KEY_PREFIX = "TST";

function generateTestKey(): string {
  const base = generateLicenseKey().split("-").slice(1).join("-");
  return `${TEST_KEY_PREFIX}-${base}`;
}

function generateTestEmail(): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `teste-${ts}${rnd}@${TEST_EMAIL_DOMAIN}`;
}

async function sweepExpiredTestLicenses() {
  const nowIso = new Date().toISOString();
  const { data: expired } = await supabase
    .from("hyro_extension_licenses")
    .select("id, user_id")
    .ilike("id", `${TEST_KEY_PREFIX}-%`)
    .lt("expires_at", nowIso);
  if (!expired || expired.length === 0) return;
  const ids = expired.map((r: any) => r.id);
  const userIds = Array.from(new Set(expired.map((r: any) => r.user_id).filter(Boolean)));
  await supabase.from("hyro_extension_licenses").delete().in("id", ids);
  if (userIds.length) {
    await supabase
      .from("hyro_extension_users")
      .delete()
      .in("id", userIds)
      .ilike("email", `%@${TEST_EMAIL_DOMAIN}`);
  }
}

function LicensesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [editing, setEditing] = useState<License | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching, error } = useQuery({
    queryKey: ["licenses", search, status, page],
    queryFn: async () => {
      // Remove any expired test licenses before listing so UI stays in sync.
      await sweepExpiredTestLicenses();

      const term = search.trim();
      let matchedUserIds: string[] | null = null;


      // If searching, also try matching by user email
      if (term) {
        const { data: matchedUsers, error: mErr } = await supabase
          .from("hyro_extension_users")
          .select("id")
          .ilike("email", `%${term}%`);
        if (mErr) throw mErr;
        matchedUserIds = (matchedUsers ?? []).map((u: any) => u.id);
      }

      let query = supabase
        .from("hyro_extension_licenses")
        .select("id, user_id, status, expires_at, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (status !== "all") query = query.eq("status", status);
      if (term) {
        const ors = [`id.ilike.%${term}%`];
        if (matchedUserIds && matchedUserIds.length) {
          ors.push(`user_id.in.(${matchedUserIds.join(",")})`);
        }
        query = query.or(ors.join(","));
      }

      const { data: lics, error: lerr, count } = await query;
      if (lerr) throw lerr;

      const userIds = Array.from(
        new Set((lics ?? []).map((r: any) => r.user_id).filter(Boolean))
      );
      let emailMap: Record<string, string> = {};
      if (userIds.length) {
        const { data: users, error: uerr } = await supabase
          .from("hyro_extension_users")
          .select("id, email")
          .in("id", userIds);
        if (uerr) throw uerr;
        emailMap = Object.fromEntries((users ?? []).map((u: any) => [u.id, u.email]));
      }

      const rows: License[] = (lics ?? []).map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        status: r.status,
        expires_at: r.expires_at,
        created_at: r.created_at,
        user_email: r.user_id ? emailMap[r.user_id] ?? null : null,
      }));
      return { rows, count: count ?? 0 };
    },
  });

  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));
  const rows = data?.rows ?? [];

  const toggleStatus = async (l: License) => {
    const next = l.status === "ativa" ? "inativa" : "ativa";
    const { error } = await supabase
      .from("hyro_extension_licenses")
      .update({ status: next })
      .eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success(`Licença ${next === "ativa" ? "reativada" : "suspensa"}`);
    qc.invalidateQueries({ queryKey: ["licenses"] });
  };

  const remove = async (l: License) => {
    if (!confirm("Excluir esta licença permanentemente?")) return;
    const { error } = await supabase.from("hyro_extension_licenses").delete().eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success("Licença excluída");
    qc.invalidateQueries({ queryKey: ["licenses"] });
  };

  const copyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedId(key);
    setTimeout(() => setCopiedId((c) => (c === key ? null : c)), 1600);
  };

  const isLifetime = (d: string) => new Date(d).getUTCFullYear() >= 2090;

  // Periodic sweep to auto-remove expired test licenses in near real-time.
  useEffect(() => {
    const t = setInterval(() => {
      sweepExpiredTestLicenses().then(() => {
        qc.invalidateQueries({ queryKey: ["licenses"] });
        qc.invalidateQueries({ queryKey: ["dash-stats"] });
      });
    }, 30_000);
    return () => clearInterval(t);
  }, [qc]);


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight leading-tight">Licenças</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Gerencie chaves de licença associadas aos usuários da extensão.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => setTestOpen(true)}
          >
            <FlaskConical className="h-3.5 w-3.5 mr-1.5" /> Gerar teste
          </Button>
          <Button size="sm" className="h-9" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova licença
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por chave ou e-mail..."
            value={search}
            onChange={(e) => {
              setPage(0);
              setSearch(e.target.value);
            }}
            className="pl-9 h-9 bg-background border-border text-[13px]"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setPage(0);
            setStatus(v);
          }}
        >
          <SelectTrigger className="w-44 h-9 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="ativa">Ativa</SelectItem>
            <SelectItem value="inativa">Inativa</SelectItem>
            <SelectItem value="expirada">Expirada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 border-border">
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Chave</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">E-mail</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Status</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Expira</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Criada</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-14 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-14 text-destructive text-sm">
                  Erro ao carregar: {(error as any)?.message ?? "desconhecido"}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16">
                  <div className="mx-auto flex flex-col items-center gap-3 text-muted-foreground">
                    <div className="h-10 w-10 rounded-lg border border-dashed border-border flex items-center justify-center">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <div className="text-sm">Nenhuma licença encontrada</div>
                    <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Criar primeira licença
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((l) => {
                const expired = new Date(l.expires_at) < new Date();
                const lifetime = isLifetime(l.expires_at);
                const statusLabel = expired ? "expirada" : l.status;
                return (
                  <TableRow key={l.id} className="border-border">
                    <TableCell className="py-3">
                      <button
                        onClick={() => copyKey(l.id)}
                        className="group inline-flex items-center gap-2 font-mono text-[12.5px] text-foreground/90 hover:text-foreground"
                        title="Copiar chave"
                      >
                        <span className="tracking-wider">{l.id}</span>
                        {copiedId === l.id ? (
                          <Check className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-[13px]">{l.user_email ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={statusLabel} />
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {lifetime ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <InfinityIcon className="h-3.5 w-3.5" /> Lifetime
                        </span>
                      ) : (
                        new Date(l.expires_at).toLocaleDateString("pt-BR")
                      )}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {new Date(l.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-0.5">
                        <IconAction label="Editar" onClick={() => setEditing(l)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </IconAction>
                        <IconAction
                          label={l.status === "ativa" ? "Suspender" : "Reativar"}
                          onClick={() => toggleStatus(l)}
                        >
                          {l.status === "ativa" ? (
                            <Ban className="h-3.5 w-3.5" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                        </IconAction>
                        <IconAction label="Excluir" onClick={() => remove(l)} danger>
                          <Trash2 className="h-3.5 w-3.5" />
                        </IconAction>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-[12.5px]">
          <div className="text-muted-foreground tabular-nums">
            {data?.count ?? 0} licenças · Página {page + 1} de {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm" variant="outline"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              size="sm" variant="outline"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      </div>

      <CreateLicenseDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditLicenseDialog license={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; dot: string }> = {
    ativa: {
      label: "Ativa",
      className: "border-success/30 text-success bg-success/10",
      dot: "bg-success",
    },
    inativa: {
      label: "Suspensa",
      className: "border-border text-muted-foreground bg-muted/40",
      dot: "bg-muted-foreground",
    },
    expirada: {
      label: "Expirada",
      className: "border-destructive/30 text-destructive bg-destructive/10",
      dot: "bg-destructive",
    },
  };
  const s = map[status] ?? map.inativa;
  return (
    <Badge
      variant="outline"
      className={`gap-1.5 h-6 px-2 text-[11px] font-medium ${s.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </Badge>
  );
}

function IconAction({
  children, onClick, label, danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={[
        "h-8 w-8 rounded-md flex items-center justify-center transition-colors",
        "text-muted-foreground hover:bg-muted",
        danger ? "hover:text-destructive" : "hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function CreateLicenseDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [days, setDays] = useState("30");
  const [lifetime, setLifetime] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewKey, setPreviewKey] = useState<string>(generateLicenseKey());

  useEffect(() => {
    if (open) setPreviewKey(generateLicenseKey());
  }, [open]);

  const submit = async () => {
    const emailNorm = email.trim().toLowerCase();
    if (!emailNorm) {
      toast.error("Informe um e-mail.");
      return;
    }
    setSubmitting(true);
    try {
      // 1) Buscar ou criar usuário em hyro_extension_users
      let userId: string | null = null;
      const { data: existing, error: uerr } = await supabase
        .from("hyro_extension_users")
        .select("id")
        .eq("email", emailNorm)
        .maybeSingle();
      if (uerr) throw uerr;

      if (existing) {
        userId = existing.id;
      } else {
        const { data: created, error: cerr } = await supabase
          .from("hyro_extension_users")
          .insert({
            email: emailNorm,
            name: emailNorm.split("@")[0],
            role: "user",
            password_hash: "",
            active: true,
          })
          .select("id")
          .single();
        if (cerr) throw cerr;
        userId = created.id;
      }

      const expiresAt = lifetime
        ? new Date("2099-12-31T23:59:59Z")
        : new Date(Date.now() + parseInt(days || "30") * 24 * 3600 * 1000);

      const key = previewKey;
      const { error } = await supabase.from("hyro_extension_licenses").insert({
        id: key,
        user_id: userId,
        status: "ativa",
        expires_at: expiresAt.toISOString(),
      });
      if (error) throw error;
      toast.success("Licença criada", { description: key });
      qc.invalidateQueries({ queryKey: ["licenses"] });
      qc.invalidateQueries({ queryKey: ["dash-stats"] });
      onOpenChange(false);
      setEmail("");
      setDays("30");
      setLifetime(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel border-0 sm:max-w-[460px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-md bg-foreground text-background flex items-center justify-center shrink-0">
              <KeyRound className="h-4 w-4" strokeWidth={2} />
            </div>
            <div>
              <DialogTitle className="text-[15px] font-semibold tracking-tight">
                Nova licença
              </DialogTitle>
              <DialogDescription className="text-[12.5px] text-muted-foreground mt-0.5">
                Vincule uma nova chave a um usuário existente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5">
          {/* Key preview */}
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              Chave gerada
            </Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-md border border-border bg-muted/40 px-3 h-10 flex items-center font-mono text-[13px] tracking-widest">
                {previewKey}
              </div>
              <Button
                type="button" variant="outline" size="icon"
                className="h-10 w-10 shrink-0"
                title="Gerar outra"
                onClick={() => setPreviewKey(generateLicenseKey())}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Formato XXX-XXXX-XXX-XXX · gerada aleatoriamente
            </p>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              E-mail do usuário
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@exemplo.com"
                className="h-10 pl-9 text-[13px]"
              />
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              Duração
            </Label>
            <div className="rounded-md border border-border overflow-hidden divide-y divide-border">
              <div className="flex items-center px-3 h-10 gap-2">
                <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="number" min={1}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  disabled={lifetime}
                  className="h-8 border-0 shadow-none focus-visible:ring-0 p-0 text-[13px] bg-transparent disabled:opacity-50"
                />
                <span className="text-[12px] text-muted-foreground">dias</span>
              </div>
              <label className="flex items-center gap-2.5 px-3 h-10 cursor-pointer hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={lifetime}
                  onChange={(e) => setLifetime(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border accent-foreground"
                />
                <InfinityIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[13px]">Vitalícia (expira em 2099)</span>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/60 bg-muted/30 gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={submit} disabled={submitting || !email}>
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Criar licença
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditLicenseDialog({
  license,
  onClose,
}: {
  license: License | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [expires, setExpires] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (license) {
      setEmail(license.user_email ?? "");
      setExpires(license.expires_at.slice(0, 10));
    }
  }, [license]);

  if (!license) return null;

  const save = async () => {
    setSaving(true);
    try {
      let user_id = license.user_id;
      if (email && email !== license.user_email) {
        const { data: u, error } = await supabase
          .from("hyro_extension_users")
          .select("id")
          .eq("email", email.trim().toLowerCase())
          .maybeSingle();
        if (error) throw error;
        if (!u) {
          toast.error("Usuário não encontrado");
          return;
        }
        user_id = u.id;
      }
      const { error } = await supabase
        .from("hyro_extension_licenses")
        .update({
          user_id,
          expires_at: new Date(expires + "T23:59:59Z").toISOString(),
        })
        .eq("id", license.id);
      if (error) throw error;
      toast.success("Licença atualizada");
      qc.invalidateQueries({ queryKey: ["licenses"] });
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!license} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-panel border-0 sm:max-w-[460px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-md bg-foreground text-background flex items-center justify-center shrink-0">
              <Pencil className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-[15px] font-semibold tracking-tight">
                Editar licença
              </DialogTitle>
              <DialogDescription className="text-[12.5px] text-muted-foreground mt-0.5">
                Atualize o usuário associado ou a data de expiração.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5">
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              Chave
            </Label>
            <div className="rounded-md border border-border bg-muted/40 px-3 h-10 flex items-center font-mono text-[13px] tracking-widest text-muted-foreground">
              {license.id}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              E-mail
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 pl-9 text-[13px]"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              Expira em
            </Label>
            <Input
              type="date"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
              className="h-10 text-[13px]"
            />
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/60 bg-muted/30 gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
