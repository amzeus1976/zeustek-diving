'use client';
import {useEffect,useState} from 'react';
import {currentDiveAccount} from '../../lib/offline/dive-store';
interface OwnerReviewPermission {accountId:string;allowed:boolean}
export function ownerReviewAllowedForAccount(permission:OwnerReviewPermission|null,accountId:string){
 return Boolean(accountId)&&permission?.accountId===accountId&&permission.allowed===true;
}
export function useOwnerDataReviewPermission(){
 const [permission,setPermission]=useState<OwnerReviewPermission|null>(null);
 const account=currentDiveAccount();
 useEffect(()=>{let active=true;const controller=new AbortController();
  void fetch('/api/data-review/status',{cache:'no-store',signal:controller.signal}).then(async response=>response.ok&&(await response.json() as {allowed?:unknown}).allowed===true).then(value=>{if(active&&currentDiveAccount()===account)setPermission({accountId:account,allowed:value});}).catch(()=>{if(active)setPermission(null);});
  return()=>{active=false;controller.abort();};
 },[account]);
 return ownerReviewAllowedForAccount(permission,account);
}
