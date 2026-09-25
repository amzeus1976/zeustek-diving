import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AccessibleDialog, dialogAllowsImplicitDismiss, dialogNeedsDiscardConfirmation } from '../components/accessible-dialog';

describe('editable AccessibleDialog dismissal contract', () => {
  it('blocks backdrop and Escape dismissal for editable dialogs while retaining read-only dismissal', () => {
    expect(dialogAllowsImplicitDismiss(true)).toBe(false);
    expect(dialogAllowsImplicitDismiss(false)).toBe(true);
    const html = renderToStaticMarkup(createElement(AccessibleDialog, { editable: true, label: 'Editor', className: 'focus-modal', close: () => {}, children: createElement('input', { defaultValue: 'preserved' }) }));
    expect(html).toContain('data-editable="true"');
    expect(html).toContain('value="preserved"');
  });

  it('requires confirmation only for an explicit close with unsaved editable state', () => {
    expect(dialogNeedsDiscardConfirmation(true, true)).toBe(true);
    expect(dialogNeedsDiscardConfirmation(true, false)).toBe(false);
    expect(dialogNeedsDiscardConfirmation(false, true)).toBe(false);
    const source = readFileSync(new URL('../components/accessible-dialog.tsx', import.meta.url), 'utf8');
    expect(source).toContain('Discard unsaved changes?');
    expect(source).toContain('Keep editing');
    expect(source).toContain('Discard changes');
  });

  it('applies the explicit-exit contract to existing editable overlays', () => {
    const sources = [
      readFileSync(new URL('../components/dive-record-detail.tsx', import.meta.url), 'utf8'),
      readFileSync(new URL('../components/skill-catalogue.tsx', import.meta.url), 'utf8'),
      readFileSync(new URL('../components/conservation-page.tsx', import.meta.url), 'utf8'),
      readFileSync(new URL('../components/media-gallery.tsx', import.meta.url), 'utf8'),
      readFileSync(new URL('../app/dashboard-client.tsx', import.meta.url), 'utf8'),
    ].join('\n');
    expect(sources).toContain('<AccessibleDialog editable label={evidence');
    expect(sources).toContain('<AccessibleDialog editable label={skill');
    expect(sources).toContain('<RecordEditorWorkspace label={item?\'Edit conservation activity\'');
    expect(sources).toContain('<AccessibleDialog editable label="Colour correct photo"');
    expect(sources).toContain('<RecordEditorWorkspace label={item ? \'Edit site\' : \'New site\'}');
    expect(sources).not.toContain('<AccessibleDialog editable label={item ? "Edit site"');
    expect(sources).toContain('<RecordEditorWorkspace label={item ? \'Edit dive\' : \'Log a dive\'}');
    expect(sources).not.toContain('<AccessibleDialog editable label={item ? "Edit dive"');
  });
});
