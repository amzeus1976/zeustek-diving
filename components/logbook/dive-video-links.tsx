'use client';
import {useState} from 'react';
import type {DiveStory} from '../../lib/offline/dives';
import {normalizeDiveVideoUrl} from '../../lib/logbook/dive-video-links';
export function DiveVideoLinks({links,change}:{links:NonNullable<DiveStory['videoLinks']>;change:(links:NonNullable<DiveStory['videoLinks']>)=>void}) {
 const [url,setUrl]=useState(''),[title,setTitle]=useState(''),[error,setError]=useState('');
 function add(){const normalized=normalizeDiveVideoUrl(url);if(!normalized){setError('Enter a valid HTTPS YouTube video link.');return;}if(links.some(link=>normalizeDiveVideoUrl(link.url)===normalized)){setError('This video is already linked to this Dive.');return;}change([...links,{url:normalized,title:title.trim()||'Dive video'}]);setUrl('');setTitle('');setError('');}
 return <section className="dive-video-links" aria-label="Dive videos"><h3>Dive videos</h3><p>Link your YouTube videos to this Dive. Videos open only when you choose to watch.</p>
  <ul>{links.map((link,index)=>{const safe=normalizeDiveVideoUrl(link.url);return <li key={`${link.url}:${index}`}>{safe?<a className="focus-link" href={safe} target="_blank" rel="noopener noreferrer">{link.title||'Dive video'} · Watch on YouTube</a>:<span>{link.title||'Unavailable video link'}</span>}<button type="button" className="focus-secondary" aria-label={`Remove video ${link.title||index+1}`} onClick={()=>change(links.filter((_,i)=>i!==index))}>Remove link</button></li>;})}</ul>
  <div className="dive-video-fields"><label>YouTube URL<input type="url" value={url} placeholder="https://www.youtube.com/watch?v=…" onChange={event=>{setUrl(event.target.value);setError('');}}/></label><label>Video title (optional)<input value={title} maxLength={180} onChange={event=>setTitle(event.target.value)}/></label><button type="button" className="focus-secondary" onClick={add} disabled={!url.trim()||links.length>=50}>Add video</button></div>
  {error&&<p role="alert">{error}</p>}{links.length>=50&&<p>This Dive has reached its limit of 50 video links.</p>}
 </section>;
}
