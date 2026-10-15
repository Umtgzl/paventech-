"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Ban, CheckCircle2, ChevronDown, Loader2, Pencil, Printer, Trash2 } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAction } from "@/hooks/use-action";
import { DOC_TYPES, type DocTypeKey } from "@/lib/documents/types";
import {
  approveDocumentAction,
  cancelDocumentAction,
  convertDocumentAction,
  deleteDocumentAction,
} from "@/server/documents/actions";

export function DocumentActions({
  id,
  type,
  status,
  number,
  conversions,
  effects,
}: {
  id: string;
  type: DocTypeKey;
  status: string;
  number: string | null;
  /** Kullanıcının modülü açık olan dönüşüm hedefleri */
  conversions: DocTypeKey[];
  /** Onayın/iptalin neleri etkileyeceği (kullanıcıya açıklama) */
  effects: string[];
}) {
  const router = useRouter();
  const approve = useAction();
  const cancel = useAction();
  const del = useAction();
  const convert = useAction();
  const def = DOC_TYPES[type];

  return (
    <>
      {status === "taslak" && (
        <>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="text-destructive hover:text-destructive" disabled={del.pending}>
                <Trash2 /> Sil
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Taslak silinsin mi?</AlertDialogTitle>
                <AlertDialogDescription>Taslak belgeler numara almadığı için silmek seride boşluk bırakmaz.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => del.run(() => deleteDocumentAction(id), { onSuccess: (d) => router.push(`/belge/${d.slug}`) })}
                >
                  Sil
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" asChild>
            <Link href={`/belge/detay/${id}/duzenle`}>
              <Pencil /> Düzenle
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={approve.pending}>
                {approve.pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                Onayla
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{def.label} onaylansın mı?</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="flex flex-col gap-2">
                    <p>Onaylanan belge numara alır ve artık değiştirilemez.</p>
                    {effects.length > 0 && (
                      <ul className="list-disc pl-5">
                        {effects.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                <AlertDialogAction onClick={() => approve.run(() => approveDocumentAction(id), { onSuccess: () => router.refresh() })}>
                  Onayla
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {status !== "taslak" && (
        <Button variant="outline" asChild>
          <a href={`/yazdir/belge/${id}`} target="_blank" rel="noreferrer">
            <Printer /> Yazdır / PDF
          </a>
        </Button>
      )}

      {status === "onayli" && (
        <>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="text-destructive hover:text-destructive" disabled={cancel.pending}>
                <Ban /> İptal et
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{number} iptal edilsin mi?</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="flex flex-col gap-2">
                    <p>
                      Belge silinmez; ürettiği her hareket için ters kayıt atılır ve numara korunur. Bu işlem geri alınamaz.
                    </p>
                    {effects.length > 0 && (
                      <ul className="list-disc pl-5">
                        {effects.map((e) => (
                          <li key={e}>Geri alınacak: {e.toLocaleLowerCase("tr-TR")}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => cancel.run(() => cancelDocumentAction(id), { onSuccess: () => router.refresh() })}>
                  İptal et
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {conversions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={convert.pending}>
                  {convert.pending ? <Loader2 className="animate-spin" /> : <ArrowRightLeft />}
                  Dönüştür <ChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Bu belgeden oluştur</DropdownMenuLabel>
                {conversions.map((t) => (
                  <DropdownMenuItem
                    key={t}
                    onSelect={() =>
                      convert.run(() => convertDocumentAction(id, t), { onSuccess: (d) => router.push(`/belge/detay/${d.id}/duzenle`) })
                    }
                  >
                    {DOC_TYPES[t].label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </>
      )}
    </>
  );
}
