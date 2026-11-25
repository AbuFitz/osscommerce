import {MigrationInterface, QueryRunner} from "typeorm";

/** Per-item low-stock level and the stock change history. Additive and nullable. */
export class StockFields1795200000000 implements MigrationInterface {
   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "product_variant" ADD COLUMN IF NOT EXISTS "customFieldsLowstockat" integer`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" ADD COLUMN IF NOT EXISTS "customFieldsStocklog" text`, undefined);
   }
   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN IF EXISTS "customFieldsStocklog"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN IF EXISTS "customFieldsLowstockat"`, undefined);
   }
}
