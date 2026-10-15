import { Badge } from "@/components/ui/badge";
import { DOC_STATUS, type DocStatus } from "@/lib/documents/types";

const TONE = { muted: "muted", success: "success", danger: "danger" } as const;

export function DocStatusBadge({ status }: { status: string }) {
  const s = DOC_STATUS[status as DocStatus];
  if (!s) return <Badge variant="outline">{status}</Badge>;
  return <Badge variant={TONE[s.tone]}>{s.label}</Badge>;
}

const E_STATUS: Record<string, { label: string; variant: "muted" | "info" | "success" | "danger" | "warning" }> = {
  gonderiliyor: { label: "Gönderiliyor", variant: "warning" },
  gonderildi: { label: "Gönderildi", variant: "info" },
  kabul: { label: "Alıcı kabul etti", variant: "success" },
  ret: { label: "Reddedildi", variant: "danger" },
};

export function EStatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="muted">Gönderilmedi</Badge>;
  const s = E_STATUS[status] ?? { label: status, variant: "muted" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
