import { Header } from '@/components/ui';
import { ProductForm } from '@/components/product/ProductForm';
export const metadata = { title: 'Add product' };
export default function NewProduct() {
  return (<><Header title="Add product" back={{ href: '/products', label: 'Products' }} /><ProductForm /></>);
}
