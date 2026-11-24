import { LanguageCode, PluginCommonModule, VendurePlugin } from '@vendure/core';

/** Product details Vendure does not carry itself: what search engines show, a "was" price, and a barcode. All optional, all stored with the product or variant. */
const t = (en: string) => [{ languageCode: LanguageCode.en, value: en }];
@VendurePlugin({
  imports: [PluginCommonModule],
  configuration: config => {
    config.customFields.Product = [...(config.customFields.Product ?? []),
      { name: 'seoTitle', type: 'string', length: 120, nullable: true, public: true, label: t('Search engine title') },
      { name: 'seoDescription', type: 'string', length: 320, nullable: true, public: true, label: t('Search engine description') }];
    config.customFields.ProductVariant = [...(config.customFields.ProductVariant ?? []),
      { name: 'compareAtPrice', type: 'int', min: 0, nullable: true, public: true, label: t('Compare-at price (pence)'), description: t('The "was" price shown crossed out. Must be higher than the price.') },
      { name: 'barcode', type: 'string', length: 64, nullable: true, public: true, label: t('Barcode (EAN/UPC)') }];
    return config;
  },
})
export class CatalogueFieldsPlugin {}
