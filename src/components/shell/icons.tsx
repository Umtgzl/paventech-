import {
  BadgeCheck,
  Calculator,
  Factory,
  FileCheck,
  Globe,
  IdCard,
  Kanban,
  Landmark,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  Shield,
  ShoppingCart,
  Sparkles,
  Store,
  Target,
  Truck,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { IconName } from "@/lib/modules";

export const ICONS: Record<IconName, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  users: Users,
  landmark: Landmark,
  receipt: Receipt,
  package: Package,
  "shopping-cart": ShoppingCart,
  truck: Truck,
  factory: Factory,
  calculator: Calculator,
  "badge-check": BadgeCheck,
  wrench: Wrench,
  target: Target,
  "id-card": IdCard,
  kanban: Kanban,
  sparkles: Sparkles,
  "file-check": FileCheck,
  store: Store,
  globe: Globe,
  zap: Zap,
  settings: Settings,
  shield: Shield,
};

export function ModuleIcon({ name, className }: { name: IconName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon className={className} />;
}
