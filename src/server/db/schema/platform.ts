// Platform tabloları: şirket profili, modül anahtarları, numara serileri,
// denetim kaydı ve bildirimler.
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { createdAt, pk, tenantRef, updatedAt } from "./columns";

/** Şirketin ticari bilgileri ve paket/kota ayarları (Super Admin yönetir). */
export const tenantProfile = pgTable("tenant_profile", {
  tenantId: text()
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  legalName: text(),
  taxOffice: text(),
  taxNumber: text(),
  address: text(),
  city: text(),
  phone: text(),
  email: text(),
  sector: text().notNull().default("genel"),
  plan: text().notNull().default("baslangic"),
  userLimit: integer().notNull().default(5),
  aiMonthlyCredits: integer().notNull().default(0),
  /** Kapalı modüller menüde kilitli görünsün mü (upsell) yoksa tamamen gizlensin mi */
  showLockedModules: boolean().notNull().default(true),
  isActive: boolean().notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Şirket bazında açık/kapalı modüller. Kayıt yoksa modül kapalıdır. */
export const tenantModule = pgTable(
  "tenant_module",
  {
    tenantId: tenantRef(),
    moduleKey: text().notNull(),
    enabled: boolean().notNull().default(true),
    updatedAt: updatedAt(),
    updatedBy: text().references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.moduleKey] })],
);

/**
 * Belge numara serileri. Numara yalnızca belge onaylanırken alınır;
 * böylece silinen taslaklar seride boşluk bırakmaz.
 */
export const numberSeries = pgTable(
  "number_series",
  {
    tenantId: tenantRef(),
    series: text().notNull(),
    year: integer().notNull(),
    nextValue: integer().notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.series, t.year] })],
);

/** Kim, neyi, ne zaman yaptı. Silinmez, güncellenmez. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: pk(),
    tenantId: tenantRef(),
    userId: text().references(() => user.id, { onDelete: "set null" }),
    action: text().notNull(),
    entity: text().notNull(),
    entityId: text(),
    summary: text().notNull(),
    data: jsonb().$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.tenantId, t.createdAt)],
);

/** Uygulama içi bildirimler (otomasyon kuralları da buraya yazar). */
export const notification = pgTable(
  "notification",
  {
    id: pk(),
    tenantId: tenantRef(),
    /** null: şirketteki herkes görür */
    userId: text().references(() => user.id, { onDelete: "cascade" }),
    kind: text().notNull().default("bilgi"),
    title: text().notNull(),
    body: text(),
    href: text(),
    readAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.tenantId, t.createdAt)],
);
