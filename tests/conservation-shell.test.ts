import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConservationPage } from '../components/conservation-page';
import { MediaGallery } from '../components/media-gallery';

describe('Conservation integration shell', () => {
  it('renders ordered, labelled empty states without claiming certification', () => {
    const html = renderToStaticMarkup(createElement(ConservationPage, {go: () => {}}));
    expect(html).toContain('<h1>Conservation &amp; AWARE</h1>');
    expect(html).toContain('Search activities');
    expect(html).toContain('does not certify completion');
    expect(html.indexOf('Calculated conservation totals')).toBeLessThan(html.indexOf('AWARE learning'));
    expect(html.indexOf('Recent conservation activity')).toBeLessThan(html.indexOf('Linked sites'));
  });
  it('accepts evidence files only when opted in and preserves the existing media default', () => {
    const normal = renderToStaticMarkup(createElement(MediaGallery, {ownerKind:'dive',ownerId:'existing'}));
    const evidence = renderToStaticMarkup(createElement(MediaGallery, {ownerKind:'conservation_activity',ownerId:'existing',acceptFiles:true}));
    expect(normal).toContain('accept="image/*,video/*"');
    expect(normal).not.toContain('application/pdf');
    expect(evidence).toContain('accept="image/*,video/*,application/pdf,text/plain"');
    expect(evidence).toContain('evidence files');
  });
});
