"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useSyncExternalStore } from "react";
import { WebGLRenderer } from "three";

let cachedThreeRendererAvailability: boolean | null = null;

function detectThreeRendererAvailability() {
  if (cachedThreeRendererAvailability !== null) {
    return cachedThreeRendererAvailability;
  }
  if (typeof document === "undefined") return false;

  let renderer: WebGLRenderer | null = null;
  try {
    renderer = new WebGLRenderer({
      canvas: document.createElement("canvas"),
      antialias: false,
      alpha: false,
      powerPreference: "default",
    });
    cachedThreeRendererAvailability = true;
  } catch {
    cachedThreeRendererAvailability = false;
  } finally {
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
  return cachedThreeRendererAvailability;
}

function subscribeThreeRenderer(onStoreChange: () => void) {
  if (cachedThreeRendererAvailability === null) {
    cachedThreeRendererAvailability = detectThreeRendererAvailability();
    onStoreChange();
  }
  return () => undefined;
}

function getThreeRendererSnapshot() {
  return cachedThreeRendererAvailability;
}

function getServerThreeRendererSnapshot() {
  return null;
}

export function useThreeRendererAvailability(): boolean | null {
  return useSyncExternalStore(
    subscribeThreeRenderer,
    getThreeRendererSnapshot,
    getServerThreeRendererSnapshot,
  );
}

export function WebGlContextLossGuard({
  onContextLoss,
}: Readonly<{ onContextLoss: () => void }>) {
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;

    function handleContextLoss(event: Event) {
      // This mounted Canvas permanently falls back. Keep the shared capability
      // probe unchanged so sibling Canvases own and report their own lifecycle.
      event.preventDefault();
      onContextLoss();
    }

    canvas.addEventListener("webglcontextlost", handleContextLoss);
    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLoss);
    };
  }, [gl, onContextLoss]);

  return null;
}
