import { and, count, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/server/db";
import { member, notification, organization } from "@/server/db/schema";
import { getTenantContext } from "@/server/session";
import { buildNav } from "./nav-data";
import { TopbarClient } from "./topbar-client";
import { MODULE_MAP } from "@/lib/modules";

/** Üst çubuk: oturum ve şirket bilgisine bağlı olduğu için <Suspense> içinde çizilir. */
export async function Topbar() {
  const ctx = await getTenantContext();

  const [memberships, unread, recent] = await Promise.all([
    db
      .select({ id: organization.id, name: organization.name })
      .from(member)
      .innerJoin(organization, eq(organization.id, member.organizationId))
      .where(eq(member.userId, ctx.userId))
      .orderBy(organization.name),
    db
      .select({ n: count() })
      .from(notification)
      .where(
        and(
          eq(notification.tenantId, ctx.tenantId),
          isNull(notification.readAt),
          or(isNull(notification.userId), eq(notification.userId, ctx.userId)),
        ),
      ),
    db
      .select({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        href: notification.href,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      })
      .from(notification)
      .where(
        and(
          eq(notification.tenantId, ctx.tenantId),
          or(isNull(notification.userId), eq(notification.userId, ctx.userId)),
        ),
      )
      .orderBy(desc(notification.createdAt))
      .limit(8),
  ]);

  const nav = buildNav(ctx.enabledModules, ctx.showLockedModules);
  const commands = ctx.enabledModules.flatMap((key) =>
    MODULE_MAP[key].items.map((item) => ({ label: item.label, group: MODULE_MAP[key].short, href: item.href })),
  );

  return (
    <TopbarClient
      tenantId={ctx.tenantId}
      tenantName={ctx.tenantName}
      userName={ctx.userName}
      userEmail={ctx.userEmail}
      isSuperAdmin={ctx.isSuperAdmin}
      memberships={memberships}
      nav={nav}
      commands={commands}
      enabledModules={ctx.enabledModules}
      unreadCount={unread[0]?.n ?? 0}
      notifications={recent.map((n) => ({
        ...n,
        read: n.readAt !== null,
        createdAt: n.createdAt.toISOString(),
        readAt: undefined,
      }))}
    />
  );
}
