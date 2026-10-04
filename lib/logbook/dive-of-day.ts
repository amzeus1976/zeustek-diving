type DiveDayInput={entityId:string;date:string;timeIn?:string|undefined;diveNumber?:number|undefined};
export interface DiveDayNumber {number:number|null;label:string;provisional:boolean}
const unknown=():DiveDayNumber=>({number:null,label:'—',provisional:true});
function exactDay(date:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
  const instant=new Date(date+'T12:00:00Z');
  return Number.isFinite(instant.getTime())&&instant.toISOString().slice(0,10)===date;
}
function seconds(time?:string){
  if(!time||!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time))return null;
  const [hour,minute,second=0]=time.split(':').map(Number);
  return hour!*3600+minute!*60+second;
}

/** Pure presentation sequence. Never persists a field or invokes lifetime numbering/repair. */
export function deriveDiveDayNumbers(dives:readonly DiveDayInput[]):Map<string,DiveDayNumber>{
  const result=new Map<string,DiveDayNumber>(),days=new Map<string,DiveDayInput[]>();
  for(const dive of new Map(dives.map(row=>[row.entityId,row])).values()){
    if(!exactDay(dive.date)){result.set(dive.entityId,unknown());continue;}
    const group=days.get(dive.date)??[];group.push(dive);days.set(dive.date,group);
  }
  for(const group of days.values()){
    const times=group.map(row=>seconds(row.timeIn));
    const provisional=times.some(time=>time===null)||new Set(times).size!==times.length;
    group.sort((a,b)=>(seconds(a.timeIn)??Infinity)-(seconds(b.timeIn)??Infinity)||
      (a.diveNumber??Infinity)-(b.diveNumber??Infinity)||a.entityId.localeCompare(b.entityId));
    group.forEach((row,index)=>result.set(row.entityId,{number:index+1,label:String(index+1).padStart(2,'0'),provisional}));
  }
  return result;
}

export function previewDiveOfDay(draft:Omit<DiveDayInput,'entityId'>&{entityId?:string|undefined},dives:readonly DiveDayInput[]):DiveDayNumber{
  const entityId=draft.entityId??'\uffff-unsaved-dive';
  const candidate={...draft,entityId};
  return deriveDiveDayNumbers([...dives.filter(row=>row.entityId!==entityId),candidate]).get(entityId)??unknown();
}
