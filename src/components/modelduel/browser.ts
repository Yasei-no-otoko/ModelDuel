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

const CLIENT_WEBGL_AVAILABLE =
  typeof document === "undefined"
    ? false
    : (() => {
        const canvas = document.createElement("canvas");
        return Boolean(
          canvas.getContext("webgl2") ?? canvas.getContext("webgl"),
        );
      })();

function getWebGlSnapshot() {
  return CLIENT_WEBGL_AVAILABLE;
}

export function useWebGlAvailability() {
  return useSyncExternalStore(
    subscribeNoop,
    getWebGlSnapshot,
    getServerNotReadySnapshot,
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
