import { DrawerGate } from "@/components/items/item-drawer";
import { QuickAdd } from "../../../items/new/quick-add";

export default function NewItemDrawerPage() {
  return (
    <DrawerGate>
      <QuickAdd drawer />
    </DrawerGate>
  );
}
