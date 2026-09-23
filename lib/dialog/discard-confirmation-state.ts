export type DiscardEscapeAction =
  | 'dismiss-confirmation'
  | 'request-confirmation'
  | 'close-editor'
  | 'ignore';

export function resolveDiscardEscapeAction(args: {
  editable: boolean;
  dirty: boolean;
  confirmationOpen: boolean;
}): DiscardEscapeAction {
  if (args.confirmationOpen) return 'dismiss-confirmation';
  if (args.editable && args.dirty) return 'request-confirmation';
  if (!args.editable) return 'close-editor';
  return 'ignore';
}
