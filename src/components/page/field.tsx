import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Form alanı: etiket + girdi + hata/yardım metni. */
export function Field({
  label,
  htmlFor,
  error,
  help,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  help?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-[13px]">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : help ? (
        <p className="text-xs text-muted-foreground">{help}</p>
      ) : null}
    </div>
  );
}
