import {getChatGPTUser} from '../../../chatgpt-auth';
export async function GET(){
 if(!await getChatGPTUser())return Response.json({error:'Authentication required'},{status:401});
 return Response.json({defaultProvider:'open-meteo',providers:[{id:'open-meteo',label:'Open-Meteo atmospheric + marine',enabled:true},{id:'met-office',label:'Met Office DataHub',enabled:false,reason:'A verified server-side provider configuration is required.'}]},{headers:{'Cache-Control':'no-store'}});
}
