import {describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {appendMediaSelection,uploadMediaBatch} from '../lib/media-batch';
describe('shared media batch',()=>{
  it('captures the selection before resetting the picker, even when React defers the state updater',()=>{
    const source=readFileSync('components/media-gallery.tsx','utf8');
    expect(source).toContain('const selectedFiles = Array.from(e.target.files ?? []); setPending(current => appendMediaSelection(current, selectedFiles));');
    const selected=[new File(['test'],'repeat.png',{type:'image/png'})];const snapshot=Array.from(selected);selected.length=0;
    expect(appendMediaSelection([],snapshot)).toHaveLength(1);
  });
  it('appends five then three files and distinguishes identical filenames',()=>{
    const file=()=>new File(['test'],'same.png',{type:'image/png'});
    const first=appendMediaSelection([],Array.from({length:5},file));const second=appendMediaSelection(first,Array.from({length:3},file));
    expect(first).toHaveLength(5);expect(second).toHaveLength(8);expect(new Set(second.map(item=>item.id)).size).toBe(8);
    expect(second.filter(item=>item.id!==second[2]!.id)).toHaveLength(7);expect(first).toHaveLength(5);
  });
  it('continues after a failed file, preserves successful IDs/order and retries only failed selections',async()=>{
    const files=appendMediaSelection([],[new File(['a'],'a.png',{type:'image/png'}),new File(['b'],'bad.bin',{type:'application/octet-stream'}),new File(['c'],'c.png',{type:'image/png'})]);
    const request=vi.fn(async(_url:unknown,init:RequestInit)=>{const form=init.body as FormData;return (form.get('file') as File).name==='bad.bin'?new Response('',{status:415}):Response.json({id:form.get('uploadId')});});
    const result=await uploadMediaBatch(files,'dive-trip','test-trip',request as typeof fetch);
    expect(request).toHaveBeenCalledTimes(3);expect(result.uploaded.map(item=>item.fileName)).toEqual(['a.png','c.png']);expect(result.failed[0]?.error).toContain('Unsupported');
    const retry=vi.fn(async(_url:unknown,init:RequestInit)=>Response.json({id:(init.body as FormData).get('uploadId')}));
    const retried=await uploadMediaBatch(result.failed,'dive-trip','test-trip',retry as typeof fetch);
    expect(retry).toHaveBeenCalledTimes(1);expect(retried.uploaded[0]?.id).toBe(files[1]?.id);
  });
  it('retains all selected files on a connection failure',async()=>{
    const selected=appendMediaSelection([],[new File(['a'],'a.pdf',{type:'application/pdf'})]);
    const result=await uploadMediaBatch(selected,'dive-trip','test-trip',vi.fn(async()=>{throw new Error('Offline');}) as typeof fetch);
    expect(result.uploaded).toEqual([]);expect(result.failed[0]).toMatchObject({id:selected[0]!.id,error:'Offline'});
  });
});
