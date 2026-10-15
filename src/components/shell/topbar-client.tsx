"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bell, Building2, Check, ChevronDown, LogOut, Menu, Search, Shield } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { authClient } from "@/lib/auth-client";
import { formatDateTime } from "@/lib/format";
import type { ModuleKey } from "@/lib/modules";
import { markNotificationsReadAction, switchTenantAction } from "@/server/services/shell-actions";
import { CommandMenu, type CommandEntry } from "./command-menu";
import { SidebarNav } from "./sidebar-nav";
import { Brand } from "./brand";
import type { NavGroup } from "./nav-data";

interface Props {
  tenantId: string;
  tenantName: string;
  userName: string;
  userEmail: string;
  isSuperAdmin: boolean;
  memberships: { id: string; name: string }[];
  nav: NavGroup[];
  commands: CommandEntry[];
  enabledModules: ModuleKey[];
  unreadCount: number;
  notifications: { id: string; title: string; body: string | null; href: string | null; read: boolean; createdAt: string }[];
}

export function TopbarClient(props: Props) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function switchTenant(id: string) {
    if (id === props.tenantId) return;
    startTransition(async () => {
      const res = await switchTenantAction(id);
      if (!res.ok) toast.error(res.error);
      else router.push("/panel");
    });
  }

  async function signOut() {
    await authClient.signOut();
    router.push("/giris");
    router.refresh();
  }

  const initials = props.userName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase("tr-TR");

  return (
    <div className="flex h-14 items-center gap-2 px-3 lg:px-6">
      <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Menü">
        <Menu />
      </Button>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0">
          <SheetTitle className="sr-only">Menü</SheetTitle>
          <div className="border-b px-4 py-3">
            <Brand />
          </div>
          <SidebarNav groups={props.nav} isSuperAdmin={props.isSuperAdmin} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Şirket seçici */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-9 max-w-[16rem] gap-2 px-2" disabled={pending}>
            <Building2 className="size-4 text-muted-foreground" />
            <span className="truncate font-medium">{props.tenantName}</span>
            {props.memberships.length > 1 && <ChevronDown className="size-3.5 text-muted-foreground" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Şirketlerim</DropdownMenuLabel>
          {props.memberships.map((m) => (
            <DropdownMenuItem key={m.id} onSelect={() => switchTenant(m.id)}>
              <Building2 />
              <span className="flex-1 truncate">{m.name}</span>
              {m.id === props.tenantId && <Check className="text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex-1" />

      <Button
        variant="outline"
        className="hidden h-8 w-64 justify-start gap-2 px-3 text-muted-foreground sm:flex"
        onClick={() => setCommandOpen(true)}
      >
        <Search className="size-4" />
        <span className="flex-1 text-left text-sm">Ara veya işlem yap...</span>
        <kbd className="rounded border bg-muted px-1.5 font-mono text-[10px]">⌘K</kbd>
      </Button>
      <Button variant="ghost" size="icon-sm" className="sm:hidden" onClick={() => setCommandOpen(true)} aria-label="Ara">
        <Search />
      </Button>
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} commands={props.commands} enabledModules={props.enabledModules} />

      {/* Bildirimler */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="relative" aria-label="Bildirimler">
            <Bell />
            {props.unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                {props.unreadCount > 9 ? "9+" : props.unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-medium">Bildirimler</span>
            {props.unreadCount > 0 && (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => startTransition(async () => void (await markNotificationsReadAction()))}
              >
                Tümünü okundu say
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {props.notifications.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Bildirim yok.</p>
            )}
            {props.notifications.map((n) => {
              const body = (
                <div className="flex gap-2 px-4 py-2.5 hover:bg-muted/50">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-primary"}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDateTime(n.createdAt)}</p>
                  </div>
                </div>
              );
              return n.href ? (
                <Link key={n.id} href={n.href} className="block border-b last:border-0">
                  {body}
                </Link>
              ) : (
                <div key={n.id} className="border-b last:border-0">
                  {body}
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Kullanıcı menüsü */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-9 gap-2 px-1.5">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {initials}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-sm text-foreground">{props.userName}</span>
            <span className="font-normal">{props.userEmail}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {props.isSuperAdmin && (
            <DropdownMenuItem asChild>
              <Link href="/super-admin">
                <Shield />
                Super Admin
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={signOut} variant="destructive">
            <LogOut />
            Çıkış yap
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
