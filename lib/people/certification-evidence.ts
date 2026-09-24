import type {CertificationRecord,PersonRecord} from '../offline/dive-planning';
export function qualificationDisplayPriority(title:string,awardPriority?:number|null){
  if(awardPriority!=null&&Number.isFinite(awardPriority))return awardPriority;
  const value=title.toLowerCase();
  const explicit:Array<[RegExp,number]>=[
    [/course director|instructor trainer/,1000],[/master instructor/,950],[/staff instructor/,900],
    [/master scuba diver trainer|specialty instructor/,850],[/open water scuba instructor|\binstructor\b/,800],
    [/assistant instructor/,750],[/divemaster|dive master/,700],[/advanced trimix|tec 60|mixed gas ccr/,650],
    [/trimix|tec 50|extended range/,620],[/tec 45|decompression procedures|advanced nitrox/,590],
    [/tec 40|intro to tech/,560],[/master scuba diver/,520],[/rescue diver/,480],
    [/advanced open water|advanced diver/,400],[/open water|ocean diver|sports diver/,300],
    [/specialty|deep diver|night diver|wreck diver|nitrox|enriched air/,220],
    [/emergency first response|\befr\b|first aid/,100],
  ];
  return explicit.find(([pattern])=>pattern.test(value))?.[1]??0;
}
export function certificationAwardPriority(certification:CertificationRecord){
  return qualificationDisplayPriority(certification.certification||certification.level,certification.awardPriority);
}
export function personCertificationEvidence(person:Partial<PersonRecord>&{entityId?:string},certifications:CertificationRecord[]){
  return certifications.filter(cert=>cert.personId?cert.personId===person.entityId:Boolean(person.roles?.ownerProfile));
}
type DisplayTrack='rec'|'tec'|'pro';
type DisplayAward={title:string;source:'auto-certifications'|'owner-entered'|'unknown';record?:CertificationRecord};

function track(cert:CertificationRecord):DisplayTrack|null{
  const text=`${cert.certification} ${cert.level}`.toLowerCase();
  if(cert.courseType==='professional'||/professional|divemaster|dive master|instructor|course director|master scuba diver trainer/.test(text))return 'pro';
  if(cert.courseType==='technical'||/technical|\btec\b|trimix|decompression|extended range|ccr|rebreather|advanced nitrox/.test(text))return 'tec';
  // A known recognition/rating can be a recreational DISPLAY award even when
  // its course type is `experience` or `other`. This grants no dive permission.
  const title=(cert.certification||cert.level).trim().replace(/^padi\s+/i,'');
  if(/^(master scuba diver|rescue diver|advanced open water diver|open water diver)$/i.test(title))return 'rec';
  if(['specialty','first-aid','experience','other'].includes(cert.courseType??''))return null;
  return 'rec';
}

function finite(value:number|null|undefined){return typeof value==='number'&&Number.isFinite(value)?value:null;}
function title(cert:CertificationRecord){return (cert.certification||cert.level||'').trim();}
// A track uses an explicit scale only when every candidate shares it. Mixed
// legacy scales fall back to the established hierarchy, so sorting stays stable.
function highestDisplayAward(candidates:CertificationRecord[]){
  const useQualification=candidates.length>0&&candidates.every(cert=>finite(cert.qualificationRank)!==null);
  const usePriority=!useQualification&&candidates.length>0&&candidates.every(cert=>finite(cert.awardPriority)!==null);
  return [...candidates].sort((a,b)=>{
    const explicit=useQualification
      ? finite(b.qualificationRank)!-finite(a.qualificationRank)!
      : usePriority ? finite(b.awardPriority)!-finite(a.awardPriority)! : 0;
    const hierarchy=qualificationDisplayPriority(title(b))-qualificationDisplayPriority(title(a));
    return explicit||hierarchy||(b.issuedAt||'').localeCompare(a.issuedAt||'')||title(a).localeCompare(title(b));
  })[0];
}

/** One read-only resolver for award display; never derives depth or capability. */
export function resolvePersonDisplayAwards(person:Partial<PersonRecord>&{entityId?:string},certifications:CertificationRecord[]){
  const evidence=personCertificationEvidence(person,certifications);
  const resolve=(category:DisplayTrack,field:'highestRecreationalCertification'|'highestTechnicalCertification'|'highestProfessionalCertification'):DisplayAward=>{
    const record=highestDisplayAward(evidence.filter(cert=>track(cert)===category));
    if(record)return {title:title(record),source:'auto-certifications',record};
    const stored=person[field]?.trim()||'';
    const ownerEntered=person.manualOverrideFields?.includes(field)||person.profileValueSources?.[field]==='owner-entered';
    return {title:stored,source:stored&&ownerEntered?'owner-entered':'unknown'};
  };
  return {
    rec:resolve('rec','highestRecreationalCertification'),
    tec:resolve('tec','highestTechnicalCertification'),
    pro:resolve('pro','highestProfessionalCertification'),
  };
}
export function certificationProfileEvidence(person:Partial<PersonRecord>&{entityId?:string},certifications:CertificationRecord[]){
  const evidence=personCertificationEvidence(person,certifications);
  const awards=resolvePersonDisplayAwards(person,certifications);
  const rec=awards.rec.record,tec=awards.tec.record,pro=awards.pro.record;
  const depths=evidence.map(cert=>cert.certifiedDepthM).filter((value):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>0);
  return {highestRecreationalCertification:rec?title(rec):'',highestTechnicalCertification:tec?title(tec):'',highestProfessionalCertification:pro?title(pro):'',highestKnownQualification:pro||tec||rec?title((pro??tec??rec)!):'',maxAllowedDepthM:depths.length?Math.max(...depths):null};
}
