import {MigrationInterface, QueryRunner} from "typeorm";

/** The activity log: one line per change, per store. A new table; nothing existing changes. */
export class Activity1795300000000 implements MigrationInterface {
   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "oss_activity" ("id" SERIAL NOT NULL, "channelId" character varying(60) NOT NULL, "at" TIMESTAMP NOT NULL DEFAULT now(), "actorId" character varying(60), "actorName" character varying(160) NOT NULL, "action" character varying(60) NOT NULL, "summary" character varying(400) NOT NULL, "subjectType" character varying(40), "subjectId" character varying(60), CONSTRAINT "PK_oss_activity_id" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_oss_activity_channel" ON "oss_activity" ("channelId")`, undefined);
   }
   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_oss_activity_channel"`, undefined);
        await queryRunner.query(`DROP TABLE IF EXISTS "oss_activity"`, undefined);
   }
}
