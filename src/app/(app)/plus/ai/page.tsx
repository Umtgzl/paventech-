import { FileScan, Upload } from "lucide-react";
import { suspensePage } from "@/components/page/suspense-page";
import { AssistantChat } from "@/components/plus/assistant-chat";
import { PlusHeader } from "@/components/plus/plus-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireModule } from "@/server/session";

export default suspensePage(async function AiPage() {
  await requireModule("ai");
  return (
    <>
      <PlusHeader
        module="AI Asistan"
        title="AI Asistan"
        description="İşletmenize Türkçe soru sorun; cevap gerçek verinizden, tablo olarak gelsin."
        note="Sorular şimdilik tanımlı raporlara anahtar kelimeyle eşlenir. Canlı sürümde dil modeli soruyu yorumlayacak ama yine yalnızca bu tanımlı raporları çağırabilecek: ham SQL yazmaz, şirket verisi izolasyonu korunur."
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <AssistantChat />
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileScan className="size-4 text-plus" /> Belge okuma
              <Badge variant="muted">Sıradaki adım</Badge>
            </CardTitle>
            <CardDescription>
              Kâğıt fatura, irsaliye veya masraf fişinin fotoğrafını/PDF&apos;ini bırakın; kalemler, tutarlar ve KDV okunup taslak belgeye dönüşsün.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              <Upload className="size-6" />
              PDF veya fotoğraf sürükleyin
              <span className="text-xs">e-Faturalar zaten yapılandırılmış geldiği için OCR gerekmez; onlar Gelen e-Faturalar ekranında eşleşir.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
});
