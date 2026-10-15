// Standart modüllerin tabloları (prototipte ortak tablo/form motoruyla yönetilir).
// Her tablo gerçek, tipli kolonlara sahiptir; modül derinleştikçe iş kuralları
// bu tabloların üstüne eklenir. Sektöre özel ek alanlar `custom` kolonunda.
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { partners, products, warehouses } from "./master";
import { createdAt, money, pk, qty, rate, tenantRef, updatedAt } from "./columns";

const custom = () => jsonb().$type<Record<string, unknown>>().notNull().default({});

// ---------- Üretim & Reçete ----------

export const boms = pgTable(
  "boms",
  {
    id: pk(),
    tenantId: tenantRef(),
    code: text().notNull(),
    name: text().notNull(),
    /** Üretilen mamul */
    productId: uuid()
      .notNull()
      .references(() => products.id),
    outputQuantity: qty(),
    isActive: boolean().notNull().default(true),
    notes: text(),
    custom: custom(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.tenantId, t.code)],
);

export const bomLines = pgTable(
  "bom_lines",
  {
    id: pk(),
    tenantId: tenantRef(),
    bomId: uuid()
      .notNull()
      .references(() => boms.id, { onDelete: "cascade" }),
    /** Bileşen (hammadde / yarı mamul) */
    productId: uuid()
      .notNull()
      .references(() => products.id),
    quantity: qty(),
    wasteRate: rate(),
    notes: text(),
  },
  (t) => [index().on(t.bomId)],
);

export const productionOrders = pgTable(
  "production_orders",
  {
    id: pk(),
    tenantId: tenantRef(),
    code: text().notNull(),
    bomId: uuid()
      .notNull()
      .references(() => boms.id),
    quantity: qty(),
    plannedDate: date({ mode: "string" }),
    warehouseId: uuid().references(() => warehouses.id),
    /** planlandi | uretimde | tamamlandi | iptal */
    status: text().notNull().default("planlandi"),
    completedAt: timestamp({ withTimezone: true }),
    notes: text(),
    custom: custom(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.tenantId, t.status)],
);

// ---------- Kalite Kontrol ----------

export const qualityChecks = pgTable(
  "quality_checks",
  {
    id: pk(),
    tenantId: tenantRef(),
    code: text().notNull(),
    date: date({ mode: "string" }).notNull(),
    /** giris | ara | son */
    stage: text().notNull().default("giris"),
    productId: uuid().references(() => products.id),
    partnerId: uuid().references(() => partners.id),
    lotNo: text(),
    sampleQuantity: qty(),
    /** kabul | sartli | ret */
    result: text().notNull().default("kabul"),
    inspector: text(),
    notes: text(),
    custom: custom(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.tenantId, t.date)],
);

// ---------- Demirbaş & Bakım ----------

export const assets = pgTable(
  "assets",
  {
    id: pk(),
    tenantId: tenantRef(),
    code: text().notNull(),
    name: text().notNull(),
    category: text(),
    location: text(),
    serialNo: text(),
    purchaseDate: date({ mode: "string" }),
    /** calisiyor | bakimda | arizali | hurda */
    status: text().notNull().default("calisiyor"),
    notes: text(),
    custom: custom(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.tenantId, t.code)],
);

export const maintenanceRecords = pgTable(
  "maintenance_records",
  {
    id: pk(),
    tenantId: tenantRef(),
    code: text().notNull(),
    assetId: uuid()
      .notNull()
      .references(() => assets.id),
    /** periyodik | ariza | kalibrasyon */
    kind: text().notNull().default("periyodik"),
    date: date({ mode: "string" }).notNull(),
    nextDate: date({ mode: "string" }),
    cost: money(),
    performedBy: text(),
    /** planlandi | yapildi | iptal */
    status: text().notNull().default("planlandi"),
    notes: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.tenantId, t.date)],
);

// ---------- CRM ----------

export const opportunities = pgTable(
  "opportunities",
  {
    id: pk(),
    tenantId: tenantRef(),
    code: text().notNull(),
    title: text().notNull(),
    partnerId: uuid().references(() => partners.id),
    /** Henüz cari kartı olmayan aday firma */
    leadCompany: text(),
    contactName: text(),
    phone: text(),
    /** yeni | gorusme | teklif | pazarlik | kazanildi | kaybedildi */
    stage: text().notNull().default("yeni"),
    amount: money(),
    probability: integer().notNull().default(20),
    expectedClose: date({ mode: "string" }),
    owner: text(),
    notes: text(),
    custom: custom(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.tenantId, t.stage)],
);

// ---------- İnsan Kaynakları ----------

export const employees = pgTable(
  "employees",
  {
    id: pk(),
    tenantId: tenantRef(),
    code: text().notNull(),
    fullName: text().notNull(),
    department: text(),
    title: text(),
    startDate: date({ mode: "string" }),
    phone: text(),
    email: text(),
    /** aktif | izinde | ayrildi */
    status: text().notNull().default("aktif"),
    notes: text(),
    custom: custom(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.tenantId, t.fullName)],
);

export const leaves = pgTable(
  "leaves",
  {
    id: pk(),
    tenantId: tenantRef(),
    code: text().notNull(),
    employeeId: uuid()
      .notNull()
      .references(() => employees.id),
    /** yillik | mazeret | rapor | ucretsiz */
    kind: text().notNull().default("yillik"),
    startDate: date({ mode: "string" }).notNull(),
    endDate: date({ mode: "string" }).notNull(),
    days: numeric({ precision: 5, scale: 1 }).notNull().default("1"),
    /** talep | onaylandi | reddedildi */
    status: text().notNull().default("talep"),
    notes: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.tenantId, t.startDate)],
);

export const assignments = pgTable(
  "assignments",
  {
    id: pk(),
    tenantId: tenantRef(),
    code: text().notNull(),
    employeeId: uuid()
      .notNull()
      .references(() => employees.id),
    itemName: text().notNull(),
    serialNo: text(),
    givenDate: date({ mode: "string" }).notNull(),
    returnedDate: date({ mode: "string" }),
    notes: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.tenantId, t.employeeId)],
);

// ---------- Görev & Proje ----------

export const projects = pgTable(
  "projects",
  {
    id: pk(),
    tenantId: tenantRef(),
    code: text().notNull(),
    name: text().notNull(),
    partnerId: uuid().references(() => partners.id),
    startDate: date({ mode: "string" }),
    endDate: date({ mode: "string" }),
    /** planlandi | devam | beklemede | tamamlandi */
    status: text().notNull().default("planlandi"),
    budget: money(),
    notes: text(),
    custom: custom(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.tenantId, t.status)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: pk(),
    tenantId: tenantRef(),
    code: text().notNull(),
    title: text().notNull(),
    projectId: uuid().references(() => projects.id),
    assignee: text(),
    dueDate: date({ mode: "string" }),
    /** dusuk | normal | yuksek | acil */
    priority: text().notNull().default("normal"),
    /** yapilacak | devam | kontrol | tamamlandi */
    status: text().notNull().default("yapilacak"),
    notes: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.tenantId, t.status)],
);
