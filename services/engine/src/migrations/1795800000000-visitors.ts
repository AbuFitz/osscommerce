import {MigrationInterface, QueryRunner} from "typeorm";

/** Cookieless visitor analytics: day-level totals and short-lived daily hashes. New tables; nothing existing changes. */
export class Visitors1795800000000 implements MigrationInterface {
   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "oss_visit" ("id" SERIAL NOT NULL, "channelId" character varying(60) NOT NULL, "day" character varying(10) NOT NULL, "hash" character varying(16) NOT NULL, "steps" integer NOT NULL DEFAULT 0, "pages" integer NOT NULL DEFAULT 0, "source" character varying(60) NOT NULL, "device" character varying(1) NOT NULL, CONSTRAINT "PK_oss_visit" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_oss_visit_channel" ON "oss_visit" ("channelId")`, undefined);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_oss_visit_day" ON "oss_visit" ("day")`, undefined);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "oss_pageday" ("id" SERIAL NOT NULL, "channelId" character varying(60) NOT NULL, "day" character varying(10) NOT NULL, "path" character varying(200) NOT NULL, "views" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_oss_pageday" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_oss_pageday_channel" ON "oss_pageday" ("channelId")`, undefined);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_oss_pageday_day" ON "oss_pageday" ("day")`, undefined);
   }
   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP TABLE IF EXISTS "oss_pageday"`, undefined);
        await queryRunner.query(`DROP TABLE IF EXISTS "oss_visit"`, undefined);
   }
}
