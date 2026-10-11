import { redirect } from 'next/navigation';

/** The sidebar's "Finances" group opens the invoices list. */
export default function Page() {
  redirect('/admin/invoices');
}
