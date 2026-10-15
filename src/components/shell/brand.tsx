import Link from "next/link";

export function Brand() {
  return (
    <Link href="/panel" className="flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        P
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold">Paventech</span>
        <span className="text-[11px] text-muted-foreground">ERP Plus</span>
      </span>
    </Link>
  );
}
