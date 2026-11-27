import {MigrationInterface, QueryRunner} from "typeorm";

/** Product reviews, held for the merchant's approval. A new table; nothing existing changes. */
export class Reviews1795600000000 implements MigrationInterface {
   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "oss_review" ("id" SERIAL NOT NULL, "channelId" character varying(60) NOT NULL, "productId" character varying(60) NOT NULL, "rating" integer NOT NULL, "title" character varying(120) NOT NULL, "body" character varying(2000) NOT NULL, "authorName" character varying(80) NOT NULL, "email" character varying(200) NOT NULL, "verified" boolean NOT NULL DEFAULT false, "status" character varying(10) NOT NULL DEFAULT 'pending', "reply" character varying(1000), "at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_oss_review" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_oss_review_channel" ON "oss_review" ("channelId")`, undefined);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_oss_review_product" ON "oss_review" ("productId")`, undefined);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_oss_review_email" ON "oss_review" ("email")`, undefined);
   }
   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP TABLE IF EXISTS "oss_review"`, undefined);
   }
}
