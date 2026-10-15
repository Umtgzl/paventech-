CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"summary" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text,
	"kind" text DEFAULT 'bilgi' NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"href" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "number_series" (
	"tenant_id" text NOT NULL,
	"series" text NOT NULL,
	"year" integer NOT NULL,
	"next_value" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "number_series_tenant_id_series_year_pk" PRIMARY KEY("tenant_id","series","year")
);
--> statement-breakpoint
CREATE TABLE "tenant_module" (
	"tenant_id" text NOT NULL,
	"module_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "tenant_module_tenant_id_module_key_pk" PRIMARY KEY("tenant_id","module_key")
);
--> statement-breakpoint
CREATE TABLE "tenant_profile" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"legal_name" text,
	"tax_office" text,
	"tax_number" text,
	"address" text,
	"city" text,
	"phone" text,
	"email" text,
	"sector" text DEFAULT 'genel' NOT NULL,
	"plan" text DEFAULT 'baslangic' NOT NULL,
	"user_limit" integer DEFAULT 5 NOT NULL,
	"ai_monthly_credits" integer DEFAULT 0 NOT NULL,
	"show_locked_modules" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'kasa' NOT NULL,
	"bank_name" text,
	"iban" text,
	"currency" text DEFAULT 'TRY' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'musteri' NOT NULL,
	"tax_office" text,
	"tax_number" text,
	"contact_name" text,
	"phone" text,
	"email" text,
	"city" text,
	"address" text,
	"payment_term_days" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"custom" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'ticari' NOT NULL,
	"category" text,
	"unit" text DEFAULT 'ADET' NOT NULL,
	"barcode" text,
	"vat_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"sale_price" numeric(18, 4) DEFAULT '0' NOT NULL,
	"purchase_price" numeric(18, 4) DEFAULT '0' NOT NULL,
	"critical_level" numeric(18, 4) DEFAULT '0' NOT NULL,
	"track_stock" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"custom" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"cash_account_id" uuid NOT NULL,
	"document_id" uuid,
	"partner_id" uuid,
	"date" date NOT NULL,
	"amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"document_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" uuid,
	"description" text,
	"quantity" numeric(18, 4) DEFAULT '0' NOT NULL,
	"unit" text DEFAULT 'ADET' NOT NULL,
	"unit_price" numeric(18, 4) DEFAULT '0' NOT NULL,
	"discount_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"vat_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"gross_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"net_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"vat_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(18, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"type" text NOT NULL,
	"number" text,
	"status" text DEFAULT 'taslak' NOT NULL,
	"date" date NOT NULL,
	"due_date" date,
	"partner_id" uuid,
	"warehouse_id" uuid,
	"target_warehouse_id" uuid,
	"cash_account_id" uuid,
	"currency" text DEFAULT 'TRY' NOT NULL,
	"subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"vat_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"grand_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"source_document_id" uuid,
	"e_status" text,
	"approved_at" timestamp with time zone,
	"approved_by" text,
	"cancelled_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"partner_id" uuid NOT NULL,
	"document_id" uuid,
	"date" date NOT NULL,
	"due_date" date,
	"debit" numeric(18, 2) DEFAULT '0' NOT NULL,
	"credit" numeric(18, 2) DEFAULT '0' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"document_id" uuid,
	"document_line_id" uuid,
	"date" date NOT NULL,
	"quantity" numeric(18, 4) DEFAULT '0' NOT NULL,
	"unit_cost" numeric(18, 4) DEFAULT '0' NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"location" text,
	"serial_no" text,
	"purchase_date" date,
	"status" text DEFAULT 'calisiyor' NOT NULL,
	"notes" text,
	"custom" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"code" text NOT NULL,
	"employee_id" uuid NOT NULL,
	"item_name" text NOT NULL,
	"serial_no" text,
	"given_date" date NOT NULL,
	"returned_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bom_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"bom_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" numeric(18, 4) DEFAULT '0' NOT NULL,
	"waste_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "boms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"product_id" uuid NOT NULL,
	"output_quantity" numeric(18, 4) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"custom" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"code" text NOT NULL,
	"full_name" text NOT NULL,
	"department" text,
	"title" text,
	"start_date" date,
	"phone" text,
	"email" text,
	"status" text DEFAULT 'aktif' NOT NULL,
	"notes" text,
	"custom" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"code" text NOT NULL,
	"employee_id" uuid NOT NULL,
	"kind" text DEFAULT 'yillik' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"days" numeric(5, 1) DEFAULT '1' NOT NULL,
	"status" text DEFAULT 'talep' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"code" text NOT NULL,
	"asset_id" uuid NOT NULL,
	"kind" text DEFAULT 'periyodik' NOT NULL,
	"date" date NOT NULL,
	"next_date" date,
	"cost" numeric(18, 2) DEFAULT '0' NOT NULL,
	"performed_by" text,
	"status" text DEFAULT 'planlandi' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"partner_id" uuid,
	"lead_company" text,
	"contact_name" text,
	"phone" text,
	"stage" text DEFAULT 'yeni' NOT NULL,
	"amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"probability" integer DEFAULT 20 NOT NULL,
	"expected_close" date,
	"owner" text,
	"notes" text,
	"custom" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"code" text NOT NULL,
	"bom_id" uuid NOT NULL,
	"quantity" numeric(18, 4) DEFAULT '0' NOT NULL,
	"planned_date" date,
	"warehouse_id" uuid,
	"status" text DEFAULT 'planlandi' NOT NULL,
	"completed_at" timestamp with time zone,
	"notes" text,
	"custom" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"partner_id" uuid,
	"start_date" date,
	"end_date" date,
	"status" text DEFAULT 'planlandi' NOT NULL,
	"budget" numeric(18, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"custom" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quality_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"code" text NOT NULL,
	"date" date NOT NULL,
	"stage" text DEFAULT 'giris' NOT NULL,
	"product_id" uuid,
	"partner_id" uuid,
	"lot_no" text,
	"sample_quantity" numeric(18, 4) DEFAULT '0' NOT NULL,
	"result" text DEFAULT 'kabul' NOT NULL,
	"inspector" text,
	"notes" text,
	"custom" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"project_id" uuid,
	"assignee" text,
	"due_date" date,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'yapilacak' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"template" text NOT NULL,
	"name" text NOT NULL,
	"trigger" text NOT NULL,
	"action" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "einvoice_inbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"ettn" text NOT NULL,
	"number" text NOT NULL,
	"date" date NOT NULL,
	"supplier_name" text NOT NULL,
	"supplier_tax_number" text NOT NULL,
	"grand_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'yeni' NOT NULL,
	"created_document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_product_map" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"supplier_tax_number" text NOT NULL,
	"supplier_item_name" text NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "number_series" ADD CONSTRAINT "number_series_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_module" ADD CONSTRAINT "tenant_module_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_module" ADD CONSTRAINT "tenant_module_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_profile" ADD CONSTRAINT "tenant_profile_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_accounts" ADD CONSTRAINT "cash_accounts_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_cash_account_id_cash_accounts_id_fk" FOREIGN KEY ("cash_account_id") REFERENCES "public"."cash_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_lines" ADD CONSTRAINT "document_lines_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_lines" ADD CONSTRAINT "document_lines_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_lines" ADD CONSTRAINT "document_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_target_warehouse_id_warehouses_id_fk" FOREIGN KEY ("target_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_cash_account_id_cash_accounts_id_fk" FOREIGN KEY ("cash_account_id") REFERENCES "public"."cash_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_movements" ADD CONSTRAINT "partner_movements_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_movements" ADD CONSTRAINT "partner_movements_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_movements" ADD CONSTRAINT "partner_movements_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_bom_id_boms_id_fk" FOREIGN KEY ("bom_id") REFERENCES "public"."boms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boms" ADD CONSTRAINT "boms_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boms" ADD CONSTRAINT "boms_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_bom_id_boms_id_fk" FOREIGN KEY ("bom_id") REFERENCES "public"."boms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "einvoice_inbox" ADD CONSTRAINT "einvoice_inbox_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "einvoice_inbox" ADD CONSTRAINT "einvoice_inbox_created_document_id_documents_id_fk" FOREIGN KEY ("created_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_product_map" ADD CONSTRAINT "supplier_product_map_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "audit_log_tenant_id_created_at_index" ON "audit_log" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_tenant_id_created_at_index" ON "notification" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_accounts_tenant_id_code_index" ON "cash_accounts" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "partners_tenant_id_code_index" ON "partners" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "partners_tenant_id_name_index" ON "partners" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "products_tenant_id_code_index" ON "products" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "products_tenant_id_name_index" ON "products" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_tenant_id_code_index" ON "warehouses" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "cash_movements_tenant_id_cash_account_id_date_index" ON "cash_movements" USING btree ("tenant_id","cash_account_id","date");--> statement-breakpoint
CREATE INDEX "document_lines_document_id_index" ON "document_lines" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_tenant_id_type_number_index" ON "documents" USING btree ("tenant_id","type","number");--> statement-breakpoint
CREATE INDEX "documents_tenant_id_type_date_index" ON "documents" USING btree ("tenant_id","type","date");--> statement-breakpoint
CREATE INDEX "documents_tenant_id_partner_id_index" ON "documents" USING btree ("tenant_id","partner_id");--> statement-breakpoint
CREATE INDEX "partner_movements_tenant_id_partner_id_date_index" ON "partner_movements" USING btree ("tenant_id","partner_id","date");--> statement-breakpoint
CREATE INDEX "stock_movements_tenant_id_product_id_warehouse_id_index" ON "stock_movements" USING btree ("tenant_id","product_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_movements_tenant_id_date_index" ON "stock_movements" USING btree ("tenant_id","date");--> statement-breakpoint
CREATE INDEX "assets_tenant_id_code_index" ON "assets" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "assignments_tenant_id_employee_id_index" ON "assignments" USING btree ("tenant_id","employee_id");--> statement-breakpoint
CREATE INDEX "bom_lines_bom_id_index" ON "bom_lines" USING btree ("bom_id");--> statement-breakpoint
CREATE INDEX "boms_tenant_id_code_index" ON "boms" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "employees_tenant_id_full_name_index" ON "employees" USING btree ("tenant_id","full_name");--> statement-breakpoint
CREATE INDEX "leaves_tenant_id_start_date_index" ON "leaves" USING btree ("tenant_id","start_date");--> statement-breakpoint
CREATE INDEX "maintenance_records_tenant_id_date_index" ON "maintenance_records" USING btree ("tenant_id","date");--> statement-breakpoint
CREATE INDEX "opportunities_tenant_id_stage_index" ON "opportunities" USING btree ("tenant_id","stage");--> statement-breakpoint
CREATE INDEX "production_orders_tenant_id_status_index" ON "production_orders" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "projects_tenant_id_status_index" ON "projects" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "quality_checks_tenant_id_date_index" ON "quality_checks" USING btree ("tenant_id","date");--> statement-breakpoint
CREATE INDEX "tasks_tenant_id_status_index" ON "tasks" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "automation_rules_tenant_id_template_index" ON "automation_rules" USING btree ("tenant_id","template");--> statement-breakpoint
CREATE INDEX "einvoice_inbox_tenant_id_status_index" ON "einvoice_inbox" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "supplier_product_map_tenant_id_supplier_tax_number_index" ON "supplier_product_map" USING btree ("tenant_id","supplier_tax_number");