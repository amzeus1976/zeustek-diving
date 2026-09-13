/** A failed local write blocks navigation until an explicit retry saves the draft. */
export class DiveEditorWrites {
  private pending: Promise<void> = Promise.resolve();
  enqueue(save: () => Promise<void>): Promise<void> {
    this.pending = this.pending.then(save);
    return this.pending;
  }
  retry(save: () => Promise<void>): Promise<void> {
    this.pending = this.pending.catch(() => {});
    return this.enqueue(save);
  }
  async afterSaved(action: () => void): Promise<void> {
    for (;;) {
      const pending = this.pending;
      await pending;
      if (pending === this.pending) break;
    }
    action();
  }
}
