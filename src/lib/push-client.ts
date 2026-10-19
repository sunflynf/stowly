"use client";

import { deletePushSubscriptionAction, savePushSubscriptionAction } from "@/lib/actions/settings";

export type PushState = "unsupported" | "not-configured" | "denied" | "subscribed" | "unsubscribed";

const vapidKey = () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (!vapidKey()) return "not-configured";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "subscribed" : "unsubscribed";
}

export async function subscribePush(): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "unsubscribed";
  const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await registerServiceWorker());
  if (!reg) return "unsupported";
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey()) });
  const json = sub.toJSON();
  const result = await savePushSubscriptionAction({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
    userAgent: navigator.userAgent.slice(0, 300),
  });
  if (!result.ok) {
    await sub.unsubscribe();
    throw new Error(result.error);
  }
  return "subscribed";
}

export async function unsubscribePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await deletePushSubscriptionAction(sub.endpoint);
    await sub.unsubscribe();
  }
  return "unsubscribed";
}
