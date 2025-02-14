CREATE TABLE "user_opt_outs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"would" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_relations" DROP CONSTRAINT "user_relations_source_user_id_target_user_id_pk";--> statement-breakpoint
ALTER TABLE "user_opt_outs" ADD CONSTRAINT "user_opt_outs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;