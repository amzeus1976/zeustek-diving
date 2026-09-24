import {describe,expect,it} from 'vitest';
import type {CertificationRecord,PersonRecord} from '../lib/offline/dive-planning';
import {certificationProfileEvidence,resolvePersonDisplayAwards} from '../lib/people/certification-evidence';
import {insightAwardDisplayValues,INSIGHT_AWARD_DEFINITIONS} from '../lib/insights/insight-awards';
import {sourceLabel} from '../lib/offline/people-profiles';

const owner={
  entityId:'owner',name:'Owner',role:'buddy',roles:{ownerProfile:true},
  highestRecreationalCertification:'Rescue Diver',
  manualOverrideFields:['highestRecreationalCertification'],
  agency:'',highestQualification:'',membershipNumber:'',email:'',phone:'',emergencyContact:'',notes:'',createdAt:'',modifiedAt:'',
} as PersonRecord&{entityId:string};

const cert=(title:string,patch:Partial<CertificationRecord>={}):CertificationRecord=>({
  agency:'Test',certification:title,level:'',certificationNumber:'',issuedAt:'2025-01-01',expiresAt:'',
  instructor:'',notes:'',imageKey:'',imageName:'',createdAt:'',modifiedAt:'',courseType:'core',personId:'owner',...patch,
});

describe('canonical display awards',()=>{
  it.each([
    [['Open Water Diver','Advanced Open Water Diver','Rescue Diver','Master Scuba Diver'],'Master Scuba Diver'],
    [['Open Water Diver','Advanced Open Water Diver','Rescue Diver'],'Rescue Diver'],
    [['Open Water Diver','Advanced Open Water Diver'],'Advanced Open Water Diver'],
    [['Open Water Diver'],'Open Water Diver'],
  ])('ranks recreational awards instead of using insertion order: %j', (titles,expected)=>{
    const records=titles.map(title=>cert(title));
    expect(resolvePersonDisplayAwards(owner,records).rec.title).toBe(expected);
    expect(resolvePersonDisplayAwards(owner,[...records].reverse()).rec.title).toBe(expected);
  });

  it('recognises an MSD rating stored as experience or other, but not generic experiences',()=>{
    for(const courseType of ['experience','other'] as const){
      const records=[cert('Rescue Diver'),cert('Master Scuba Diver',{courseType,awardPriority:4}),cert('Discover Scuba Diving',{courseType:'experience',awardPriority:99})];
      const result=resolvePersonDisplayAwards(owner,records);
      expect(result.rec.title).toBe('Master Scuba Diver');
      expect(certificationProfileEvidence(owner,records).highestRecreationalCertification).toBe('Master Scuba Diver');
      expect(certificationProfileEvidence(owner,records).maxAllowedDepthM).toBeNull();
    }
  });

  it('keeps technical and professional evidence out of the recreational award',()=>{
    const result=resolvePersonDisplayAwards(owner,[
      cert('Open Water Diver'),cert('Tec 45',{courseType:'technical'}),cert('Master Instructor',{courseType:'professional'}),
    ]);
    expect(result.rec.title).toBe('Open Water Diver');
    expect(result.tec.title).toBe('Tec 45');
    expect(result.pro.title).toBe('Master Instructor');
  });

  it('respects explicit same-scale ranks, with qualificationRank ahead of awardPriority',()=>{
    const ranked=[cert('Open Water Diver',{qualificationRank:1,awardPriority:99}),cert('Advanced Open Water Diver',{qualificationRank:2})];
    expect(resolvePersonDisplayAwards(owner,ranked).rec.title).toBe('Advanced Open Water Diver');
    const priorities=[cert('Open Water Diver',{awardPriority:5}),cert('Rescue Diver',{awardPriority:3})];
    expect(resolvePersonDisplayAwards(owner,priorities).rec.title).toBe('Open Water Diver');
  });

  it('uses the existing hierarchy consistently when legacy records mix rank scales',()=>{
    const mixed=[cert('Open Water Diver',{awardPriority:99}),cert('Rescue Diver'),cert('Master Scuba Diver',{courseType:'other',awardPriority:4})];
    for(const records of [mixed,[...mixed].reverse(),[mixed[1]!,mixed[2]!,mixed[0]!]]){
      expect(resolvePersonDisplayAwards(owner,records).rec.title).toBe('Master Scuba Diver');
    }
  });

  it('shows current certification evidence and its source without modifying stale owner data',()=>{
    const before=JSON.stringify(owner);
    const records=[cert('Rescue Diver',{awardPriority:3}),cert('Master Scuba Diver',{courseType:'other',awardPriority:4})];
    const result=resolvePersonDisplayAwards(owner,records);
    expect(result.rec).toMatchObject({title:'Master Scuba Diver',source:'auto-certifications'});
    expect(certificationProfileEvidence(owner,records).highestRecreationalCertification).toBe(result.rec.title);
    expect(insightAwardDisplayValues(owner,records).highestRecCert).toBe(result.rec.title);
    expect(sourceLabel(result.rec.source)).toBe('Auto-filled from Certifications');
    expect(INSIGHT_AWARD_DEFINITIONS.find(row=>row[0]==='highestRecCert')?.[1]).toBe('Highest recreational award');
    expect(JSON.stringify(owner)).toBe(before);
  });

  it('falls back to a stored profile value only when canonical evidence is absent',()=>{
    expect(resolvePersonDisplayAwards(owner,[]).rec).toMatchObject({title:'Rescue Diver',source:'owner-entered'});
  });
});
