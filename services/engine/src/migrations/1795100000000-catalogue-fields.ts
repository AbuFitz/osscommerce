import {MigrationInterface, QueryRunner} from "typeorm";

/** SEO title and description on products; compare-at price and barcode on variants. Additive and nullable. */
export class CatalogueFields1795100000000 implements MigrationInterface {
   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "customFieldsSeotitle" character varying(120)`, undefined);
        await queryRunner.query(`ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "customFieldsSeodescription" character varying(320)`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" ADD COLUMN IF NOT EXISTS "customFieldsCompareatprice" integer`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" ADD COLUMN IF NOT EXISTS "customFieldsBarcode" character varying(64)`, undefined);
   }
   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN IF EXISTS "customFieldsBarcode"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN IF EXISTS "customFieldsCompareatprice"`, undefined);
        await queryRunner.query(`ALTER TABLE "product" DROP COLUMN IF EXISTS "customFieldsSeodescription"`, undefined);
        await queryRunner.query(`ALTER TABLE "product" DROP COLUMN IF EXISTS "customFieldsSeotitle"`, undefined);
   }
}
