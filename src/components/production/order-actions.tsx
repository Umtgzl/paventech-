"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Play } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { completeProductionAction, startProductionAction } from "@/server/production/actions";

export function ProductionOrderActions({ id, status, hasShortage }: { id: string; status: string; hasShortage: boolean }) {
  const router = useRouter();
  const start = useAction();
  const complete = useAction();
  if (status === "tamamlandi" || status === "iptal") return null;
  return (
    <>
      {status === "planlandi" && (
        <Button
          variant="outline"
          disabled={start.pending}
          onClick={() => start.run(() => startProductionAction(id), { onSuccess: () => router.refresh() })}
        >
          {start.pending ? <Loader2 className="animate-spin" /> : <Play />}
          Üretime al
        </Button>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button disabled={complete.pending}>
            {complete.pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            Üretimi tamamla
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Üretim tamamlansın mı?</AlertDialogTitle>
            <AlertDialogDescription>
              Reçetedeki bileşenler fire dahil stoktan düşülecek, mamul gerçekleşen maliyetle stoğa girecek.
              {hasShortage && " Bazı bileşenlerde stok yetersiz; devam ederseniz bu bileşenler eksi stoğa düşer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={() => complete.run(() => completeProductionAction(id), { onSuccess: () => router.refresh() })}>
              Tamamla
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
