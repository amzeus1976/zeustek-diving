import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {TripNote,TripSection} from '../components/trip-disclosure';

describe('Trip collapsible sections and five-line notes',()=>{
  it('keeps complete content inside an initially open native keyboard disclosure',()=>{
    const markup=renderToStaticMarkup(createElement(TripSection,{title:"Team",children:createElement('p',null,'Canonical team references remain mounted')}));
    expect(markup).toContain('<details');
    expect(markup).toContain(' open=""');
    expect(markup).toContain('<summary><h3>Team</h3></summary>');
    expect(markup).toContain('Canonical team references remain mounted');
  });
  it('retains full note text and uses five rendered lines rather than destructive truncation',()=>{
    const text=Array.from({length:12},(_,i)=>'Full note line '+i).join('\n');
    const markup=renderToStaticMarkup(createElement(TripNote,{text}));
    expect(markup).toContain('Full note line 11');
    expect(readFileSync('components/trips-expeditions.module.css','utf8')).toContain('-webkit-line-clamp: 5');
    const source=readFileSync('components/trip-disclosure.tsx','utf8');
    expect(source).toContain('new ResizeObserver(measure)');
    expect(source).toContain('aria-expanded={expanded}');
    expect(source).toContain('aria-controls={id}');
  });
  it('integrates every requested section and hides only the old Trip media banner',()=>{
    const source=readFileSync('components/trips-expeditions.tsx','utf8');
    for(const title of ['Readiness · advisory','Linked Plans & Linked Sites','Team','Equipment & packing','Gas & fill logistics','Bookings & accommodation','Trip documents & links','Emergency, insurance & notes']){
      expect(source).toContain('TripSection title="'+title+'"');
    }
    expect(readFileSync('components/trip-resources.tsx','utf8')).toContain('showHeading={false}');
    expect(readFileSync('components/media-gallery.tsx','utf8')).toContain('showHeading = true');
  });
});
