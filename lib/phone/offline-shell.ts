import type { PhoneWorkerProgress } from './sync-progress';

type WorkerReply = { ready?: boolean; error?: string; appVersion?: string; completed?: number; total?: number; stage?: 'install' | 'shell' };
type WorkerOptions = { onProgress?: (progress: PhoneWorkerProgress) => void; onVersion?: (version: string) => void };

function requestWorker(worker: ServiceWorker, type: string, timeoutMs: number, onProgress?: WorkerOptions['onProgress']) {
  return new Promise<WorkerReply>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      reject(new Error('Offline preparation stopped responding. Your downloaded records and drafts are retained. Stay online and retry.'));
    }, timeoutMs);
    channel.port1.onmessage = (event: MessageEvent<WorkerReply>) => {
      const reply = event.data;
      if (reply.stage && typeof reply.completed === 'number' && typeof reply.total === 'number') {
        onProgress?.({ stage: reply.stage, completed: reply.completed, total: reply.total });
        if (type !== 'PHONE_INSTALL_PROGRESS') return;
      }
      clearTimeout(timer);
      channel.port1.close();
      if (reply.error) reject(new Error(reply.error));
      else resolve(reply);
    };
    worker.postMessage({ type }, [channel.port2]);
  });
}

async function waitForWorker(registration: ServiceWorkerRegistration, onProgress?: WorkerOptions['onProgress']) {
  const worker = registration.waiting || registration.installing || registration.active;
  if (!worker) throw new Error('The offline app could not be installed. Your downloaded records and drafts are retained. Stay online and retry.');
  let lastProgress = Date.now(), completed = -1;
  // Keep the exact requested worker even if the browser removes it from the
  // registration after a failed install. An older active worker is not success.
  while (worker.state !== 'activated' || registration.active !== worker) {
    if (worker.state === 'redundant' || ![registration.installing, registration.waiting, registration.active].includes(worker))
      throw new Error('The offline app could not be installed. Your downloaded records and drafts are retained. Stay online and retry.');
    if (worker.state === 'installed') worker.postMessage({ type: 'SKIP_WAITING' });
    // Query the installing worker directly instead of waiting for the complete
    // precache before displaying progress on a slow phone.
    const reply = await requestWorker(worker, 'PHONE_INSTALL_PROGRESS', 1200).catch(() => null);
    if (reply && typeof reply.completed === 'number' && typeof reply.total === 'number') {
      onProgress?.({ stage: 'install', completed: reply.completed, total: reply.total });
      if (reply.completed > completed) { completed = reply.completed; lastProgress = Date.now(); }
    }
    if (Date.now() - lastProgress > 180000)
      throw new Error('App download has stopped making progress. Your records and drafts are retained. Check the connection and retry.');
    await new Promise<void>(resolve => setTimeout(resolve, 500));
  }
  onProgress?.({ stage: 'install', completed: 1, total: 1 });
  return worker;
}

/** Only the public, anonymous phone bootstrap and component payload are cached. */
export async function phoneWorkerMessage(
  type: 'PREPARE_PHONE_OFFLINE' | 'PHONE_OFFLINE_STATUS' | 'CLEAR_PHONE_ENTRY',
  options: WorkerOptions = {},
) {
  if (!('serviceWorker' in navigator))
    throw new Error('This browser cannot prepare an offline app. Your downloaded records remain saved.');
  // An explicit download starts registration immediately, even when window
  // load is delayed. Status checks do not wait for initial installation.
  let registration = await navigator.serviceWorker.getRegistration();
  if (type !== 'PREPARE_PHONE_OFFLINE' && !registration?.active) return false;
  if (!registration) registration = await navigator.serviceWorker.register('/service-worker.js');
  let worker = registration.active;
  if (type === 'PREPARE_PHONE_OFFLINE') {
    options.onProgress?.({ stage: 'install', completed: 0, total: 0 });
    if (registration.active && !registration.installing && !registration.waiting) await registration.update();
    worker = await waitForWorker(registration, options.onProgress);
  }
  if (!worker) return false;
  const reply = await requestWorker(worker, type, type === 'PREPARE_PHONE_OFFLINE' ? 180000 : 5000, options.onProgress);
  if (reply.appVersion) options.onVersion?.(reply.appVersion);
  return reply.ready === true;
}
