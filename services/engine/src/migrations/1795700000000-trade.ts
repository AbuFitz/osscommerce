import {MigrationInterface, QueryRunner} from "typeorm";

/** Which customer group and promotion make up a store's trade pricing. A new table; nothing existing changes. */
export class Trade1795700000000 implements MigrationInterface {
   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "oss_trade" ("id" SERIAL NOT NULL, "channelId" character varying(60) NOT NULL, "groupId" character varying(60) NOT NULL, "promotionId" character varying(60) NOT NULL, CONSTRAINT "PK_oss_trade" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_oss_trade_channel" ON "oss_trade" ("channelId")`, undefined);
   }
   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP TABLE IF EXISTS "oss_trade"`, undefined);
   }
}
