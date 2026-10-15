"use client";

import { Loader2, RefreshCw, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAction } from "@/hooks/use-action";
import { refreshEDocumentStatusAction, sendEDocumentAction } from "@/server/plus/edonusum-actions";
import { EStatusBadge } from "./status-badge";

export function EDocumentPanel({ documentId, status, kind }: { documentId: string; status: string | null; kind: string }) {
  const send = useAction();
  const check = useAction();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {kind}
          <Badge variant="plus">PLUS</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Durum</span>
          <EStatusBadge status={status} />
        </div>
        {(!status || status === "ret") && (
          <Button disabled={send.pending} onClick={() => send.run(() => sendEDocumentAction(documentId))}>
            {send.pending ? <Loader2 className="animate-spin" /> : <Send />}
            Entegratöre gönder
          </Button>
        )}
        {status === "gonderildi" && (
          <Button variant="outline" disabled={check.pending} onClick={() => check.run(() => refreshEDocumentStatusAction(documentId))}>
            {check.pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Durumu sorgula
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          Prototip: gönderim simüle edilir. Canlıda UBL-TR XML üretilip özel entegratör API&apos;si üzerinden GİB&apos;e iletilecek.
        </p>
      </CardContent>
    </Card>
  );
}
