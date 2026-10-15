import { MODULE_GROUPS, MODULES, type IconName, type ModuleKey, type ModuleTier } from "@/lib/modules";

export interface NavModule {
  key: ModuleKey;
  name: string;
  icon: IconName;
  tier: ModuleTier;
  locked: boolean;
  items: { label: string; href: string }[];
}

export interface NavGroup {
  key: string;
  label: string;
  modules: NavModule[];
}

/** Şirketin açık modüllerine göre menü. Kapalılar ayara göre kilitli görünür ya da gizlenir. */
export function buildNav(enabled: ModuleKey[], showLocked: boolean): NavGroup[] {
  const enabledSet = new Set(enabled);
  return MODULE_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    modules: MODULES.filter((m) => m.group === g.key)
      .filter((m) => enabledSet.has(m.key) || showLocked)
      .map((m) => ({
        key: m.key,
        name: m.short,
        icon: m.icon,
        tier: m.tier,
        locked: !enabledSet.has(m.key),
        items: m.items,
      })),
  })).filter((g) => g.modules.length > 0);
}
