import { Suspense } from "react";
import { MobileTabBar } from "./mobile-tab-bar";
import { OfflineBanner } from "./offline-banner";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <Suspense>
        <Sidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <main id="main" className="mx-auto w-full max-w-[1120px] flex-1 px-4 pt-4 pb-28 md:px-10 md:pt-9 md:pb-12">
          {children}
        </main>
      </div>
      <MobileTabBar />
    </div>
  );
}
