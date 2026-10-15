// Varlık anahtarı -> veritabanı tablosu eşlemesi.
import type { PgTable } from "drizzle-orm/pg-core";
import type { EntityKey } from "@/lib/entities/types";
import {
  assets,
  assignments,
  boms,
  cashAccounts,
  employees,
  leaves,
  maintenanceRecords,
  opportunities,
  partners,
  productionOrders,
  products,
  projects,
  qualityChecks,
  tasks,
  warehouses,
} from "@/server/db/schema";

export const ENTITY_TABLES: Record<EntityKey, PgTable> = {
  cari: partners,
  urun: products,
  depo: warehouses,
  "kasa-hesap": cashAccounts,
  recete: boms,
  "is-emri": productionOrders,
  "kalite-kontrol": qualityChecks,
  demirbas: assets,
  "bakim-kaydi": maintenanceRecords,
  firsat: opportunities,
  personel: employees,
  izin: leaves,
  zimmet: assignments,
  proje: projects,
  gorev: tasks,
};
