import { describe, expect, it, vi } from 'vitest';
import { restoreDialogFocus } from '../lib/dialog/focus-restoration';

function target(connected: boolean) {
  return { isConnected: connected, focus: vi.fn() };
}

describe('dialog focus after the action removes its trigger', () => {
  it('restores a surviving trigger without scrolling the page', () => {
    const trigger = target(true), fallback = target(true);
    restoreDialogFocus(trigger, fallback);
    expect(trigger.focus).toHaveBeenCalledOnce();
    expect(trigger.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(fallback.focus).not.toHaveBeenCalled();
  });
  it('returns focus to the owner controls when revocation removes the trigger', () => {
    const removedTrigger = target(false), ownerControls = target(true);
    restoreDialogFocus(removedTrigger, ownerControls);
    expect(removedTrigger.focus).not.toHaveBeenCalled();
    expect(ownerControls.focus).toHaveBeenCalledWith({ preventScroll: true });
  });
  it('does not focus detached controls or require an optional fallback', () => {
    const detached = target(false);
    restoreDialogFocus(null, detached);
    restoreDialogFocus(detached);
    expect(detached.focus).not.toHaveBeenCalled();
  });
});
