'use client';
import {useEffect,useRef,useState} from 'react';
import type {DiveHeatPoint} from '@/lib/dive-heat';
import type {DiveSiteRecord,Stored} from '@/lib/offline/dive-planning';

let leafletLoading: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if (leafletLoading) return leafletLoading;
  const stylesheet = new Promise<void>((resolve,reject)=>{
    const style=document.createElement('link');style.rel='stylesheet';style.href='/vendor/leaflet/leaflet.css';document.head.appendChild(style);
    style.onload=()=>resolve();style.onerror=()=>{style.remove();reject(new Error('Map styles could not load. Please retry.'));};
  });
  const library = new Promise<any>((resolve,reject)=>{
    if((window as any).L){resolve((window as any).L);return;}
    const script=document.createElement('script');script.src='/vendor/leaflet/leaflet.js';
    script.onload=()=>resolve((window as any).L);script.onerror=()=>{leafletLoading=null;script.remove();reject(new Error('The map could not load. Your sites remain available in the site selector.'));};
    document.head.appendChild(script);
  });
  leafletLoading=Promise.all([stylesheet,library]).then(([,L])=>L).catch(error=>{leafletLoading=null;throw error;});
  return leafletLoading;
}
export function InteractiveDiveSiteMap({sites,bucketIds,onSelect,heatPoints}:{heatPoints?:DiveHeatPoint[];sites:Array<Stored<DiveSiteRecord>>;bucketIds:ReadonlySet<string>;onSelect:(site:Stored<DiveSiteRecord>)=>void}){
  const container=useRef<HTMLDivElement>(null);const map=useRef<any>(null);const layer=useRef<any>(null);const fitOnce=useRef(false);
  const [ready,setReady]=useState(false);const [error,setError]=useState('');
  const [tileError,setTileError]=useState(false);const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let cancelled=false;
    void loadLeaflet().then(L=>{
      if(cancelled||!container.current)return;
      map.current=L.map(container.current,{scrollWheelZoom:true,zoomAnimation:false,markerZoomAnimation:false}).setView([20,0],2);
      let failed=false;let switched=false;
      const cesium=()=>L.tileLayer('/api/map-tiles/{z}/{x}/{y}',{maxZoom:18,attribution:'Imagery © Cesium ion data providers'}).on('tileerror',()=>setTileError(true)).on('load',()=>setTileError(false));
      const osm=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,referrerPolicy:'strict-origin-when-cross-origin',attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'})
        .on('loading',()=>{failed=false;})
        .on('tileerror',()=>{failed=true;if(!switched&&map.current){switched=true;map.current.removeLayer(osm);cesium().addTo(map.current);}})
        .on('load',()=>{if(!switched)setTileError(failed);}).addTo(map.current);
      layer.current=L.layerGroup().addTo(map.current);setReady(true);
      const resize=new ResizeObserver(()=>map.current?.invalidateSize());resize.observe(container.current);
      (map.current as any).zeustekResize=resize;
    }).catch(reason=>setError(reason.message));
    return()=>{cancelled=true;map.current?.zeustekResize?.disconnect();map.current?.remove();map.current=null;};
  },[retry]);
  useEffect(()=>{
    if(!ready||!map.current)return;const L=(window as any).L;
    if(heatPoints){
      layer.current.clearLayers();
      if(heatPoints.length)map.current.fitBounds(heatPoints.map(point=>[point.latitude,point.longitude]),{padding:[45,45],maxZoom:11});
      for(const point of heatPoints){
        const level=point.count>=10?'high':point.count>=5?'medium':point.count>=2?'low':'single';
        const icon=L.divIcon({className:`dive-count-marker ${level}`,html:`<span class="dive-count-disc">${point.count}</span>`,iconSize:[48,48],iconAnchor:[24,24]});
        const label=`${point.name}: ${point.count} logged dive${point.count===1?'':'s'}`;
        const marker=L.marker([point.latitude,point.longitude],{icon,title:label,alt:label,keyboard:true}).addTo(layer.current);
        marker.bindTooltip(label);
        const linked=sites.find(site=>site.latitude===point.latitude&&site.longitude===point.longitude)??sites.find(site=>site.name.trim().toLowerCase()===point.name.trim().toLowerCase());
        if(linked)marker.on('click',()=>onSelect(linked));
      }
      return;
    }
    const valid=sites.filter(site=>site.latitude!=null&&site.longitude!=null&&Number.isFinite(site.latitude)&&Number.isFinite(site.longitude)&&Math.abs(site.latitude)<=90&&Math.abs(site.longitude)<=180);
    const bounds=valid.map(site=>[site.latitude!,site.longitude!] as [number,number]);
    if(!fitOnce.current&&bounds.length){map.current.fitBounds(bounds,{padding:[28,28],maxZoom:11});fitOnce.current=true;}
    const currentMap=map.current;
    const draw=()=>{
      layer.current.clearLayers();
      const groups=new Map<string,typeof valid>();
      for(const site of valid){const p=currentMap.project([site.latitude,site.longitude],currentMap.getZoom());const key=`${Math.floor(p.x/56)}:${Math.floor(p.y/56)}`;const group=groups.get(key)??[];group.push(site);groups.set(key,group);}
      for(const group of groups.values()){
      if(group.length>1){
        const points=group.map(site=>[site.latitude!,site.longitude!]);
        const center=L.latLngBounds(points).getCenter();
        const icon=L.divIcon({className:'zeustek-map-cluster',html:`<span class="cluster-count">${group.length}</span>`,iconSize:[44,44],iconAnchor:[22,22]});
        const marker=L.marker(center,{icon,title:`${group.length} dive sites — zoom in`,alt:`${group.length} dive sites`,keyboard:true}).addTo(layer.current);
        marker.on('click',()=>{if(currentMap.getZoom()<18){currentMap.fitBounds(points,{padding:[40,40],maxZoom:Math.min(18,currentMap.getZoom()+3)});}else{const list=document.createElement('div');list.className='map-cluster-sites';for(const site of group){const button=document.createElement('button');button.textContent=site.name;button.onclick=()=>onSelect(site);list.appendChild(button);}marker.bindPopup(list).openPopup();}});
        continue;
      }
      const site=group[0]!;
      const point:[number,number]=[site.latitude!,site.longitude!];
      const bucket=bucketIds.has(site.entityId);const label=`${bucket?'Bucket list: ':''}${site.name}`;
      const icon=L.divIcon({className:'zeustek-map-marker',html:bucket?'<span class="bucket-marker" aria-hidden="true">★</span>':'<span class="site-marker-dot" aria-hidden="true"></span>',iconSize:[44,44],iconAnchor:[22,22]});
      const marker=L.marker(point,{icon,title:label,alt:label,keyboard:true}).addTo(layer.current);
      const tooltip=document.createElement('span');tooltip.textContent=label;marker.bindTooltip(tooltip);
      marker.on('click',()=>onSelect(site));
      }
    };
    draw();currentMap.on('zoomend',draw);
    return()=>{currentMap.off('zoomend',draw);};
  },[sites,bucketIds,onSelect,ready,heatPoints]);
  return <>{(error||tileError)&&<p role="status">{error||'Some map tiles could not load. Your site markers and saved details remain available.'} <button className="secondary" onClick={()=>{setReady(false);setError('');setTileError(false);fitOnce.current=false;setRetry(value=>value+1);}}>Retry map</button></p>}<div ref={container} className="interactive-google-map" aria-label={heatPoints ? "Logged dive locations: pan, zoom or select a numbered marker" : "Dive sites: pan, zoom or select a marker"}/><small>Online map · Site details are also saved for offline use.</small></>;
}
