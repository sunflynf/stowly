"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/push-client";

/** Registers the service worker in production (dev keeps hot reload uncached). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    void registerServiceWorker();
  }, []);
  return null;
}
