import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Plus, Pencil, Ban, CheckCircle2, Trash2, Search, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
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

function LicensesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<License | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["licenses", search, status, page],
    queryFn: async () => {
      // Fetch licenses joined with users via user_id
      let query = supabase
        .from("hyro_extension_licenses")
        .select("id, user_id, status, expires_at, created_at, hyro_extension_users(email)", {
          count: "exact",
        })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (status !== "all") query = query.eq("status", status);
      if (search.trim()) query = query.ilike("id", `%${search.trim()}%`);

      const { data, error, count } = await query;
      if (error) throw error;
      const rows: License[] = (data ?? []).map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        status: r.status,
        expires_at: r.expires_at,
        created_at: r.created_at,
        user_email: r.hyro_extension_users?.email ?? null,
      }));
      return { rows, count: count ?? 0 };
    },
  });

  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));

  const filtered = useMemo(() => {
    if (!search.trim()) return data?.rows ?? [];
    const q = search.trim().toLowerCase();
    return (data?.rows ?? []).filter(
      (r) => r.id.toLowerCase().includes(q) || (r.user_email ?? "").toLowerCase().includes(q),
    );
  }, [data, search]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Licenças</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie chaves de licença dos usuários.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova licença
        </Button>
      </div>

      <Card className="p-4 border-border/60">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por chave ou e-mail..."
              value={search}
              onChange={(e) => {
                setPage(0);
                setSearch(e.target.value);
              }}
              className="pl-9"
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setPage(0);
              setStatus(v);
            }}
          >
            <SelectTrigger className="w-44">
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
      </Card>

      <Card className="border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chave</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expira em</TableHead>
              <TableHead>Criada em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  Nenhuma licença encontrada
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((l) => {
                const expired = new Date(l.expires_at) < new Date();
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">{l.id.slice(0, 18)}…</TableCell>
                    <TableCell>{l.user_email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          expired ? "destructive" : l.status === "ativa" ? "default" : "secondary"
                        }
                      >
                        {expired ? "expirada" : l.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(l.expires_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(l.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(l)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => toggleStatus(l)}>
                        {l.status === "ativa" ? (
                          <Ban className="h-4 w-4" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => remove(l)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between px-4 py-3 border-t border-border/60 text-sm">
          <div className="text-muted-foreground">
            Total: {data?.count ?? 0} · Página {page + 1} de {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      </Card>

      <CreateLicenseDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditLicenseDialog license={editing} onClose={() => setEditing(null)} />
    </div>
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

  const submit = async () => {
    setSubmitting(true);
    try {
      // Look up user
      const { data: user, error: uerr } = await supabase
        .from("hyro_extension_users")
        .select("id")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();
      if (uerr) throw uerr;
      if (!user) {
        toast.error("Usuário não encontrado. Cadastre-o primeiro em hyro_extension_users.");
        return;
      }

      const expiresAt = lifetime
        ? new Date("2099-12-31T23:59:59Z")
        : new Date(Date.now() + parseInt(days) * 24 * 3600 * 1000);

      const id = crypto.randomUUID();
      const { error } = await supabase.from("hyro_extension_licenses").insert({
        id,
        user_id: user.id,
        status: "ativa",
        expires_at: expiresAt.toISOString(),
      });
      if (error) throw error;
      toast.success("Licença criada");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova licença</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>E-mail do usuário</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@exemplo.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Duração (dias)</Label>
            <Input
              type="number"
              min={1}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              disabled={lifetime}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={lifetime}
              onChange={(e) => setLifetime(e.target.checked)}
              className="h-4 w-4"
            />
            Ilimitado / Lifetime (expira em 2099)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={submitting || !email}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
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

  useMemo(() => {
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar licença</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Chave</Label>
            <Input value={license.id} disabled className="font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <Label>E-mail do usuário</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Expira em</Label>
            <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
