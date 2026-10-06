import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {FormattedPlanText} from '../components/planning/formatted-plan-text';
import {editedPlanText,matchingPlanText,normalisePlanTextFormats,planTextFromPlain,planTextPlain,safePlanTextDocument} from '../lib/planning/formatted-text';
import {duplicateDivePlanDraft} from '../lib/planning/duplicate-plans';
import type {StoredEnrichedDivePlan} from '../lib/offline/dive-planning-centre';

const doc={version:1,type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Aim 🌊',marks:[{type:'bold'},{type:'italic'},{type:'underline'}]}]},{type:'bulletList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Enjoy the dive'}]}]}]},{type:'orderedList',attrs:{start:2},content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Stay with the team'}]}]}]}]};
describe('Private formatted Plan text',()=>{
  it('keeps existing plain text, blank lines, spaces and literal HTML exact',()=>{
    const value='  Aim 🌊\n\n<script>alert(1)</script>\n';
    expect(planTextPlain(planTextFromPlain(value))).toBe(value);
    expect(renderToStaticMarkup(<FormattedPlanText text={value}/>)).toContain('&lt;script&gt;');
    expect(renderToStaticMarkup(<FormattedPlanText text={value}/>)).not.toContain('<script>');
  });
  it('renders all five formats without changing the canonical text',()=>{
    const safe=safePlanTextDocument(doc)!;
    expect(planTextPlain(safe)).toBe('Aim 🌊\nEnjoy the dive\nStay with the team');
    const html=renderToStaticMarkup(<FormattedPlanText text={planTextPlain(safe)} document={safe}/>);
    for(const tag of ['<strong>','<em>','<u>','<ul>','<ol start="2">'])expect(html).toContain(tag);
    expect(html).not.toContain('contenteditable');
  });
  it('falls back to the current text when imported formatting describes an older value',()=>{
    expect(matchingPlanText('Changed manually',doc)).toBeNull();
    expect(renderToStaticMarkup(<FormattedPlanText text="Changed manually" document={doc}/>)).not.toContain('<strong>');
  });
  it('rejects links, scripts, images, unsupported marks and malformed list structure',()=>{
    for(const node of [{type:'image',attrs:{src:'https://example.invalid/private'}},{type:'script',text:'bad'},{type:'paragraph',content:[{type:'text',text:'bad',marks:[{type:'link',attrs:{href:'javascript:bad'}}]}]},{type:'bulletList',content:[{type:'text',text:'bad'}]}])expect(safePlanTextDocument({version:1,type:'doc',content:[node]})).toBeNull();
  });
  it('discards arbitrary attributes and rejects excessive content and invalid list numbering',()=>{
    const input={version:1,type:'doc',attrs:{onerror:'bad'},content:[{type:'paragraph',attrs:{style:'url(bad)'},content:[{type:'text',text:'Safe',attrs:{onclick:'bad'}}]}]};
    expect(JSON.stringify(safePlanTextDocument(input))).not.toContain('bad');
    expect(safePlanTextDocument(planTextFromPlain('x'.repeat(100001)))).toBeNull();
    expect(safePlanTextDocument({...doc,content:[{...doc.content[2],attrs:{start:-1}}]})).toBeNull();
  });
  it('retains oversized entered text when only its formatting metadata is too large',()=>{
    const text='🌊'.repeat(50001),update=editedPlanText(planTextFromPlain(text));
    expect(update.text).toBe(text);
    expect(update.document).toBeUndefined();
  });
  it('bounds restored formatting to supported fields and restricted documents',()=>{
    const valid=safePlanTextDocument(doc)!;
    const restored={aim:valid,notes:planTextFromPlain('x'.repeat(100001)),goals:{version:1,type:'script'},unknown:valid};
    expect(normalisePlanTextFormats(restored)).toEqual({aim:valid});
    expect(normalisePlanTextFormats({notes:undefined})).toEqual({});
    for(const invalid of [undefined,null,[],42])expect(normalisePlanTextFormats(invalid)).toBeUndefined();
  });
  it('retains formatting through backup JSON and a fresh duplicated Plan without sharing mutable nodes',()=>{
    const document=safePlanTextDocument(doc)!;
    const original={entityId:'qa-plan',name:'QA',notes:planTextPlain(document),textFormatting:{notes:document},startDate:'2026-10-10',endDate:'2026-10-10',siteName:'Dummy',buddy:'',status:'planned',createdAt:'now',modifiedAt:'now'} as StoredEnrichedDivePlan;
    const restored=JSON.parse(JSON.stringify(original));
    expect(matchingPlanText(restored.notes,restored.textFormatting.notes)).toEqual(document);
    const copy=duplicateDivePlanDraft(original);
    expect(copy.textFormatting?.notes).toEqual(document);
    expect(copy.textFormatting?.notes).not.toBe(document);
    expect(original.notes).toBe(planTextPlain(document));
  });
});
