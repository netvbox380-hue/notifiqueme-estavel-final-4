// Registro centralizado do Service Worker / PWA
// Objetivo: manter um único ponto de registro para não duplicar listeners,
// não quebrar push/PWA e evitar comportamentos inconsistentes entre telas.

function isDevLikeHost() {
  const host = String(window.location.hostname || "");
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    host.endsWith(".local")
  );
}

export function isPwaRuntimeDisabled() {
  return Boolean((import.meta as any)?.env?.DEV) || isDevLikeHost();
}

async function cleanupOldRegistrations() {
  const regs = await navigator.serviceWorker.getRegistrations();
  for (const reg of regs) {
    const scriptUrl =
      (reg.active && reg.active.scriptURL) ||
      (reg.waiting && reg.waiting.scriptURL) ||
      (reg.installing && reg.installing.scriptURL) ||
      "";

    const pathname = scriptUrl ? new URL(scriptUrl).pathname : "";
    if (pathname && pathname !== "/sw.js") {
      await reg.unregister();
    }
  }
}

async function cleanupDevArtifacts() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {}

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {}
}

async function sendSkipWaiting(registration: ServiceWorkerRegistration) {
  if (!registration.waiting) return;
  try {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  } catch (error) {
    console.warn("[PWA] Não foi possível enviar SKIP_WAITING:", error);
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;

  if (isPwaRuntimeDisabled()) {
    await cleanupDevArtifacts();
    return null;
  }

  const RELOAD_KEY = "__pwa_sw_reloaded__";
  const markReloaded = () => sessionStorage.setItem(RELOAD_KEY, "1");
  const hasReloaded = () => sessionStorage.getItem(RELOAD_KEY) === "1";
  const clearReloaded = () => sessionStorage.removeItem(RELOAD_KEY);

  try {
    await cleanupOldRegistrations();

    const registration =
      (await navigator.serviceWorker.getRegistration("/")) ||
      (await navigator.serviceWorker.getRegistration()) ||
      (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));

    await sendSkipWaiting(registration);

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", async () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          console.log("[PWA] Update disponível. Tentando ativar…");
          await sendSkipWaiting(registration);
        }
      });
    });

    const onControllerChange = () => {
      if (hasReloaded()) return;
      markReloaded();
      console.log("[PWA] SW assumiu controle. Recarregando…");
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange, { once: true });
    window.addEventListener("pageshow", clearReloaded, { once: true });

    console.log("[PWA] Service Worker registrado");
    return registration;
  } catch (error) {
    console.warn("[PWA] Falha ao registrar Service Worker:", error);
    return null;
  }
}

export async function unregisterServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((r) => r.unregister()));
}
