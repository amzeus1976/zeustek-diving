'use client';
export function SkillEvidenceChoice({label,value,options,onChange}:{label:string;value:string;options:readonly string[];onChange:(value:string)=>void}) {
  return <label><span>{label}</span><select value={value} onChange={event=>onChange(event.target.value)}><option value="">Not recorded</option>{value&&!options.includes(value)&&<option value={value}>{value} — saved / from Dive</option>}{options.map(option=><option key={option} value={option}>{option}</option>)}</select></label>;
}
