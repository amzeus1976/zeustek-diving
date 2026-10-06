import {normalisePlanTextFormats,type PlanTextFormats} from './formatted-text';
import {packConditionsRecord} from '../weather/conditions-storage';

/** Called once on the complete merged record at Save, never during typing.
 * Matches the existing API's 200000 JSON-character limit after weather packing.
 * Presentation must never introduce an oversized record; canonical text stays exact. */
export function fitPlanTextForSync<T extends Record<string,unknown>>(record:T):{record:Omit<T,'textFormatting'>&{textFormatting?:PlanTextFormats};formattingReduced:boolean} {
  const {textFormatting:incoming,...plain}=record;
  if(!Object.hasOwn(record,'textFormatting'))return {record:plain,formattingReduced:false};
  const formatting=normalisePlanTextFormats(incoming);
  if(!formatting||!Object.keys(formatting).length)return {record:plain,formattingReduced:false};
  const candidate={...plain,textFormatting:formatting};
  try{
    if(JSON.stringify(packConditionsRecord('trip',candidate)).length<=200000)return {record:candidate,formattingReduced:false};
    if(JSON.stringify(packConditionsRecord('trip',plain)).length<=200000)return {record:plain,formattingReduced:true};
  }catch{/* Existing invalid weather is retained for the normal sync review flow. */}
  // If canonical data itself cannot fit, retain its formatting too. Normal local
  // Save and cloud review still preserve that existing oversized record.
  return {record:candidate,formattingReduced:false};
}
