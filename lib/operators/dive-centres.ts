import type {OperatorRecord,OperatorService,OperatorType,PersonRecord,Stored} from '../offline/dive-planning';
import {personReferencesOperator} from './operator-dependencies';

export type OperatorDraft=Omit<OperatorRecord,'createdAt'|'modifiedAt'> & {entityId?:string};
export const OPERATOR_TYPES:ReadonlyArray<readonly [OperatorType,string]>=[
  ['dive-centre','Dive centre'],['dive-shop','Dive shop'],['resort','Resort'],['liveaboard','Liveaboard'],
  ['charter-boat','Charter boat'],['club','Club'],['independent-instructor','Independent instructor'],
  ['gas-fill-station','Gas fill station'],['other','Other'],
];
export const OPERATOR_SERVICES:ReadonlyArray<readonly [OperatorService,string]>=[
  ['training','Training'],['equipmentRental','Equipment rental'],['equipmentService','Equipment servicing'],['cylinderTesting','Cylinder testing'],
  ['airFills','Air fills'],['nitroxFills','Nitrox fills'],['trimixFills','Trimix fills'],['oxygenFills','Oxygen fills'],
  ['boatDiving','Boat diving'],['shoreDiving','Shore diving'],['accommodation','Accommodation'],
];
export function linkedOperatorPeople(id:string,people:Stored<PersonRecord>[]){return people.filter(person=>personReferencesOperator(person,id));}
export function safeOperatorUrl(value:string|undefined){
  if(!value?.trim())return null;
  try{const url=new URL(/^[a-z][a-z0-9+.-]*:/i.test(value)?value:'https://'+value.trim());return ['https:','http:'].includes(url.protocol)?url.href:null;}catch{return null;}
}
export function normaliseOperatorDraft(input:OperatorDraft):OperatorDraft {
  if(!input.name.trim())throw new Error('Enter the Dive Centre name.');
  if(input.latitude!=null&&(!Number.isFinite(input.latitude)||Math.abs(input.latitude)>90))throw new Error('Latitude must be between −90 and 90.');
  if(input.longitude!=null&&(!Number.isFinite(input.longitude)||Math.abs(input.longitude)>180))throw new Error('Longitude must be between −180 and 180.');
  for(const [label,value] of [['Website',input.website],['Booking URL',input.bookingUrl]]){
    if(value?.trim()&&!safeOperatorUrl(value))throw new Error(label+' must be a valid HTTP or HTTPS address.');
  }
  return {...input,name:input.name.trim(),...(input.agencies?{agencies:[...new Set(input.agencies.map(a=>a.trim()).filter(Boolean))]}:{})};
}
export function filterDiveCentres(rows:Stored<OperatorRecord>[],filter:{query?:string;type?:string;status?:string;service?:string;favourites?:boolean}){
  const query=filter.query?.trim().toLocaleLowerCase('en-GB')??'';
  return rows.filter(row=>(!filter.type||filter.type==='all'||(row.operatorType??'other')===filter.type)
    &&(!filter.status||filter.status==='all'||(filter.status==='active'?row.active!==false:row.active===false))
    &&(!filter.service||filter.service==='all'||row.services?.[filter.service as OperatorService])
    &&(!filter.favourites||row.favourite)
    &&[row.name,row.tradingName,row.location,row.town,row.region,row.country,row.postcode,row.email,row.phone,...(row.agencies??[])].join(' ').toLocaleLowerCase('en-GB').includes(query))
    .sort((a,b)=>Number(Boolean(b.favourite))-Number(Boolean(a.favourite))||a.name.localeCompare(b.name));
}
