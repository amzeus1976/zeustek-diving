import type {DiveRecord} from '../offline/dives';
import {diveEquipmentSetIds,diveRuntimeMinutes,normalWaterType} from '../offline/experience-analytics';

export const ANALYSIS_FILTER_FIELDS={
  date:{label:'Dive date',kind:'date'},maxDepthM:{label:'Maximum depth (m)',kind:'number'},durationMin:{label:'Duration (min)',kind:'number'},
  waterType:{label:'Water type',kind:'text'},diveMode:{label:'Dive mode',kind:'text'},diveType:{label:'Dive activity',kind:'text'},
  siteId:{label:'Site',kind:'id'},equipmentSetId:{label:'Equipment set',kind:'id'},operator:{label:'Operator name',kind:'text'},country:{label:'Country',kind:'text'},
} as const;
export type AnalysisFilterField=keyof typeof ANALYSIS_FILTER_FIELDS;
export type AnalysisFilterComparator='equals'|'not-equals'|'contains'|'in'|'gte'|'lte'|'between'|'exists'|'missing';
export type AnalysisFilterPredicate={kind:'predicate';id:string;field:AnalysisFilterField;comparator:AnalysisFilterComparator;value?:string|number|Array<string|number>|null};
export type AnalysisFilterGroup={kind:'group';id:string;operator:'and'|'or';negated?:boolean;children:AnalysisFilterNode[]};
export type AnalysisFilterNode=AnalysisFilterPredicate|AnalysisFilterGroup;
export const comparatorOptions=(field:AnalysisFilterField):AnalysisFilterComparator[]=>{
  const kind=ANALYSIS_FILTER_FIELDS[field].kind;
  return kind==='number'||kind==='date'?['equals','not-equals','gte','lte','between','exists','missing']:
    kind==='id'?['equals','not-equals','in','exists','missing']:['equals','not-equals','contains','in','exists','missing'];
};
const validDate=(value:unknown):value is string=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const stamp=Date.parse(value+'T00:00:00Z');return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===value;
};
export function validateAnalysisFilter(input:unknown):string[]{
  if(input==null)return [];
  const errors:string[]=[];let count=0;
  const walk=(node:unknown,depth:number)=>{
    if(++count>100||depth>6){errors.push('Use at most 100 rules and six group levels.');return;}
    if(!node||typeof node!=='object'){errors.push('Invalid filter rule.');return;}
    const row=node as Record<string,unknown>;
    if(typeof row.id!=='string'||!row.id)errors.push('Each rule needs an identity.');
    if(row.kind==='group'){
      if(!['and','or'].includes(String(row.operator)))errors.push('Choose AND or OR.');
      if(row.negated!==undefined&&typeof row.negated!=='boolean')errors.push('Invalid NOT setting.');
      if(!Array.isArray(row.children)||!row.children.length){errors.push('Add a rule to each group or remove the empty group.');return;}
      for(const child of row.children)walk(child,depth+1);return;
    }
    if(row.kind!=='predicate'||typeof row.field!=='string'||!Object.hasOwn(ANALYSIS_FILTER_FIELDS,row.field)){errors.push('Choose a supported canonical Dive field.');return;}
    const field=row.field as AnalysisFilterField,comparator=row.comparator as AnalysisFilterComparator;
    if(!comparatorOptions(field).includes(comparator)){errors.push('Choose a comparison supported by this field.');return;}
    if(comparator==='exists'||comparator==='missing')return;
    const values=Array.isArray(row.value)?row.value:[row.value],kind=ANALYSIS_FILTER_FIELDS[field].kind;
    if(comparator==='between'&&values.length!==2)errors.push('A range needs two bounds.');
    if(!['between','in'].includes(comparator)&&values.length!==1)errors.push('This comparison needs one value.');
    const valid=values.length>0&&values.every(value=>kind==='number'?typeof value==='number'&&Number.isFinite(value):
      kind==='date'?validDate(value):typeof value==='string'&&value.trim().length>0);
    if(!valid){errors.push('Enter valid '+ANALYSIS_FILTER_FIELDS[field].label.toLowerCase()+' values.');return;}
    if(comparator==='between'&&values[0]!>values[1]!)errors.push('The lower bound must not exceed the upper bound.');
  };
  walk(input,0);return [...new Set(errors)];
}
function valuesFor(dive:DiveRecord,field:AnalysisFilterField):Array<string|number|null|undefined>{
  switch(field){
    case 'date':return [validDate(dive.date)?dive.date:null];
    case 'maxDepthM':return [dive.maxDepthM];
    case 'durationMin':return [diveRuntimeMinutes(dive)];
    case 'waterType':return [normalWaterType(dive.waterType)];
    case 'diveMode':return [dive.diveMode];
    case 'diveType':return dive.diveTypes??[];
    case 'siteId':return [dive.siteId];
    case 'equipmentSetId':return diveEquipmentSetIds(dive);
    case 'operator':return [dive.operator];
    case 'country':return [dive.country];
  }
}
type Truth=boolean|'unknown';
function evaluate(dive:DiveRecord,node:AnalysisFilterNode):Truth{
  if(node.kind==='group'){
    const children=node.children.map(child=>evaluate(dive,child));
    const result:Truth=node.operator==='and'?(children.includes(false)?false:children.includes('unknown')?'unknown':true):
      children.includes(true)?true:children.includes('unknown')?'unknown':false;
    return node.negated&&result!=='unknown'?!result:result;
  }
  const actual=valuesFor(dive,node.field).filter((value):value is string|number=>
    typeof value==='number'?Number.isFinite(value):typeof value==='string'&&value.trim().length>0);
  if(node.comparator==='exists')return actual.length>0;
  if(node.comparator==='missing')return actual.length===0;
  if(!actual.length)return 'unknown';
  const wanted=Array.isArray(node.value)?node.value:[node.value as string|number];
  const normal=(value:string|number)=>ANALYSIS_FILTER_FIELDS[node.field].kind==='text'?String(value).trim().toLocaleLowerCase('en-GB'):value;
  const equal=(a:string|number,b:string|number)=>normal(a)===normal(b);
  switch(node.comparator){
    case 'equals':return actual.some(value=>equal(value,wanted[0]!));
    case 'not-equals':return actual.every(value=>!equal(value,wanted[0]!));
    case 'contains':return actual.some(value=>String(normal(value)).includes(String(normal(wanted[0]!))));
    case 'in':return actual.some(value=>wanted.some(item=>equal(value,item)));
    case 'gte':return actual.some(value=>value>=wanted[0]!);
    case 'lte':return actual.some(value=>value<=wanted[0]!);
    case 'between':return actual.some(value=>value>=wanted[0]!&&value<=wanted[1]!);
  }
}
export function matchesAnalysisFilter(dive:DiveRecord,node:AnalysisFilterNode|null|undefined):boolean{
  return node==null?true:validateAnalysisFilter(node).length?false:evaluate(dive,node)===true;
}
