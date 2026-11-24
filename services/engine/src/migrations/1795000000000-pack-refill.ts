import {MigrationInterface, QueryRunner} from "typeorm";

/** Packs and singles: three optional settings on a variant (which pack to open, how many units it holds, the level to open at). Additive and nullable; nothing existing changes. */
export class PackRefill1795000000000 implements MigrationInterface {
   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "product_variant" ADD COLUMN IF NOT EXISTS "customFieldsPacksourcesku" character varying(255)`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" ADD COLUMN IF NOT EXISTS "customFieldsPackunits" integer`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" ADD COLUMN IF NOT EXISTS "customFieldsPackopenat" integer DEFAULT 0`, undefined);
   }
   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN IF EXISTS "customFieldsPackopenat"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN IF EXISTS "customFieldsPackunits"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN IF EXISTS "customFieldsPacksourcesku"`, undefined);
   }
}
