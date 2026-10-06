/** Private presentation metadata. Canonical text remains ordinary plain text. */
export interface PlanTextNode {
  type: 'doc' | 'paragraph' | 'text' | 'hardBreak' | 'bulletList' | 'orderedList' | 'listItem';
  text?: string;
  content?: PlanTextNode[];
  marks?: Array<{type: 'bold' | 'italic' | 'underline'}>;
  attrs?: {start: number};
}
export interface PlanTextDocument extends PlanTextNode {type: 'doc'; version: 1}
export type PlanTextFormats = Record<string, PlanTextDocument | undefined>;
const formattedFields=['aim','goals','secondaryObjectives','notes','conditions.notes',
  ...['keyRisks','mitigations','pressures','stopAbortCriteria','taskLoading','communicationPlan','decisionPoints','lostBuddyPlan','lostGasPlan','surfaceProtocol','overheadPrompt','teamConcerns','reviewNotes'].map(key=>'humanFactors.'+key),
  ...['evacuation','hyperbaricAccessNotes','hyperbaricPathway','notes'].map(key=>'emergency.'+key)];

/** Read only supported keys, so imported extra properties never inflate a draft. */
export function normalisePlanTextFormats(value:unknown):PlanTextFormats|undefined {
  if(!value||typeof value!=='object'||Array.isArray(value))return undefined;
  const result:PlanTextFormats={};
  for(const key of formattedFields){
    const document=safePlanTextDocument((value as Record<string,unknown>)[key]);
    if(document)result[key]=document;
  }
  return result;
}

/** Accept only text, the five requested formats and bounded list structure.
 * Never interpret imported HTML, URL attributes, images or arbitrary nodes. */
export function safePlanTextDocument(value: unknown): PlanTextDocument | null {
  let count = 0, characters = 0;
  const read = (input: unknown, depth: number): PlanTextNode | null => {
    if (++count > 10000 || depth > 16 || !input || typeof input !== 'object') return null;
    const source = input as Record<string, unknown>, type = source.type;
    if (!['doc','paragraph','text','hardBreak','bulletList','orderedList','listItem'].includes(String(type))) return null;
    if (type === 'text') {
      if (typeof source.text !== 'string' || !source.text.length) return null;
      characters += source.text.length;
      if (characters > 100000) return null;
      const marks = source.marks == null ? [] : source.marks;
      if (!Array.isArray(marks) || marks.length > 3 || marks.some(mark => !mark || typeof mark !== 'object' || !['bold','italic','underline'].includes(mark.type))) return null;
      return {type:'text',text:source.text,...(marks.length ? {marks:[...new Set(marks.map(mark=>mark.type))].map(type=>({type}))} : {})};
    }
    if (type === 'hardBreak') return {type:'hardBreak'};
    if (source.content != null && !Array.isArray(source.content)) return null;
    const content: PlanTextNode[] = [];
    for (const child of source.content as unknown[] ?? []) {
      const parsed = read(child, depth + 1);
      if (!parsed) return null;
      content.push(parsed);
    }
    const allowed = type === 'paragraph' ? ['text','hardBreak'] : type === 'bulletList' || type === 'orderedList' ? ['listItem'] : ['paragraph','bulletList','orderedList'];
    if (content.some(child=>!allowed.includes(child.type))) return null;
    if ((type === 'doc' || type === 'listItem') && (!content.length || (type === 'listItem' && content[0]?.type !== 'paragraph'))) return null;
    if ((type === 'bulletList' || type === 'orderedList') && !content.length) return null;
    let start = 1;
    if (type === 'orderedList' && source.attrs && typeof source.attrs === 'object') {
      const requested = (source.attrs as {start?:unknown}).start;
      if (requested != null && (!Number.isSafeInteger(requested) || Number(requested) < 1 || Number(requested) > 10000)) return null;
      start = Number(requested ?? 1);
    }
    return {type:type as PlanTextNode['type'],content,...(type === 'orderedList' ? {attrs:{start}} : {})};
  };
  if (!value || typeof value !== 'object' || (value as {version?:unknown}).version !== 1) return null;
  const result = read(value, 0);
  return result?.type === 'doc' ? {...result,type:'doc',version:1} : null;
}

export function planTextPlain(node: PlanTextNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  return (node.content ?? []).map(planTextPlain).join(node.type === 'paragraph' ? '' : '\n');
}

export function planTextFromPlain(text: string): PlanTextDocument {
  return {version:1,type:'doc',content:text.split('\n').map(line=>({type:'paragraph',content:line ? [{type:'text',text:line}] : []}))};
}

/** Retain all entered text even when presentation metadata exceeds its bounds. */
export function editedPlanText(node: PlanTextNode): {text:string;document:PlanTextDocument|undefined} {
  return {text:planTextPlain(node),document:safePlanTextDocument({...node,version:1}) ?? undefined};
}

/** Metadata from an older draft never styles newly changed plain text. */
export function matchingPlanText(text: string, metadata: unknown): PlanTextDocument | null {
  const document = safePlanTextDocument(metadata);
  return document && planTextPlain(document) === text ? document : null;
}
