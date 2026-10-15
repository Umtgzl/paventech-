"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  hint?: string;
}

/** Aranabilir seçim kutusu (cari, ürün, depo seçimi gibi uzun listeler için). */
export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder = "Seçin...",
  emptyText = "Sonuç yok.",
  clearable = true,
  invalid,
  disabled,
  className,
}: {
  id?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyText?: string;
  clearable?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-between px-3 font-normal aria-invalid:border-destructive",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <span className="flex shrink-0 items-center gap-1">
            {clearable && selected && !disabled && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Temizle"
                className="rounded p-0.5 hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
              >
                <X className="size-3.5" />
              </span>
            )}
            <ChevronsUpDown className="size-3.5 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0">
        <Command>
          <CommandInput placeholder="Ara..." />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.hint ?? ""} ${o.value}`}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-4", o.value === value ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
