import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Özet kutucuğu: büyük rakam + açıklama. */
export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "success" | "danger" | "warning";
  icon?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          {icon}
        </div>
        <div
          className={cn(
            "text-xl font-semibold tabular-nums",
            tone === "success" && "text-success",
            tone === "danger" && "text-destructive",
            tone === "warning" && "text-warning-foreground",
          )}
        >
          {value}
        </div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
