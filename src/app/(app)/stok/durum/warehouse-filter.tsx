"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";

export function WarehouseFilter({ options }: { options: { value: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <NativeSelect
      className="h-8 w-48"
      value={params.get("depo") ?? ""}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        if (e.target.value) next.set("depo", e.target.value);
        else next.delete("depo");
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      }}
      aria-label="Depo"
    >
      <option value="">Tüm depolar</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </NativeSelect>
  );
}
