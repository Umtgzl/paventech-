"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronRight, LayoutDashboard, Lock, Settings, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModuleIcon } from "./icons";
import type { NavGroup, NavModule } from "./nav-data";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function moduleActive(pathname: string, m: NavModule) {
  return pathname === `/modul/${m.key}` || m.items.some((i) => isActive(pathname, i.href));
}

export function SidebarNav({
  groups,
  isSuperAdmin,
  onNavigate,
}: {
  groups: NavGroup[];
  isSuperAdmin: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4 text-sm">
      <div className="flex flex-col gap-0.5">
        <NavLink href="/panel" active={pathname === "/panel"} onNavigate={onNavigate}>
          <LayoutDashboard className="size-4" />
          Ana Panel
        </NavLink>
      </div>

      {groups.map((g) => (
        <div key={g.key} className="flex flex-col gap-0.5">
          <div className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {g.label}
          </div>
          {g.modules.map((m) => (
            <ModuleEntry key={m.key} module={m} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      ))}

      <div className="mt-auto flex flex-col gap-0.5 border-t pt-4">
        <NavLink href="/ayarlar" active={isActive(pathname, "/ayarlar")} onNavigate={onNavigate}>
          <Settings className="size-4" />
          Şirket Ayarları
        </NavLink>
        {isSuperAdmin && (
          <NavLink href="/super-admin" active={isActive(pathname, "/super-admin")} onNavigate={onNavigate}>
            <Shield className="size-4" />
            Super Admin
          </NavLink>
        )}
      </div>
    </nav>
  );
}

function ModuleEntry({
  module: m,
  pathname,
  onNavigate,
}: {
  module: NavModule;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = moduleActive(pathname, m);
  const [open, setOpen] = useState(active);
  const expanded = open || active;

  const label = (
    <>
      <ModuleIcon name={m.icon} className="size-4 shrink-0" />
      <span className="flex-1 truncate text-left">{m.name}</span>
      {m.tier === "plus" && (
        <span className="rounded bg-plus/12 px-1.5 py-px text-[10px] font-semibold text-plus">PLUS</span>
      )}
    </>
  );

  if (m.locked) {
    return (
      <Link
        href={`/modul/${m.key}`}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground/80 transition-colors hover:bg-sidebar-accent/60",
          active && "bg-sidebar-accent text-sidebar-accent-foreground",
        )}
        title="Bu modül paketinizde yok"
      >
        {label}
        <Lock className="size-3.5 shrink-0" />
      </Link>
    );
  }

  if (m.items.length === 1) {
    return (
      <NavLink href={m.items[0].href} active={active} onNavigate={onNavigate}>
        {label}
      </NavLink>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!expanded)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60",
          active && "font-medium text-sidebar-accent-foreground",
        )}
        aria-expanded={expanded}
      >
        {label}
        <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")} />
      </button>
      {expanded && (
        <div className="mt-0.5 mb-1 ml-4 flex flex-col gap-0.5 border-l pl-2">
          {m.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "rounded-md px-2 py-1 text-[13px] text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground",
                isActive(pathname, item.href) && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function NavLink({
  href,
  active,
  children,
  onNavigate,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60",
        active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
      )}
    >
      {children}
    </Link>
  );
}
