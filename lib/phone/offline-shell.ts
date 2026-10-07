/** Only the public, anonymous phone bootstrap and component payload are cached. */
export async function phoneWorkerMessage(
  type: 'PREPARE_PHONE_OFFLINE' | 'PHONE_OFFLINE_STATUS' | 'CLEAR_PHONE_ENTRY',
) {
  if (!('serviceWorker' in navigator))
    throw new Error('This browser cannot prepare an offline app.');
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              'The offline app is still preparing. Reload online and try again.',
            ),
          ),
        20000,
      ),
    ),
  ]);
  if (type === 'PREPARE_PHONE_OFFLINE') {
    await registration.update();
    const upgrade = registration.waiting || registration.installing;
    if (upgrade)
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          upgrade.removeEventListener('statechange', changed);
          reject(
            new Error(
              'The app update did not finish. Your device records remain saved. Stay online and try Download again.',
            ),
          );
        }, 45000);
        const changed = () => {
          if (upgrade.state === 'installed')
            upgrade.postMessage({ type: 'SKIP_WAITING' });
          if (upgrade.state === 'activated' || upgrade.state === 'redundant') {
            clearTimeout(timeout);
            upgrade.removeEventListener('statechange', changed);
            if (upgrade.state === 'activated') resolve();
            else
              reject(
                new Error(
                  'The app update could not be installed. Your records are retained.',
                ),
              );
          }
        };
        upgrade.addEventListener('statechange', changed);
        changed();
      });
  }
  const worker = registration.active;
  if (!worker) throw new Error('The offline app is not ready yet.');
  return new Promise<boolean>((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => {
      channel.port1.close();
      reject(
        new Error(
          'Offline preparation did not finish. Stay online and try again.',
        ),
      );
    }, 15000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      channel.port1.close();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.ready === true);
    };
    worker.postMessage({ type }, [channel.port2]);
  });
}
