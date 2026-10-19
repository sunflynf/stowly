import { redirect } from "next/navigation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Short link printed in QR labels: /l/<location-id> → the location's contents.
// Kept short so the QR code stays coarse and easy to scan. A page (not a route
// handler) so it also works for in-app navigations, e.g. right after login.
export default async function LabelLink({ params }: PageProps<"/l/[id]">) {
  const { id } = await params;
  redirect(UUID.test(id) ? `/locations/${id.toLowerCase()}` : "/locations");
}
