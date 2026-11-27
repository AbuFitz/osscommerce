import {MigrationInterface, QueryRunner} from "typeorm";

/** Saved customer segments: a new table; nothing existing changes. */
export class Segments1795500000000 implements MigrationInterface {
   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "oss_segment" ("id" SERIAL NOT NULL, "channelId" character varying(60) NOT NULL, "name" character varying(80) NOT NULL, "definition" text NOT NULL, CONSTRAINT "PK_oss_segment" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_oss_segment_channel" ON "oss_segment" ("channelId")`, undefined);
   }
   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP TABLE IF EXISTS "oss_segment"`, undefined);
   }
}
