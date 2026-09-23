import {workflowDestinationUrl} from '../workflow/workflow-destination';
export function bookingRecordLinks(item:{linkedTripId?:string|null;linkedDivePlanId?:string|null;linkedGasPlanId?:string|null}){
  return ([['Trip','Trips',item.linkedTripId],['Dive Plan','Dive Plans',item.linkedDivePlanId],['Gas Plan','Gas Planning',item.linkedGasPlanId]] as const)
    .flatMap(([label,route,id])=>id?.trim()?[{label,href:'/'+workflowDestinationUrl({route,recordId:id}),destination:workflowDestinationUrl({route,recordId:id})}]:[]);
}
