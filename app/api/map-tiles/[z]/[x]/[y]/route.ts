import {env} from 'cloudflare:workers';

type CesiumEndpoint={url?:string;accessToken?:string;externalType?:string;options?:{key?:string;url?:string;mapStyle?:string}};
type TileProvider={url:string;accessToken?:string;subdomains?:string[]};
let endpointCache:{expires:number;value:TileProvider}|null=null;
async function imageryEndpoint(){
  if(endpointCache&&endpointCache.expires>Date.now())return endpointCache.value;
  if(!env.CESIUM_ION_TOKEN)throw new Error('Cesium imagery is not configured.');
  const response=await fetch(`https://api.cesium.com/v1/assets/2/endpoint?access_token=${encodeURIComponent(env.CESIUM_ION_TOKEN)}`,{headers:{accept:'application/json'},signal:AbortSignal.timeout(10_000)});
  if(!response.ok)throw new Error(`Cesium endpoint returned ${response.status}.`);
  const value=await response.json() as CesiumEndpoint;
  let provider:TileProvider|undefined=value.url?{url:value.url,...(value.accessToken?{accessToken:value.accessToken}:{})}:undefined;
  if(value.externalType==='BING'&&value.options?.key){
    const style=value.options.mapStyle||'Aerial';
    const metadata=await fetch(`https://dev.virtualearth.net/REST/v1/Imagery/Metadata/${encodeURIComponent(style)}?output=json&key=${encodeURIComponent(value.options.key)}`,{headers:{accept:'application/json'},signal:AbortSignal.timeout(10_000)});
    if(metadata.ok){const body=await metadata.json() as {resourceSets?:Array<{resources?:Array<{imageUrl?:string;imageUrlSubdomains?:string[]}>}>};const imagery=body.resourceSets?.[0]?.resources?.[0];if(imagery?.imageUrl)provider={url:imagery.imageUrl,...(imagery.imageUrlSubdomains?.length?{subdomains:imagery.imageUrlSubdomains}:{})};}
  }
  if(!provider?.url)throw new Error('Cesium imagery endpoint is unavailable.');
  endpointCache={expires:Date.now()+50*60*1000,value:provider};return provider;
}
function quadkey(x:number,y:number,z:number){let value='';for(let level=z;level>0;level--){const mask=1<<(level-1);let digit=0;if((x&mask)!==0)digit++;if((y&mask)!==0)digit+=2;value+=digit;}return value;}
export async function GET(_request:Request,{params}:{params:Promise<{z:string;x:string;y:string}>}){
  try{
    const {z,x,y}=await params;
    if(!/^\d+$/.test(z)||!/^\d+$/.test(x)||!/^\d+(?:\.[a-z]+)?$/i.test(y))return new Response('Invalid tile',{status:400});
    const endpoint=await imageryEndpoint();
    const tileY=y.replace(/\.[a-z]+$/i,'');
    const zi=Number(z),xi=Number(x),yi=Number(tileY);const subdomain=endpoint.subdomains?.[(xi+yi)%endpoint.subdomains.length]??'';
    let url=endpoint.url.replace('{z}',z).replace('{x}',x).replace('{y}',tileY).replace('{reverseY}',String((2**zi-1)-yi)).replace('{quadkey}',quadkey(xi,yi,zi)).replace('{subdomain}',subdomain);
    if(endpoint.accessToken){const target=new URL(url);target.searchParams.set('access_token',endpoint.accessToken);url=target.toString();}
    const response=await fetch(url,{headers:{accept:'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'},signal:AbortSignal.timeout(12_000)});
    if(!response.ok)return new Response('Tile unavailable',{status:response.status});
    const headers=new Headers({'cache-control':'public, max-age=86400, stale-while-revalidate=604800','content-type':response.headers.get('content-type')||'image/jpeg'});
    return new Response(response.body,{status:200,headers});
  }catch{return new Response('Tile provider unavailable',{status:503});}
}
