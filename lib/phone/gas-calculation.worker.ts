/// <reference lib="webworker" />
import {
  buildRecreationalGasSnapshot,
  type RecreationalGasInput,
} from '../offline/recreational-gas-planner';
self.onmessage = (
  event: MessageEvent<{ input: RecreationalGasInput; id: number }>,
) => {
  try {
    self.postMessage({
      id: event.data.id,
      snapshot: buildRecreationalGasSnapshot(event.data.input),
    });
  } catch (error) {
    self.postMessage({
      id: event.data.id,
      error:
        error instanceof Error
          ? error.message
          : 'The calculation could not be completed.',
    });
  }
};
