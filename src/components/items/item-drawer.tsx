"use client";

import { useRouter } from "next/navigation";
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
