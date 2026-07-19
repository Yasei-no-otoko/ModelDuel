"use client";

import { useSyncExternalStore } from "react";

const CLIENT_READY = true;
const SERVER_NOT_READY = false;
const SERVER_REDUCED_MOTION = true;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const COMPACT_VIEWPORT_QUERY = "(max-width: 520px)";

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

function subscribeCompactViewport(onStoreChange: () => void) {
  const query = window.matchMedia(COMPACT_VIEWPORT_QUERY);
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function getCompactViewportSnapshot() {
  return window.matchMedia(COMPACT_VIEWPORT_QUERY).matches;
}

export function useCompactViewport() {
  return useSyncExternalStore(
    subscribeCompactViewport,
    getCompactViewportSnapshot,
    getServerNotReadySnapshot,
  );
}
