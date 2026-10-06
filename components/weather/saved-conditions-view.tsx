'use client';
import {memo,useEffect,useState} from 'react';
import {currentDiveAccount} from '../../lib/offline/dive-store';
import {readLocalConditionsEvidence} from '../../lib/weather/local-evidence';
import {readOperatorHistory} from '../../lib/weather/conditions-cache';
import {actualDiveConditions,actualDeviceConditions} from '../../lib/weather/actual-dive-conditions';
import type {ConditionReading,ConditionsSnapshot} from '../../lib/weather/conditions-model';
import {ConditionsView} from './conditions-view';
/** Read-only comparison beside an immutable saved forecast; never updates the Plan. */
export function SavedConditionsView({snapshot}:{snapshot:ConditionsSnapshot}){
 // Resolve the account outside the memo boundary: an account change must never
 // retain another account's comparison evidence.
 const account=currentDiveAccount();
 return <SavedConditionsPanel key={account} snapshot={snapshot} account={account}/>;
}
const SavedConditionsPanel = memo(function SavedConditionsPanel({snapshot,account}:{snapshot:ConditionsSnapshot;account:string}){
 const [now,setNow]=useState(()=>new Date().toISOString());
 const [actual,setActual]=useState<ConditionReading[]>([]);
 const [history,setHistory]=useState<ConditionReading[]>([]);
 useEffect(()=>{const timer=setInterval(()=>setNow(new Date().toISOString()),60000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{let active=true;void Promise.all([readLocalConditionsEvidence(account),readOperatorHistory(account,snapshot.request.siteId)]).then(([evidence,rows])=>{if(active){setActual([...actualDiveConditions(evidence.dives,snapshot.request,snapshot.retrievedAt),...actualDeviceConditions(evidence.dives,evidence.profiles,snapshot.request,snapshot.retrievedAt)]);setHistory(rows);}}).catch(()=>{});return()=>{active=false;};},[account,snapshot]);
 return <ConditionsView snapshot={snapshot} actual={actual} history={history} now={now}/>;
});
