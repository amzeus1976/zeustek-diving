'use client';
import { Profiler, useLayoutEffect, type ReactNode } from 'react';
import { zeustekDb } from '@/lib/offline/db';

function record(code: string, durationMs: number) {
  void zeustekDb.diagnostics.put({ id: code, code, createdAt: new Date().toISOString(), detail: { durationMs: Math.round(durationMs * 100) / 100 } }).catch(() => {});
}

export function ScreenTiming({ screen, children }: { screen: string; children: ReactNode }) {
  useLayoutEffect(() => {
    const started = performance.now();
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => record(`DIVE_COMMIT_TO_PAINT_${screen}`, performance.now() - started));
    });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [screen]);
  // React exposes actual render CPU time in development/profiling builds.
  // Commit-to-paint is a separate production metric, not a cold-start claim.
  return <Profiler id={screen} onRender={(id, _phase, duration) => record(`DIVE_RENDER_${id}`, duration)}>{children}</Profiler>;
}
