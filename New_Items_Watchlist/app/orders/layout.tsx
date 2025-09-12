// Force dynamic rendering for orders pages
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function OrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}