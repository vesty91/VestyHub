ALTER TABLE "users" ADD COLUMN "email_verified" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires");--> statement-breakpoint
CREATE INDEX "verification_tokens_expires_idx" ON "verification_tokens" USING btree ("expires");--> statement-breakpoint
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_connector_id_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connectors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dashboard_widgets_connector_id_idx" ON "dashboard_widgets" USING btree ("connector_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dashboards_one_default_per_user_idx" ON "dashboards" USING btree ("user_id") WHERE "is_default" = true;--> statement-breakpoint
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_width_positive" CHECK ("width" > 0);--> statement-breakpoint
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_height_positive" CHECK ("height" > 0);--> statement-breakpoint
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_min_width_positive" CHECK ("min_width" > 0);--> statement-breakpoint
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_min_height_positive" CHECK ("min_height" > 0);--> statement-breakpoint
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_refresh_interval_minimum" CHECK ("refresh_interval_ms" >= 1000);--> statement-breakpoint
ALTER TABLE "connectors" ADD CONSTRAINT "connectors_timeout_ms_positive" CHECK ("timeout_ms" > 0);--> statement-breakpoint
ALTER TABLE "connector_secrets" ALTER COLUMN "encryption_version" SET DEFAULT 2;--> statement-breakpoint
ALTER TABLE "connector_secrets" ADD CONSTRAINT "connector_secrets_encryption_version_positive" CHECK ("encryption_version" > 0);--> statement-breakpoint
ALTER TABLE "health_checks" ADD CONSTRAINT "health_checks_interval_seconds_positive" CHECK ("interval_seconds" > 0);--> statement-breakpoint
ALTER TABLE "health_checks" ADD CONSTRAINT "health_checks_timeout_ms_positive" CHECK ("timeout_ms" > 0);--> statement-breakpoint
ALTER TABLE "health_checks" ADD CONSTRAINT "health_checks_expected_status_range" CHECK ("expected_status" IS NULL OR "expected_status" BETWEEN 100 AND 599);--> statement-breakpoint
ALTER TABLE "health_checks" ADD CONSTRAINT "health_checks_last_latency_non_negative" CHECK ("last_latency_ms" IS NULL OR "last_latency_ms" >= 0);--> statement-breakpoint
CREATE OR REPLACE FUNCTION "vestyhub_set_updated_at"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS "users_set_updated_at" ON "users";--> statement-breakpoint
CREATE TRIGGER "users_set_updated_at" BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION "vestyhub_set_updated_at"();--> statement-breakpoint
DROP TRIGGER IF EXISTS "dashboards_set_updated_at" ON "dashboards";--> statement-breakpoint
CREATE TRIGGER "dashboards_set_updated_at" BEFORE UPDATE ON "dashboards" FOR EACH ROW EXECUTE FUNCTION "vestyhub_set_updated_at"();--> statement-breakpoint
DROP TRIGGER IF EXISTS "dashboard_widgets_set_updated_at" ON "dashboard_widgets";--> statement-breakpoint
CREATE TRIGGER "dashboard_widgets_set_updated_at" BEFORE UPDATE ON "dashboard_widgets" FOR EACH ROW EXECUTE FUNCTION "vestyhub_set_updated_at"();--> statement-breakpoint
DROP TRIGGER IF EXISTS "connectors_set_updated_at" ON "connectors";--> statement-breakpoint
CREATE TRIGGER "connectors_set_updated_at" BEFORE UPDATE ON "connectors" FOR EACH ROW EXECUTE FUNCTION "vestyhub_set_updated_at"();--> statement-breakpoint
DROP TRIGGER IF EXISTS "connector_secrets_set_updated_at" ON "connector_secrets";--> statement-breakpoint
CREATE TRIGGER "connector_secrets_set_updated_at" BEFORE UPDATE ON "connector_secrets" FOR EACH ROW EXECUTE FUNCTION "vestyhub_set_updated_at"();--> statement-breakpoint
DROP TRIGGER IF EXISTS "favorite_groups_set_updated_at" ON "favorite_groups";--> statement-breakpoint
CREATE TRIGGER "favorite_groups_set_updated_at" BEFORE UPDATE ON "favorite_groups" FOR EACH ROW EXECUTE FUNCTION "vestyhub_set_updated_at"();--> statement-breakpoint
DROP TRIGGER IF EXISTS "favorites_set_updated_at" ON "favorites";--> statement-breakpoint
CREATE TRIGGER "favorites_set_updated_at" BEFORE UPDATE ON "favorites" FOR EACH ROW EXECUTE FUNCTION "vestyhub_set_updated_at"();
