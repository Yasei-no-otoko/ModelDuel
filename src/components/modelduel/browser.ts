"use client";

import { useSyncExternalStore } from "react";

const CLIENT_READY = true;
const SERVER_NOT_READY = false;
const SERVER_REDUCED_MOTION = true;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeNoop() {
  return () => undefined;
}

function getClientReadySnapshot() {
  return CLIENT_READY;
}

function getServerNotReadySnapshot() {
  return SERVER_NOT_READY;
}

export function useHydrationReady() {
  return useSyncExternalStore(
    subscribeNoop,
    getClientReadySnapshot,
    getServerNotReadySnapshot,
  );
}

let cachedWebGlAvailability: boolean | null = null;

function detectWebGlAvailability() {
  if (cachedWebGlAvailability !== null) return cachedWebGlAvailability;
  if (typeof document === "undefined") return false;

  const canvas = document.createElement("canvas");
  let context: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  try {
    context =
      (canvas.getContext("webgl2") as WebGL2RenderingContext | null) ??
      (canvas.getContext("webgl") as WebGLRenderingContext | null);
    cachedWebGlAvailability = context !== null;
  } catch {
    cachedWebGlAvailability = false;
  } finally {
    if (context) {
      try {
        context.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
        // Availability is already known; context cleanup is best-effort.
      }
    }
  }
  return cachedWebGlAvailability;
}

function subscribeWebGl(onStoreChange: () => void) {
  if (cachedWebGlAvailability === null) {
    cachedWebGlAvailability = detectWebGlAvailability();
    onStoreChange();
  }
  return () => undefined;
}

function getWebGlSnapshot() {
  return cachedWebGlAvailability;
}

function getServerWebGlSnapshot() {
  return null;
}

export function useWebGlAvailability(): boolean | null {
  return useSyncExternalStore(
    subscribeWebGl,
    getWebGlSnapshot,
    getServerWebGlSnapshot,
  );
}

function subscribeReducedMotion(onStoreChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getServerReducedMotionSnapshot() {
  return SERVER_REDUCED_MOTION;
}

export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getServerReducedMotionSnapshot,
  );
}
