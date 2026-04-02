"use client";

import { useEffect } from "react";

const SERVICE_WORKER_PATH = "/sw.js";

export default function PwaRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker.register(SERVICE_WORKER_PATH, { scope: "/" });
  }, []);

  return null;
}
