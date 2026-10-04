import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlanEditorSection } from '../components/planning/plan-editor-section';

describe('Plan editor disclosures retain editable controls', () => {
  it('provides a named native disclosure and a separately named field group', () => {
    const html = renderToStaticMarkup(createElement(PlanEditorSection, {title:'Safety & human factors'}, createElement('textarea', {defaultValue:'Keep this plan'})));
    expect(html).toMatch(/<details[^>]* open=""/);
    expect(html).toMatch(/<summary[^>]*>.*Safety &amp; human factors.*<\/summary>/);
    expect(html).toContain('<fieldset aria-label="Safety &amp; human factors">');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('Keep this plan');
  });
  it('keeps multiline values and selected references in the disclosure body', () => {
    const html = renderToStaticMarkup(createElement(PlanEditorSection, {title:'Notes'}, [
      createElement('textarea', {key:'notes',defaultValue:'First attempt\nSecond attempt & retain evidence'}),
      createElement('select', {key:'site',defaultValue:'canonical-site'}, createElement('option', {value:'canonical-site'}, 'Saved Site')),
    ]));
    expect(html).toContain('First attempt\nSecond attempt &amp; retain evidence');
    expect(html).toContain('<option value="canonical-site" selected="">Saved Site</option>');
    expect(html.indexOf('</summary>')).toBeLessThan(html.indexOf('<textarea'));
    expect(html.indexOf('</fieldset>')).toBeLessThan(html.indexOf('</details>'));
  });
  it('keeps help actions outside the disclosure trigger so they cannot collapse it or submit', () => {
    const help = createElement('button', {type:'button','aria-label':'About Site analysis'}, 'Help');
    const html = renderToStaticMarkup(createElement(PlanEditorSection, {title:'Site & conditions analysis',help}, createElement('input', {defaultValue:'Saved Site'})));
    const summary = html.slice(html.indexOf('<summary'), html.indexOf('</summary>'));
    expect(summary).not.toContain('<button');
    expect(html).toContain('<button type="button" aria-label="About Site analysis">Help</button>');
    expect(html.indexOf('</summary>')).toBeLessThan(html.indexOf('About Site analysis'));
  });
});
