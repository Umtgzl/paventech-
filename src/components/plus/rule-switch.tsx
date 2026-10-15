"use client";

import { useOptimistic } from "react";
import { Switch } from "@/components/ui/switch";
import { useAction } from "@/hooks/use-action";
import { toggleAutomationAction } from "@/server/plus/actions";

/** Otomasyon kuralı anahtarı: tıklanınca hemen döner, hata olursa geri alınır. */
export function RuleSwitch({ template, name, enabled, live }: { template: string; name: string; enabled: boolean; live: boolean }) {
  const action = useAction();
  const [checked, setChecked] = useOptimistic(enabled);

  return (
    <Switch
      checked={checked}
      disabled={!live || action.pending}
      aria-label={`${name} kuralı`}
      onCheckedChange={(v) =>
        action.run(async () => {
          setChecked(v);
          return toggleAutomationAction(template, v);
        })
      }
    />
  );
}
