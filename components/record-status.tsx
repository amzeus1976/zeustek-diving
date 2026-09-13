'use client';
import { useEffect, useState } from 'react';

export function useRecordRefresh(refresh: () => void | Promise<void>) {
  useEffect(() => {
    void refresh();
    let timer: ReturnType<typeof setTimeout>;
    const updated = () => { clearTimeout(timer); timer = setTimeout(() => void refresh(), 80); };
    window.addEventListener('zeustek-records-updated', updated);
    return () => { clearTimeout(timer); window.removeEventListener('zeustek-records-updated', updated); };
  }, [refresh]);
}
export function RecordOperationStatus() {
  const [status, setStatus] = useState<{ state: string; message: string } | null>(null);
  useEffect(() => {
    if (status?.state !== 'success') return;
    const timer = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(timer);
  }, [status]);
  useEffect(() => {
    const listener = (event: Event) => setStatus((event as CustomEvent).detail);
    window.addEventListener('zeustek-operation', listener);
    return () => window.removeEventListener('zeustek-operation', listener);
  }, []);
  if (!status) return null;
  return <div className={`record-operation ${status.state}`} role={status.state === 'error' ? 'alert' : 'status'} aria-live="polite">
    {status.state === 'working' && <progress aria-label={status.message} />}
    <span>{status.message}</span>
    {status.state !== 'working' && <button type="button" onClick={() => setStatus(null)} aria-label="Dismiss operation message">×</button>}
  </div>;
}
