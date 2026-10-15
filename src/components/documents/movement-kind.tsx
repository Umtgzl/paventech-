import { Badge } from "@/components/ui/badge";

const KIND: Record<string, { label: string; variant: "success" | "warning" | "info" | "muted" | "danger" | "secondary" }> = {
  giris: { label: "Giriş", variant: "success" },
  cikis: { label: "Çıkış", variant: "warning" },
  transfer: { label: "Transfer", variant: "info" },
  uretim: { label: "Üretim", variant: "secondary" },
  acilis: { label: "Açılış", variant: "muted" },
  iptal: { label: "İptal (ters kayıt)", variant: "danger" },
};

export function MovementKindBadge({ kind }: { kind: string }) {
  const k = KIND[kind] ?? { label: kind, variant: "muted" as const };
  return <Badge variant={k.variant}>{k.label}</Badge>;
}
