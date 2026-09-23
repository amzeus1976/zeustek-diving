import {type WeatherProviderAdapter,type WeatherProviderId,type WeatherRequest} from './provider-contract';
import type {PlannedWeatherResponse} from '../plan-weather';
/** The provider adapter calls the authenticated server boundary; it never receives credentials. */
export function weatherProvider(id:WeatherProviderId):WeatherProviderAdapter {
 return {id,async forecast(request:WeatherRequest,signal?:AbortSignal){
  const params=new URLSearchParams({latitude:String(request.latitude),longitude:String(request.longitude),date:request.date,time:request.time,provider:id});
  if(request.mode==='seasonal')params.set('planning','seasonal');
  if(request.marine)params.set('marine','true');
  const response=await fetch(`/api/site-weather?${params}`,{cache:'no-store',...(signal?{signal}:{})});
  const data=await response.json() as PlannedWeatherResponse;
  if(!response.ok)throw new Error(data.error||`Weather provider unavailable (${response.status}).`);
  return data;
 }};
}
