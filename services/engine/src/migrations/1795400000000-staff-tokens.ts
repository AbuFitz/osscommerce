import {MigrationInterface, QueryRunner} from "typeorm";

/** Single-use invitation and password-reset links for staff. A new table; nothing existing changes. */
export class StaffTokens1795400000000 implements MigrationInterface {
   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "oss_staff_token" ("id" SERIAL NOT NULL, "channelId" character varying(60) NOT NULL, "administratorId" character varying(60) NOT NULL, "purpose" character varying(10) NOT NULL, "tokenHash" character varying(64) NOT NULL, "expiresMin" integer NOT NULL, CONSTRAINT "PK_oss_staff_token" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_oss_staff_token_hash" ON "oss_staff_token" ("tokenHash")`, undefined);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_oss_staff_token_channel" ON "oss_staff_token" ("channelId")`, undefined);
   }
   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP TABLE IF EXISTS "oss_staff_token"`, undefined);
   }
}
