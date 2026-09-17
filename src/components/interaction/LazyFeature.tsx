"use client";

import { lazy, Suspense, useState, type ComponentType } from "react";

/** A new instance after boundary recovery retries a rejected chunk loader. */
export function LazyFeature<P extends object>({ load, properties }: {
  load: () => Promise<{ default: ComponentType<P> }>; properties: P;
}) {
  const [Feature] = useState(() => lazy(load));
  return <Suspense fallback={<p role="status">Loading view…</p>}><Feature {...properties} /></Suspense>;
}
