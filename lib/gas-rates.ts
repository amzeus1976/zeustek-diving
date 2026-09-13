import type {DiveCylinder,DiveRecord} from './offline/dives';
// https://dan.org/alert-diver/article/estimating-your-air-consumption/
export function calculateGasRates(dive:Pick<DiveRecord,'cylinders'|'averageDepthM'|'totalElapsedMin'>) {
 const cylinders=dive.cylinders??[];
 if(cylinders.length!==1 || cylinders[0]?.configuration!=='Single Tank' || cylinders[0]?.wasSwitchedTo) return {error:'Automatic calculation needs one open-circuit single tank. Multi-cylinder and CCR dives need measured gas-segment data.'};
 const c=cylinders[0]!;const depth=dive.averageDepthM;
 const minutes=dive.totalElapsedMin;
 if(depth==null || depth<0 || !Number.isFinite(depth) || minutes==null || minutes<=0 || !Number.isFinite(minutes))return {error:'Enter average depth and a complete elapsed runtime first.'};
 if(c.startPressureBar==null || c.endPressureBar==null || c.internalVolumeLiters==null || ![c.startPressureBar,c.endPressureBar,c.internalVolumeLiters].every(Number.isFinite) || c.startPressureBar<=c.endPressureBar || c.endPressureBar<0 || c.internalVolumeLiters<=0)return {error:'Enter cylinder volume and valid start/end pressures first.'};
 const sac=(c.startPressureBar-c.endPressureBar)/(minutes*(depth/10+1));
 return {sacPressureBarMin:Math.round(sac*1000)/1000,rmvRate:Math.round(sac*c.internalVolumeLiters*10)/10};
}
export function fillMissingGasRates(dive:Parameters<typeof calculateGasRates>[0]) {
 const result=calculateGasRates(dive);if('error' in result)return {...result,changed:false,cylinders:dive.cylinders??[]};
 let changed=false;
 const cylinders=(dive.cylinders??[]).map(c=>{if(c.sacPressureBarMin!=null && c.rmvRate!=null)return c;changed=true;return {...c,sacPressureBarMin:c.sacPressureBarMin??result.sacPressureBarMin,rmvRate:c.rmvRate??result.rmvRate};});
 return {changed,cylinders,error:undefined};
}
