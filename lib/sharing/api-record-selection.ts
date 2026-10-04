export type ApiRecordChoice={id:string;label:string};
export type ApiChoicePage={items:ApiRecordChoice[];nextAfter:string|null};
/** Read-only enumeration. The caller applies a complete result once, after review. */
export async function collectMatchingRecordIds(
  selected:readonly string[],signal:AbortSignal,
  readPage:(after:string,signal:AbortSignal)=>Promise<unknown>,
):Promise<string[]>{
  const ids=new Set(selected),seen=new Set<string>();let after='';
  for(let page=0;page<11;page++){
    if(signal.aborted)throw new DOMException('Selection cancelled.','AbortError');
    const raw=await readPage(after,signal);
    if(signal.aborted)throw new DOMException('Selection cancelled.','AbortError');
    if(!raw||typeof raw!=='object')throw new Error('Record choices changed. Try again.');
    const value=raw as Partial<ApiChoicePage>;
    if(!Array.isArray(value.items)||value.items.length>100||!(value.nextAfter===null||typeof value.nextAfter==='string'&&value.nextAfter.length>0&&value.nextAfter.length<=180)||value.items.some(item=>!item||typeof item.id!=='string'||!item.id||item.id.length>180||typeof item.label!=='string'))throw new Error('Record choices changed. Try again.');
    for(const item of value.items)ids.add(item.id);
    if(ids.size>1000)throw new Error('Selection exceeds1000 records. Narrow the filter; your previous selection is unchanged.');
    if(value.nextAfter===null)return [...ids];
    if(!value.items.length||seen.has(value.nextAfter)||value.nextAfter===after)throw new Error('Record choices changed. Try again.');
    seen.add(value.nextAfter);after=value.nextAfter;
  }
  throw new Error('Selection exceeds1000 records. Narrow the filter; your previous selection is unchanged.');
}
