'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { resolveDiscardEscapeAction } from '../lib/dialog/discard-confirmation-state';

export const dialogAllowsImplicitDismiss = (editable: boolean) => !editable;
export const dialogNeedsDiscardConfirmation = (editable: boolean, dirty: boolean) => editable && dirty;

export function AccessibleDialog({ label, className, close, editable = false, dirty = false, containDismiss = false, onEscape, children }: {
  label: string; className: string; close: () => void; editable?: boolean; dirty?: boolean;
  containDismiss?: boolean; onEscape?: () => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const confirmationOrigin = useRef<HTMLElement | null>(null);
  const confirmTitleId = useId();
  const [interactionDirty, setInteractionDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const hasUnsavedChanges = dirty || interactionDirty;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    if (dialog) { dialog.scrollTop = 0; dialog.focus({ preventScroll: true }); }
    return () => { dialog?.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const dismiss = (event: MouseEvent) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      if (outside && dialogAllowsImplicitDismiss(editable)) close();
    };
    dialog.addEventListener('click', dismiss);
    return () => dialog.removeEventListener('click', dismiss);
  }, [close, editable]);

  useEffect(() => { if (confirmDiscard) confirmRef.current?.focus({ preventScroll: true }); }, [confirmDiscard]);

  function dismissConfirmation() {
    setConfirmDiscard(false);
    requestAnimationFrame(() => {
      const target = confirmationOrigin.current;
      if (target?.isConnected) target.focus({ preventScroll: true });
      else ref.current?.focus({ preventScroll: true });
    });
  }

  function requestConfirmation(origin?: HTMLElement | null) {
    confirmationOrigin.current = origin ?? document.activeElement as HTMLElement | null;
    setConfirmDiscard(true);
  }

  function handleEscape() {
    const action = resolveDiscardEscapeAction({ editable, dirty: hasUnsavedChanges, confirmationOpen: confirmDiscard });
    if (action === 'dismiss-confirmation') { dismissConfirmation(); return; }
    if (onEscape) { onEscape(); return; }
    if (action === 'request-confirmation') requestConfirmation(ref.current);
    else if (action === 'close-editor') close();
  }

  return <dialog tabIndex={-1} ref={ref} className={className} aria-label={label} data-zeustek-dialog="true" data-editable={editable || undefined}
    onCancel={(event) => {
      event.preventDefault();
      if (containDismiss) event.stopPropagation();
      handleEscape();
    }}
    onKeyDownCapture={(event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      handleEscape();
    }}
    onInputCapture={() => { if (editable) setInteractionDirty(true); }}
    onChangeCapture={() => { if (editable) setInteractionDirty(true); }}
    onClickCapture={(event) => {
      if (!editable) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-dialog-dirty]')) setInteractionDirty(true);
      if (!dialogNeedsDiscardConfirmation(editable, hasUnsavedChanges) || !target?.closest('[data-dialog-close]')) return;
      event.preventDefault(); event.stopPropagation();
      requestConfirmation(target.closest<HTMLElement>('[data-dialog-close]'));
    }}>
    {children}
    {confirmDiscard && <div className="dialog-discard-backdrop" data-zeustek-discard-layer="true">
      <section role="alertdialog" aria-modal="true" aria-labelledby={confirmTitleId} className="dialog-discard-confirmation">
        <h2 id={confirmTitleId}>Discard unsaved changes?</h2><p>Your edits have not been saved.</p>
        <div><button ref={confirmRef} type="button" className="focus-primary" onClick={dismissConfirmation}>Keep editing</button>
          <button type="button" className="focus-secondary danger" onClick={close}>Discard changes</button></div>
      </section>
    </div>}
  </dialog>;
}
