"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{ classNames: { toast: "text-sm" } }}
      {...props}
    />
  );
}

export { Toaster };
