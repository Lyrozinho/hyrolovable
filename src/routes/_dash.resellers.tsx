import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Loader2, Coins } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/_dash/resellers")({
  component: ResellersPage,
});

type Reseller = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  active: boolean;
  created_at: string;
  balance?: number;
};

function ResellersPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [balanceTarget, setBalanceTarget] = useState<Reseller | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["resellers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hyro_extension_users")
        .select("id, email, name, role, active, created_at, hyro_reseller_balances(balance)")
        .eq("role", "reseller")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        balance: r.hyro_reseller_balances?.[0]?.balance ?? 0,
      })) as Reseller[];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Revendedores</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie contas de revenda e saldo de licenças.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo revendedor
        </Button>
      </div>

      <Card className="border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Saldo de licenças</TableHead>
              <TableHead>Criado em</TableHead>
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
            ) : (data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  Nenhum revendedor cadastrado
                </TableCell>
              </TableRow>
            ) : (
              data!.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name ?? "—"}</TableCell>
                  <TableCell>{r.email}</TableCell>
                  <TableCell>
                    <Badge variant={r.active ? "default" : "secondary"}>
                      {r.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{r.balance ?? 0}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setBalanceTarget(r)}>
                      <Coins className="h-4 w-4 mr-1" /> Ajustar saldo
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <CreateResellerDialog open={createOpen} onOpenChange={setCreateOpen} />
      <AdjustBalanceDialog reseller={balanceTarget} onClose={() => setBalanceTarget(null)} />
    </div>
  );
}

function CreateResellerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [balance, setBalance] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("admin_create_reseller", {
        p_email: email.trim().toLowerCase(),
        p_name: name,
        p_password: password,
        p_initial_balance: parseInt(balance) || 0,
      });
      if (error) throw error;
      toast.success("Revendedor criado");
      qc.invalidateQueries({ queryKey: ["resellers"] });
      qc.invalidateQueries({ queryKey: ["dash-stats"] });
      onOpenChange(false);
      setEmail("");
      setName("");
      setPassword("");
      setBalance("0");
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
          <DialogTitle>Novo revendedor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Senha</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha inicial"
            />
          </div>
          <div className="space-y-2">
            <Label>Saldo inicial de licenças</Label>
            <Input
              type="number"
              min={0}
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={submitting || !email || !password}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustBalanceDialog({
  reseller,
  onClose,
}: {
  reseller: Reseller | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [delta, setDelta] = useState("0");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (!reseller) return null;

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc("admin_adjust_reseller_balance", {
        p_reseller_id: reseller.id,
        p_delta: parseInt(delta) || 0,
        p_note: note || null,
      });
      if (error) throw error;
      toast.success("Saldo atualizado");
      qc.invalidateQueries({ queryKey: ["resellers"] });
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!reseller} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar saldo — {reseller.email}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Saldo atual: <span className="font-mono">{reseller.balance ?? 0}</span>
          </div>
          <div className="space-y-2">
            <Label>Variação (use valores negativos para debitar)</Label>
            <Input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Observação (opcional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
