import { ReadOnlyBanner } from "./can-edit";
import { ClientGate } from "./client-gate";
import { MobileTabBar } from "./mobile-tab-bar";
import { OfflineBanner } from "./offline-banner";
import { Sidebar } from "./sidebar";

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh" aria-busy>
      <div className="hidden w-60 shrink-0 border-r border-border bg-card md:block" />
      <div className="w-full flex-1 px-4 pt-4 md:px-8 md:pt-9 xl:px-10">
        <div className="mb-6 h-9 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-[52px] animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}

export function AppShell({ children, drawer }: { children: React.ReactNode; drawer?: React.ReactNode }) {
  return (
    <ClientGate fallback={<ShellSkeleton />}>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <OfflineBanner />
          <ReadOnlyBanner />
          <main id="main" className="w-full flex-1 px-4 pt-4 pb-28 md:px-8 md:pt-9 md:pb-12 xl:px-10 print:p-0">
            {children}
          </main>
          {drawer}
        </div>
        <MobileTabBar />
      </div>
    </ClientGate>
  );
}
