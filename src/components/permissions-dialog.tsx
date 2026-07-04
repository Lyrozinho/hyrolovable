import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, ShieldCheck, Users, Sparkles, GraduationCap, Infinity as InfinityIcon } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_PERMS,
  fetchLicensePerms,
  saveLicensePerms,
  type LicensePerms,
  type MenuKey,
} from "@/lib/permissions";

const MENU_OPTIONS: { key: MenuKey; label: string; icon: typeof Users }[] = [
  { key: "licenses", label: "Licenças", icon: ShieldCheck },
  { key: "resellers", label: "Revendedores", icon: Users },
  { key: "subscription", label: "Assinatura", icon: Sparkles },
  { key: "tutorials", label: "Tutoriais", icon: GraduationCap },
];

export function PermissionsDialog({
  licenseId,
  licenseEmail,
  open,
  onOpenChange,
}: {
  licenseId: string | null;
  licenseEmail?: string | null;
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  const [perms, setPerms] = useState<LicensePerms>(DEFAULT_PERMS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !licenseId) return;
    setLoading(true);
    fetchLicensePerms(licenseId)
      .then(setPerms)
      .finally(() => setLoading(false));
  }, [open, licenseId]);

  const toggle = (scope: "owner" | "resellers", key: MenuKey) =>
    setPerms((p) => ({ ...p, [scope]: { ...p[scope], [key]: !p[scope][key] } }));

  const save = async () => {
    if (!licenseId) return;
    setSaving(true);
    try {
      await saveLicensePerms(licenseId, perms);
      toast.success("Permissões atualizadas");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-md bg-foreground text-background flex items-center justify-center shrink-0">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-[15px] font-semibold tracking-tight">Permissões da licença</DialogTitle>
              <DialogDescription className="text-[12.5px] text-muted-foreground mt-0.5 truncate">
                {licenseEmail ?? licenseId ?? "—"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-10 flex items-center justify-center text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando...
          </div>
        ) : (
          <div className="px-6 py-5 space-y-6 max-h-[65vh] overflow-y-auto">
            {/* Pacote de licenças */}
            <section className="space-y-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Pacote de revendas
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Slots disponíveis para revender</Label>
                  <Input
                    type="number" min={0}
                    value={perms.package_slots}
                    disabled={perms.unlimited}
                    onChange={(e) => setPerms((p) => ({ ...p, package_slots: Math.max(0, parseInt(e.target.value) || 0) }))}
                    className="h-9 text-[13px]"
                  />
                </div>
                <label className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-muted/40 text-[12px] cursor-pointer">
                  <InfinityIcon className="h-3.5 w-3.5" />
                  Ilimitado
                  <Switch
                    checked={perms.unlimited}
                    onCheckedChange={(v) => setPerms((p) => ({ ...p, unlimited: !!v }))}
                  />
                </label>
              </div>
            </section>

            <PermSection
              title="Abas visíveis para o dono da licença"
              perms={perms.owner}
              onToggle={(k) => toggle("owner", k)}
            />
            <PermSection
              title="Abas visíveis para revendedores criados por ele"
              perms={perms.resellers}
              onToggle={(k) => toggle("resellers", k)}
            />
          </div>
        )}

        <DialogFooter className="px-6 py-4 border-t border-border/60 bg-muted/30 gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={save} disabled={saving || loading || !licenseId}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Salvar permissões
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PermSection({
  title,
  perms,
  onToggle,
}: {
  title: string;
  perms: { licenses: boolean; resellers: boolean; subscription: boolean; tutorials: boolean };
  onToggle: (key: MenuKey) => void;
}) {
  return (
    <section className="space-y-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{title}</div>
      <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
        {MENU_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const checked = !!perms[opt.key];
          return (
            <label key={opt.key} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 cursor-pointer">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-[13px]">{opt.label}</span>
              <Switch checked={checked} onCheckedChange={() => onToggle(opt.key)} />
            </label>
          );
        })}
      </div>
    </section>
  );
}
