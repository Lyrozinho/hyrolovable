import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { maskEmail } from "@/lib/mask-email";
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
  FlaskConical, User as UserIcon, Timer, Eye, EyeOff, MessageCircle, PartyPopper, ShieldCheck, Link2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PermissionsDialog } from "@/components/permissions-dialog";
import { RedemptionLinkDialog } from "@/components/redemption-link-dialog";
import { RenewLicenseSimpleDialog } from "@/components/renew-license-simple-dialog";
import { createLink as createRedemptionLink } from "@/lib/redemption";
import { generateLicenseKey } from "@/lib/license-key";
import { sha256Hex, useAuth } from "@/lib/auth";
import { consumeResellerLicenseCredit, getResellerBalance } from "@/lib/reseller-balance";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const OWNER_EMAIL = "adminpainel@gmail.com";
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
  const [permsFor, setPermsFor] = useState<License | null>(null);
  const [linkFor, setLinkFor] = useState<License | null>(null);
  const [renewFor, setRenewFor] = useState<License | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [revealAll, setRevealAll] = useState(false);
  const { session, sessionKey, authReady } = useAuth();
  const isAdmin = session?.user.role === "admin";
  const isReseller = session?.user.role === "client"; // "não-admin" (nome legado)
  const [deleteTarget, setDeleteTarget] = useState<License | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Papel real no banco: distingue "reseller" de cliente-comum dentro do grupo não-admin.
  const { data: realRoleData } = useQuery({
    queryKey: ["licenses-real-role", sessionKey],
    enabled: authReady && !!session && !isAdmin,
    staleTime: 30_000,
    queryFn: async () => {
      if (!session?.user.id) return { role: null as string | null };
      const { data } = await supabase
        .from("hyro_extension_users")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();
      return { role: ((data as any)?.role ?? null) as string | null };
    },
  });
  const isRealReseller = realRoleData?.role === "reseller";
  // Gates de UI: só admin edita/exclui/altera perms/suspende/reativa.
  // "Nova licença" e "Link personalizado" também para revendedor real.
  const canCreate = isAdmin || isRealReseller;
  const canLink = isAdmin || isRealReseller;
  const canDelete = isAdmin;



  const { data, isLoading, refetch, isFetching, error } = useQuery({
    queryKey: ["licenses", sessionKey, search, status, page],
    enabled: authReady && !!session,
    staleTime: 15_000,
    // Realtime já invalida; polling é apenas fallback.
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,

    queryFn: async () => {
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

      if (isReseller) {
        if (!session?.user.id) return { rows: [], count: 0 };
        const { data: currentUser, error: currentUserError } = await supabase
          .from("hyro_extension_users")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();
        if (currentUserError) throw currentUserError;
        const realRole = (currentUser as any)?.role;
        query = realRole === "reseller"
          ? query.or(`created_by.eq.${session.user.id},reseller_id.eq.${session.user.id}`)
          : query.eq("user_id", session.user.id);
      }

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
    if (isReseller) {
      toast.error("Revendedor não pode suspender ou reativar licenças.");
      return;
    }
    const next = l.status === "ativa" ? "inativa" : "ativa";
    const { error } = await supabase
      .from("hyro_extension_licenses")
      .update({ status: next })
      .eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success(`Licença ${next === "ativa" ? "reativada" : "suspensa"}`);
    qc.invalidateQueries({ queryKey: ["licenses"] });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (!canDelete) {
      toast.error("Somente administradores podem excluir licenças.");
      setDeleteTarget(null);
      return;
    }
    setDeleting(true);
    try {
      const { error } = await supabase.from("hyro_extension_licenses").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success("Licença excluída");
      qc.invalidateQueries({ queryKey: ["licenses"] });
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao excluir");
    } finally {
      setDeleting(false);
    }
  };



  const copyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedId(key);
    setTimeout(() => setCopiedId((c) => (c === key ? null : c)), 1600);
  };

  const isLifetime = (d: string) => new Date(d).getUTCFullYear() >= 2090;

  // Periodic sweep to auto-remove expired test licenses in near real-time.
  useEffect(() => {
    if (!session || isReseller) return;
    // run once on mount
    sweepExpiredTestLicenses().then(() => {
      qc.invalidateQueries({ queryKey: ["licenses"] });
    });
    const t = setInterval(() => {
      sweepExpiredTestLicenses().then(() => {
        qc.invalidateQueries({ queryKey: ["licenses"] });
        qc.invalidateQueries({ queryKey: ["dash-stats"] });
      });
    }, 60_000);
    return () => clearInterval(t);
  }, [qc, session?.user.id, isReseller]);



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start md:items-end justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-[20px] md:text-[22px] font-semibold tracking-tight leading-tight">Licenças</h1>
          <p className="text-[12.5px] md:text-[13px] text-muted-foreground mt-1">
            Gerencie chaves de licença associadas aos usuários da extensão.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRevealAll((v) => !v)}
            className="h-9"
            title={revealAll ? "Ocultar todas as chaves" : "Revelar todas as chaves"}
          >
            {revealAll ? <EyeOff className="h-3.5 w-3.5 md:mr-1.5" /> : <Eye className="h-3.5 w-3.5 md:mr-1.5" />}
            <span className="hidden md:inline">{revealAll ? "Ocultar chaves" : "Revelar chaves"}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 md:mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">Atualizar</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => setTestOpen(true)}
            disabled={isReseller}
            title={isReseller ? "Somente administradores podem gerar testes" : undefined}
          >
            <FlaskConical className="h-3.5 w-3.5 md:mr-1.5" />
            <span className="hidden md:inline">Gerar teste</span>
          </Button>
          {canCreate && (
            <Button size="sm" className="h-9" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova licença
            </Button>
          )}

        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
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
        <div className="overflow-x-auto">
        <Table className="min-w-[720px]">

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
                    {canCreate && (
                      <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Criar primeira licença
                      </Button>
                    )}

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
                      {(() => {
                        const isRevealed = revealAll || !!revealed[l.id];
                        return (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => copyKey(l.id)}
                              className={[
                                "group inline-flex items-center gap-2 font-mono text-[12.5px] text-foreground/90 hover:text-foreground rounded px-1.5 py-0.5 -ml-1.5 transition-all",
                                isRevealed ? "" : "select-none blur-[5px] hover:blur-[3px]",
                              ].join(" ")}
                              title={isRevealed ? "Copiar chave" : "Revele para copiar"}
                            >
                              <span className="tracking-wider">{l.id}</span>
                              {copiedId === l.id ? (
                                <Check className="h-3.5 w-3.5 text-success" />
                              ) : (
                                <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              )}
                            </button>
                            <button
                              onClick={() =>
                                setRevealed((r) => ({ ...r, [l.id]: !r[l.id] }))
                              }
                              className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center shrink-0"
                              title={isRevealed ? "Ocultar" : "Revelar"}
                              aria-label={isRevealed ? "Ocultar chave" : "Revelar chave"}
                            >
                              {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-[13px]" title={l.user_email ?? ""}>{l.user_email ? maskEmail(l.user_email) : "—"}</TableCell>
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
                        {canLink && (
                          <IconAction label="Link personalizado" onClick={() => setLinkFor(l)}>
                            <Link2 className="h-3.5 w-3.5" />
                          </IconAction>
                        )}
                        <IconAction
                          label={isReseller ? "Somente administradores podem alterar permissões" : "Permissões"}
                          onClick={() => setPermsFor(l)}
                          disabled={isReseller}
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </IconAction>
                        <IconAction
                          label={isReseller ? "Revendedor não pode editar licenças" : "Editar"}
                          onClick={() => setEditing(l)}
                          disabled={isReseller}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </IconAction>
                        <IconAction
                          label={isReseller ? "Revendedor não pode suspender ou reativar" : l.status === "ativa" ? "Suspender" : "Reativar"}
                          onClick={() => toggleStatus(l)}
                          disabled={isReseller}
                        >
                          {l.status === "ativa" ? (
                            <Ban className="h-3.5 w-3.5" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                        </IconAction>
                        {canDelete && (
                          <IconAction label="Excluir" onClick={() => setDeleteTarget(l)} danger>
                            <Trash2 className="h-3.5 w-3.5" />
                          </IconAction>
                        )}

                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>



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
      <TestLicenseDialog open={testOpen} onOpenChange={setTestOpen} />
      <EditLicenseDialog license={editing} onClose={() => setEditing(null)} />
      <PermissionsDialog
        licenseId={permsFor?.id ?? null}
        licenseEmail={permsFor?.user_email ?? null}
        open={!!permsFor}
        onOpenChange={(o) => !o && setPermsFor(null)}
      />
      <RedemptionLinkDialog
        licenseId={linkFor?.id ?? null}
        licenseEmail={linkFor?.user_email ?? null}
        createdBy={session?.user.email ?? ""}
        open={!!linkFor}
        onOpenChange={(o) => !o && setLinkFor(null)}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir licença?</AlertDialogTitle>
            <AlertDialogDescription>
              A chave <span className="font-mono text-foreground">{deleteTarget?.id}</span>
              {deleteTarget?.user_email ? <> vinculada a <span className="text-foreground">{maskEmail(deleteTarget.user_email)}</span></> : null}
              {" "}será removida permanentemente. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Excluir licença
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  children, onClick, label, danger, disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={[
        "h-8 w-8 rounded-md flex items-center justify-center transition-colors",
        disabled
          ? "text-muted-foreground/40 cursor-not-allowed"
          : ["text-muted-foreground hover:bg-muted", danger ? "hover:text-destructive" : "hover:text-foreground"].join(" "),
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
  const { session } = useAuth();
  const isReseller = session?.user.role === "client";
  const [mode, setMode] = useState<"normal" | "personalizado" | "avulsa">("normal");
  const [email, setEmail] = useState("");
  const [days, setDays] = useState("30");
  const [lifetime, setLifetime] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [previewKey, setPreviewKey] = useState<string>(generateLicenseKey());
  const [created, setCreated] = useState<{
    key: string;
    email: string;
    password: string;
    expiresAt: Date;
    lifetime: boolean;
    redemptionUrl?: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setPreviewKey(generateLicenseKey());
      setPassword("");
      setCreated(null);
      setMode("normal");
    }
  }, [open]);

  const submit = async () => {
    const emailNorm = email.trim().toLowerCase();
    if (mode !== "avulsa" && !emailNorm) {
      toast.error("Informe um e-mail.");
      return;
    }
    if (mode === "normal" && password && password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    setSubmitting(true);
    try {
      if (session?.user.role === "client") {
        const available = await getResellerBalance(session.user.id);
        if (available <= 0) {
          toast.error("Sem licenças disponíveis. Adicione créditos ao revendedor antes de criar.");
          setSubmitting(false);
          return;
        }
      }

      // Revenda é sempre 30 dias, sem vitalícia. Só o admin pode customizar.
      const effectiveLifetime = isReseller ? false : lifetime;
      const effectiveDays = isReseller ? 30 : parseInt(days || "30");
      const expiresAt = effectiveLifetime
        ? new Date("2099-12-31T23:59:59Z")
        : new Date(Date.now() + effectiveDays * 24 * 3600 * 1000);
      const key = previewKey;

      if (mode === "avulsa") {
        // Licença sem email/senha: cria placeholder user sintético e vincula.
        const syntheticEmail = `avulsa-${key.toLowerCase()}@hyro.local`;
        const { data: newUser, error: nuErr } = await supabase
          .from("hyro_extension_users")
          .insert({
            email: syntheticEmail,
            name: `Avulsa ${key}`,
            role: "user",
            password_hash: "",
            active: false,
          })
          .select("id")
          .single();
        if (nuErr) throw nuErr;
        const placeholderUserId = newUser.id;

        const { error } = await supabase.from("hyro_extension_licenses").insert({
          id: key,
          user_id: placeholderUserId,
          status: "ativa",
          expires_at: expiresAt.toISOString(),
          created_by: session?.user.role === "client" ? session.user.id : null,
          reseller_id: session?.user.role === "client" ? session.user.id : null,
        });
        if (error) {
          await supabase.from("hyro_extension_users").delete().eq("id", placeholderUserId);
          throw error;
        }

        try {
          if (session?.user.role === "client") {
            await consumeResellerLicenseCredit(session.user.id);
          }
        } catch (creditError) {
          await supabase.from("hyro_extension_licenses").delete().eq("id", key);
          await supabase.from("hyro_extension_users").delete().eq("id", placeholderUserId);
          throw creditError;
        }

        toast.success("Licença avulsa criada", { description: key });
        qc.invalidateQueries({ queryKey: ["licenses"] });
        qc.invalidateQueries({ queryKey: ["dash-stats"] });
        qc.invalidateQueries({ queryKey: ["reseller-balance"] });
        setCreated({
          key,
          email: "",
          password: "",
          expiresAt,
          lifetime: effectiveLifetime,
        });
      } else if (mode === "personalizado") {
        // Cria (ou reusa) um usuário placeholder com o e-mail alvo (sem senha).
        // O signup via /r/:slug preencherá a senha e ativará a conta.
        let placeholderUserId: string;
        let createdPlaceholder = false;
        const { data: existingUser, error: euErr } = await supabase
          .from("hyro_extension_users")
          .select("id, password_hash")
          .eq("email", emailNorm)
          .maybeSingle();
        if (euErr) throw euErr;

        if (existingUser) {
          placeholderUserId = existingUser.id;
        } else {
          const { data: newUser, error: nuErr } = await supabase
            .from("hyro_extension_users")
            .insert({
              email: emailNorm,
              name: emailNorm.split("@")[0],
              role: "user",
              password_hash: "",
              active: false,
            })
            .select("id")
            .single();
          if (nuErr) throw nuErr;
          placeholderUserId = newUser.id;
          createdPlaceholder = true;
        }

        const { error } = await supabase.from("hyro_extension_licenses").insert({
          id: key,
          user_id: placeholderUserId,
          status: "ativa",
          expires_at: expiresAt.toISOString(),
          created_by: session?.user.role === "client" ? session.user.id : null,
          reseller_id: session?.user.role === "client" ? session.user.id : null,
        });
        if (error) throw error;

        try {
          if (session?.user.role === "client") {
            await consumeResellerLicenseCredit(session.user.id);
          }
        } catch (creditError) {
          await supabase.from("hyro_extension_licenses").delete().eq("id", key);
          if (createdPlaceholder) {
            await supabase.from("hyro_extension_users").delete().eq("id", placeholderUserId);
          }
          throw creditError;
        }

        const link = await createRedemptionLink({
          license_id: key,
          target_email: emailNorm,
          created_by: session?.user.email ?? OWNER_EMAIL,
        });
        const url = `https://hyrolovable.lovable.app/r/${link.slug}`;

        toast.success("Licença + link personalizado criados");
        qc.invalidateQueries({ queryKey: ["licenses"] });
        qc.invalidateQueries({ queryKey: ["dash-stats"] });
        qc.invalidateQueries({ queryKey: ["reseller-balance"] });
        setCreated({
          key,
          email: emailNorm,
          password: "",
          expiresAt,
          lifetime,
          redemptionUrl: url,
        });
      } else {
        const passwordHash = password ? await sha256Hex(password) : null;

        // 1) Buscar ou criar usuário em hyro_extension_users
        let userId: string | null = null;
        let createdUserNow = false;
        const { data: existing, error: uerr } = await supabase
          .from("hyro_extension_users")
          .select("id, password_hash")
          .eq("email", emailNorm)
          .maybeSingle();
        if (uerr) throw uerr;

        if (existing) {
          userId = existing.id;
          if (passwordHash) {
            await supabase
              .from("hyro_extension_users")
              .update({ password_hash: passwordHash, active: true })
              .eq("id", userId);
          }
        } else {
          const { data: createdUser, error: cerr } = await supabase
            .from("hyro_extension_users")
            .insert({
              email: emailNorm,
              name: emailNorm.split("@")[0],
              role: "user",
              password_hash: passwordHash ?? "",
              active: true,
            })
            .select("id")
            .single();
          if (cerr) throw cerr;
          userId = createdUser.id;
          createdUserNow = true;
        }

        const { error } = await supabase.from("hyro_extension_licenses").insert({
          id: key,
          user_id: userId,
          status: "ativa",
          expires_at: expiresAt.toISOString(),
          created_by: session?.user.role === "client" ? session.user.id : null,
          reseller_id: session?.user.role === "client" ? session.user.id : null,
        });
        if (error) throw error;
        try {
          if (session?.user.role === "client") {
            await consumeResellerLicenseCredit(session.user.id);
          }
        } catch (creditError) {
          await supabase.from("hyro_extension_licenses").delete().eq("id", key);
          if (createdUserNow && userId) {
            await supabase.from("hyro_extension_users").delete().eq("id", userId);
          }
          throw creditError;
        }
        toast.success("Licença criada", { description: key });
        qc.invalidateQueries({ queryKey: ["licenses"] });
        qc.invalidateQueries({ queryKey: ["dash-stats"] });
        qc.invalidateQueries({ queryKey: ["reseller-balance"] });
        setCreated({
          key,
          email: emailNorm,
          password: password || "",
          expiresAt,
          lifetime,
        });
      }

      setEmail("");
      setDays("30");
      setLifetime(false);
      setPassword("");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar");
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel border-0 sm:max-w-[520px] p-0 overflow-hidden">
        {created ? (
          <LicenseCreatedSuccess
            data={created}
            onClose={() => {
              setCreated(null);
              onOpenChange(false);
            }}
            onCreateAnother={() => {
              setCreated(null);
              setPreviewKey(generateLicenseKey());
            }}
          />
        ) : (
          <>
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
              {/* Mode selector */}
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                  Tipo de licença
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: "normal", title: "Normal", desc: "Vincula direto a um usuário existente." },
                    { id: "personalizado", title: "Personalizado", desc: "Gera link de resgate travado por IP." },
                    { id: "avulsa", title: "Avulsa", desc: "Só a chave, sem e-mail nem senha." },
                  ] as const).map((opt) => {
                    const active = mode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setMode(opt.id)}
                        className={[
                          "text-left rounded-md border px-3 py-2.5 transition-colors",
                          active
                            ? "border-foreground bg-foreground/5"
                            : "border-border hover:border-foreground/40 hover:bg-muted/40",
                        ].join(" ")}
                      >
                        <div className="flex items-center gap-1.5 text-[12.5px] font-medium">
                          {opt.id === "personalizado" ? <Link2 className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
                          {opt.title}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

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

              {/* Email — não usado no modo Avulsa */}
              {mode !== "avulsa" && (
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                    {mode === "personalizado" ? "E-mail destino do link" : "E-mail do usuário"}
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
                  {mode === "personalizado" && (
                    <p className="text-[11px] text-muted-foreground">
                      A pessoa só precisará digitar nome, sobrenome e senha. O e-mail já vem preenchido e travado.
                    </p>
                  )}
                </div>
              )}

              {mode === "avulsa" && (
                <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2.5 text-[12px] text-muted-foreground">
                  Nenhum dado do cliente é necessário. A chave é criada isolada — você entrega a chave e depois vincula a um usuário se quiser.
                </div>
              )}

              {/* Duration */}
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                  Duração
                </Label>
                {isReseller ? (
                  <div className="rounded-md border border-border bg-muted/40 px-3 h-10 flex items-center gap-2">
                    <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[13px] font-medium">30 dias</span>
                    <span className="text-[11px] text-muted-foreground ml-auto">Fixo para revenda</span>
                  </div>
                ) : (
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
                )}
              </div>

              {/* Painel access password — só no modo Normal */}
              {mode === "normal" && (
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                    Senha de acesso ao painel <span className="text-muted-foreground/70 normal-case tracking-normal">(opcional)</span>
                  </Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mín. 6 caracteres — deixe em branco para não permitir login"
                    className="h-10 text-[13px]"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Com senha definida, o cliente pode logar em <span className="font-mono">/login</span> e acompanhar sua assinatura.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="px-6 py-4 border-t border-border/60 bg-muted/30 gap-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={submit} disabled={submitting || (mode !== "avulsa" && !email)}>
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Criar licença
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LicenseCreatedSuccess({
  data,
  onClose,
  onCreateAnother,
}: {
  data: {
    key: string;
    email: string;
    password: string;
    expiresAt: Date;
    lifetime: boolean;
    redemptionUrl?: string;
  };
  onClose: () => void;
  onCreateAnother: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const panelUrl = "https://hyrolovable.lovable.app";
  const isPerso = !!data.redemptionUrl;
  const validity = data.lifetime
    ? "Vitalícia (nunca expira)"
    : data.expiresAt.toLocaleDateString("pt-BR", {
        day: "2-digit", month: "long", year: "numeric",
      });

  const extensionUrl = panelUrl + "/upgrade";
  const warning = [
    "━━━━━━━━━━━━━━━━━━",
    "⚠️ *Aviso importante*",
    "Esta licença é *pessoal e intransferível*. É *proibido revender, ceder ou compartilhar*.",
    "Casos identificados de revenda resultam em *suspensão imediata sem reembolso*.",
  ];

  const message = isPerso
    ? [
        "🎉 *Sua licença Hyro Lovable está pronta!*",
        "",
        "Olá! Criamos um link exclusivo pra você resgatar sua licença. Só você poderá abrir — o link trava no seu IP no primeiro acesso.",
        "",
        "🔗 *Seu link de resgate*",
        data.redemptionUrl!,
        "",
        "📧 *E-mail de acesso*",
        data.email,
        "",
        "📅 *Validade*",
        validity,
        "",
        "📥 *Baixar a extensão*",
        extensionUrl,
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
        "_Obrigado por escolher a Hyro Lovable! 🚀_",
      ].join("\n")
    : data.email
    ? [
        "🎉 *Sua licença Hyro Lovable está pronta!*",
        "",
        "Olá! Sua licença foi ativada com sucesso. Guarde estes dados em local seguro:",
        "",
        "🔑 *Chave de licença*",
        `\`${data.key}\``,
        "",
        "📧 *E-mail de acesso*",
        data.email,
        ...(data.password ? ["", "🔒 *Senha do painel*", data.password] : []),
        "",
        "📅 *Validade*",
        validity,
        "",
        "🌐 *Acesse o painel*",
        panelUrl,
        "",
        "📥 *Baixar a extensão*",
        extensionUrl,
        "",
        "━━━━━━━━━━━━━━━━━━",
        "*Como começar:*",
        "1️⃣ Acesse o painel pelo link acima",
        ...(data.password
          ? ["2️⃣ Faça login com o e-mail e senha enviados"]
          : ["2️⃣ Solicite sua senha de acesso pelo suporte"]),
        "3️⃣ Baixe e instale a extensão pelo link de download",
        "4️⃣ Ative com sua chave de licença",
        "",
        ...warning,
        "",
        "_Obrigado por escolher a Hyro Lovable! 🚀_",
      ].join("\n")
    : [
        "🎉 *Sua licença Hyro Lovable está pronta!*",
        "",
        "Guarde a chave abaixo em local seguro:",
        "",
        "🔑 *Chave de licença*",
        `\`${data.key}\``,
        "",
        "📅 *Validade*",
        validity,
        "",
        "📥 *Baixar a extensão*",
        extensionUrl,
        "",
        ...warning,
        "",
        "_Obrigado por escolher a Hyro Lovable! 🚀_",
      ].join("\n");


  const copy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    toast.success("Mensagem copiada");
    setTimeout(() => setCopied(false), 2000);
  };
  const copyLink = async () => {
    if (!data.redemptionUrl) return;
    await navigator.clipboard.writeText(data.redemptionUrl);
    setCopiedLink(true);
    toast.success("Link copiado");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const whatsUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <>
      <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <PartyPopper className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-[15px] font-semibold tracking-tight">
              {isPerso ? "Link personalizado gerado" : "Licença criada com sucesso"}
            </DialogTitle>
            <DialogDescription className="text-[12.5px] text-muted-foreground mt-0.5">
              Copie a mensagem abaixo e envie para o cliente pelo WhatsApp ou e-mail.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="px-6 py-5 space-y-4">
        {isPerso && data.redemptionUrl && (
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              Link de resgate (travado por IP no 1º acesso)
            </Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-md border border-border bg-muted/40 px-3 h-10 flex items-center font-mono text-[12px] truncate">
                {data.redemptionUrl}
              </div>
              <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={copyLink}>
                {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        )}

        {/* Quick facts */}
        <div className="grid grid-cols-2 gap-2">
          <FactCard label="Chave" value={data.key} mono />
          {data.email && <FactCard label="E-mail" value={data.email} />}
          {!isPerso && data.email && (
            <FactCard label="Senha" value={data.password || "— não definida —"} mono={!!data.password} />
          )}
          <FactCard label="Validade" value={validity} />
        </div>

        {/* Preview */}
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Mensagem pronta para envio
          </Label>
          <div className="rounded-md border border-border bg-muted/40 p-4 max-h-64 overflow-y-auto">
            <pre className="text-[12px] leading-relaxed text-foreground whitespace-pre-wrap font-sans">
              {message}
            </pre>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Formatação em Markdown do WhatsApp (*negrito*, `chave`) — cole direto no chat.
          </p>
        </div>
      </div>

      <DialogFooter className="px-6 py-4 border-t border-border/60 bg-muted/30 gap-2 flex-wrap sm:flex-nowrap">
        <Button variant="ghost" size="sm" onClick={onCreateAnother}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Criar outra
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? (
              <><Check className="h-3.5 w-3.5 mr-1.5" /> Copiado</>
            ) : (
              <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar mensagem</>
            )}
          </Button>
          <a
            href={whatsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-medium transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Enviar no WhatsApp
          </a>
          <Button size="sm" onClick={onClose}>Concluir</Button>
        </div>
      </DialogFooter>
    </>
  );
}

function FactCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-card p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </div>
      <div
        className={[
          "mt-1 text-[12.5px] text-foreground break-all",
          mono ? "font-mono tracking-wide" : "",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
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
  const { session } = useAuth();
  const isReseller = session?.user.role === "client";
  const [email, setEmail] = useState("");
  const [expires, setExpires] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (license) {
      setEmail(license.user_email ?? "");
      setExpires(license.expires_at.slice(0, 10));
      setPassword("");
      setShowPwd(false);
    }
  }, [license]);

  if (!license) return null;

  const save = async () => {
    if (password && password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    setSaving(true);
    try {
      let user_id = license.user_id;
      const emailNorm = email.trim().toLowerCase();
      if (emailNorm && emailNorm !== (license.user_email ?? "").toLowerCase()) {
        const { data: u, error } = await supabase
          .from("hyro_extension_users")
          .select("id")
          .eq("email", emailNorm)
          .maybeSingle();
        if (error) throw error;
        if (!u) {
          toast.error("Usuário não encontrado");
          setSaving(false);
          return;
        }
        user_id = u.id;
      }
      // Atualiza senha (se informada) no usuário vinculado
      if (password && user_id) {
        const passwordHash = await sha256Hex(password);
        const { error: pErr } = await supabase
          .from("hyro_extension_users")
          .update({ password_hash: passwordHash, active: true })
          .eq("id", user_id);
        if (pErr) throw pErr;
      }
      const updatePayload: Record<string, any> = { user_id };
      if (!isReseller) {
        updatePayload.expires_at = new Date(expires + "T23:59:59Z").toISOString();
      }
      const { error } = await supabase
        .from("hyro_extension_licenses")
        .update(updatePayload)
        .eq("id", license.id);
      if (error) throw error;
      toast.success(password ? "Licença atualizada e senha redefinida" : "Licença atualizada");
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
            {isReseller ? (
              <div className="rounded-md border border-border bg-muted/40 px-3 h-10 flex items-center gap-2 text-[13px] text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                {new Date(license.expires_at).toLocaleDateString("pt-BR")}
                <span className="text-[11px] ml-auto">Data fixa · 30 dias</span>
              </div>
            ) : (
              <Input
                type="date"
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
                className="h-10 text-[13px]"
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              Redefinir senha do painel <span className="text-muted-foreground/70 normal-case tracking-normal">(opcional)</span>
            </Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Deixe em branco para não alterar"
                className="h-10 pl-9 pr-10 text-[13px]"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Ao definir, a nova senha substitui a atual e a conta é reativada.
            </p>
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

function TestLicenseDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { session } = useAuth();
  const isOwner = session?.user.email?.toLowerCase() === OWNER_EMAIL;
  const [minutes, setMinutes] = useState<3 | 30 | 60>(30);
  const [submitting, setSubmitting] = useState(false);
  const [previewKey, setPreviewKey] = useState<string>(generateTestKey());

  useEffect(() => {
    if (open) {
      setPreviewKey(generateTestKey());
      setName("");
      setMinutes(30);
    }
  }, [open]);

  const trimmedName = name.trim();
  const nameValid =
    trimmedName.length >= 2 &&
    trimmedName.length <= 60 &&
    /^[\p{L}0-9][\p{L}0-9\s'.-]*$/u.test(trimmedName);

  const submit = async () => {
    if (!nameValid) {
      toast.error("Informe um nome válido (2–60 caracteres).");
      return;
    }
    setSubmitting(true);
    try {
      const email = generateTestEmail();
      const { data: created, error: cerr } = await supabase
        .from("hyro_extension_users")
        .insert({
          email,
          name: trimmedName,
          role: "user",
          password_hash: "",
          active: true,
        })
        .select("id")
        .single();
      if (cerr) throw cerr;
      const userId = created.id;

      const expiresAt = new Date(Date.now() + minutes * 60 * 1000);
      const key = previewKey;
      const { error } = await supabase.from("hyro_extension_licenses").insert({
        id: key,
        user_id: userId,
        status: "ativa",
        expires_at: expiresAt.toISOString(),
      });
      if (error) {
        // rollback user
        await supabase.from("hyro_extension_users").delete().eq("id", userId);
        throw error;
      }

      // Schedule client-side auto-deletion when the timer expires.
      const ms = expiresAt.getTime() - Date.now();
      setTimeout(async () => {
        await supabase.from("hyro_extension_licenses").delete().eq("id", key);
        await supabase.from("hyro_extension_users").delete().eq("id", userId);
        qc.invalidateQueries({ queryKey: ["licenses"] });
        qc.invalidateQueries({ queryKey: ["dash-stats"] });
        toast.message("Licença de teste expirada e removida", { description: key });
      }, ms + 1500);

      toast.success(`Licença de teste criada (${minutes} min)`, { description: key });
      qc.invalidateQueries({ queryKey: ["licenses"] });
      qc.invalidateQueries({ queryKey: ["dash-stats"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar licença de teste");
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
              <FlaskConical className="h-4 w-4" strokeWidth={2} />
            </div>
            <div>
              <DialogTitle className="text-[15px] font-semibold tracking-tight">
                Licença de teste
              </DialogTitle>
              <DialogDescription className="text-[12.5px] text-muted-foreground mt-0.5">
                Chave temporária com e-mail aleatório. Auto-exclui ao expirar.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5">
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
                onClick={() => setPreviewKey(generateTestKey())}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Prefixo <span className="font-mono">TST-</span> · e-mail gerado automaticamente
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              Nome do testador
            </Label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 60))}
                placeholder="Ex.: João Silva"
                maxLength={60}
                className="h-10 pl-9 text-[13px]"
              />
            </div>
            {name.length > 0 && !nameValid && (
              <p className="text-[11px] text-destructive">
                Use 2 a 60 caracteres (letras, números, espaços, . ' -).
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              Duração
            </Label>
            <div className={isOwner ? "grid grid-cols-3 gap-2" : "grid grid-cols-2 gap-2"}>
              {([3, 30, ...(isOwner ? [60] : [])] as const).map((m) => {
                const label = m === 60 ? "1 hora" : `${m} min`;
                const sub =
                  m === 3 ? "Teste rápido" : m === 30 ? "Teste estendido" : "Teste estendido (owner)";
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMinutes(m as 3 | 30 | 60)}
                    className={[
                      "rounded-md border px-3 py-2.5 text-left transition-colors",
                      minutes === m
                        ? "border-foreground bg-foreground/5"
                        : "border-border hover:bg-muted/40",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2 text-[13px] font-medium">
                      <Timer className="h-3.5 w-3.5" />
                      {label}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/60 bg-muted/30 gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={submit} disabled={submitting || !nameValid}>
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Gerar teste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
