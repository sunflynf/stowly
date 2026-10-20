import { EditItem } from "../../../../items/[id]/edit/edit-item";

export default async function EditItemDrawerPage({ params }: PageProps<"/items/[id]/edit">) {
  const { id } = await params;
  return <EditItem id={id} drawer />;
}
