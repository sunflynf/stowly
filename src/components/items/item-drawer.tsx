"use client";

import { usePathname, useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Create/edit form shown over the current page (intercepted route). Full-screen on phones,
 * a right-hand drawer on desktop. Closing goes back, so the URL and history stay in sync.
 */
export function ItemDrawer({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <Dialog open onOpenChange={(open) => !open && router.back()}>
      <DialogContent side="right" className="md:max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

const DRAWER_PATHS = /^\/items\/(new|[^/]+\/edit)$/;

/**
 * A parallel-route slot keeps its last page after soft navigation, so the drawer would stay open
 * after saving. Render the drawer only while the URL is one it intercepts.
 */
export function DrawerGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return DRAWER_PATHS.test(pathname) ? children : null;
}
