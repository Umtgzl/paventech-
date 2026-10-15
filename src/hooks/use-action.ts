"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

type Result<T> = { ok: true; data: T; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Server Action çağrısı: bekleme durumu, alan hataları ve bildirim (toast) tek yerde.
 */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function run<T>(
    fn: () => Promise<Result<T>>,
    opts?: { onSuccess?: (data: T) => void; successMessage?: string; silent?: boolean },
  ) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setFieldErrors({});
        const msg = opts?.successMessage ?? res.message;
        if (msg && !opts?.silent) toast.success(msg);
        opts?.onSuccess?.(res.data);
      } else {
        setFieldErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  return { pending, run, fieldErrors, setFieldErrors };
}
