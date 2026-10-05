'use client';
import {useCallback,useEffect,useState} from 'react';
import {CloudAlert,CloudCheck,CloudOff} from 'lucide-react';
import {currentDiveAccount} from '../lib/offline/dive-store';
import {readCloudAccountStatus} from '../lib/offline/read-cloud-account-status';
import {cloudAccountIndicator,type CloudIndicatorInput} from '../lib/offline/cloud-account-indicator';
export function CloudAccountStatus(){
 const [input,setInput]=useState<CloudIndicatorInput>({account:true,online:true,loaded:false,pending:0,conflicts:0,error:false});
 const refresh=useCallback(async()=>{const owner=currentDiveAccount();try{const next=await readCloudAccountStatus();if(currentDiveAccount()===owner)setInput(next);}catch{if(currentDiveAccount()===owner)setInput({account:Boolean(owner),online:navigator.onLine,loaded:false,pending:0,conflicts:0,error:true});}},[]);
 useEffect(()=>{let active=true;const update=()=>{if(active)void refresh();};update();window.addEventListener('zeustek-cloud-sync',update);window.addEventListener('zeustek-records-updated',update);window.addEventListener('online',update);window.addEventListener('offline',update);const timer=setInterval(update,5000);return()=>{active=false;clearInterval(timer);window.removeEventListener('zeustek-cloud-sync',update);window.removeEventListener('zeustek-records-updated',update);window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[refresh]);
 const indicator=cloudAccountIndicator(input),Icon=indicator.state==='synced'?CloudCheck:indicator.state==='disabled'?CloudOff:CloudAlert;
 return <span className={`cloud-account-badge ${indicator.state}`} title={indicator.label} aria-label={indicator.label}><Icon size={14} aria-hidden="true"/><b>Cloud account</b><span className="sr-only"> · {indicator.label.split(' · ')[1]}</span></span>;
}
