import { DrawerGate } from "@/components/items/item-drawer";
import { EditItem } from "../../../../items/[id]/edit/edit-item";

export default async function EditItemDrawerPage({ params }: PageProps<"/items/[id]/edit">) {
  const { id } = await params;
  return (
    <DrawerGate>
      <EditItem id={id} drawer />
    </DrawerGate>
  );
}
