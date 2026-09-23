import type {CertificationRecord,PersonRecord} from '../offline/dive-planning';
export function personCertificationEvidence(person:Partial<PersonRecord>&{entityId?:string},certifications:CertificationRecord[]){
  return certifications.filter(cert=>cert.personId?cert.personId===person.entityId:Boolean(person.roles?.ownerProfile));
}
function track(cert:CertificationRecord):'rec'|'tec'|'pro'|null{
  if(cert.courseType==='professional')return 'pro';
  if(cert.courseType==='technical')return 'tec';
  if(['specialty','first-aid','experience','other'].includes(cert.courseType??''))return null;
  const text=(cert.certification+' '+cert.level).toLowerCase();
  if(/professional|divemaster|dive master|instructor|course director/.test(text))return 'pro';
  if(/technical|\btec\b|trimix|decompression|extended range|ccr|rebreather/.test(text))return 'tec';
  return 'rec';
}
// Display ordering only. Never infers depth permissions or physiological readiness.
function displayRank(cert:CertificationRecord){
  if(Number.isFinite(cert.qualificationRank))return cert.qualificationRank!;
  const text=(cert.certification+' '+cert.level).toLowerCase();
  if(/course director/.test(text))return 70;
  if(/instructor/.test(text))return 60;
  if(/divemaster|dive master/.test(text))return 50;
  if(/master scuba|dive leader|advanced diver/.test(text))return 40;
  if(/rescue|sports diver/.test(text))return 30;
  if(/advanced open water|advanced adventurer/.test(text))return 20;
  if(/open water|ocean diver/.test(text))return 10;
  return 0;
}
export function certificationProfileEvidence(person:Partial<PersonRecord>&{entityId?:string},certifications:CertificationRecord[]){
  const evidence=personCertificationEvidence(person,certifications);
  const highest=(category:'rec'|'tec'|'pro')=>evidence.filter(cert=>track(cert)===category).sort((a,b)=>displayRank(b)-displayRank(a)||(b.issuedAt||'').localeCompare(a.issuedAt||'')||a.certification.localeCompare(b.certification))[0];
  const rec=highest('rec'),tec=highest('tec'),pro=highest('pro');
  const title=(cert:CertificationRecord|undefined)=>cert?.certification||cert?.level||'';
  const depths=evidence.map(cert=>cert.certifiedDepthM).filter((value):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>0);
  return {highestRecreationalCertification:title(rec),highestTechnicalCertification:title(tec),highestProfessionalCertification:title(pro),highestKnownQualification:title(pro??tec??rec),maxAllowedDepthM:depths.length?Math.max(...depths):null};
}
