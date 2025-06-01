ALTER TABLE "user_relations" DROP CONSTRAINT "user_relations_source_user_id_target_user_id_pk";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "display_name" text;