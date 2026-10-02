import type {PublicationSnapshot} from '@/lib/sharing/public-profile';
/* oxlint-disable next/no-html-link-for-pages -- Native navigation rechecks Sites identity and avoids prefetched public/private root responses. */
/** The exact visitor presentation is also used by the owner's publication preview. */
export function PublicProfileView({snapshot,previewPhotoUrl}:{snapshot:PublicationSnapshot|null;previewPhotoUrl?:string}){
  return <main className="public-profile-view"><a className="public-brand" href="/">ZeusTek Diving</a><section className="public-profile-card">
    {/* oxlint-disable-next-line next/no-img-element -- Opaque revocable derivatives must use their no-store endpoint, without an image optimiser cache. */}
    {snapshot?.photoUrl&&<img className="public-profile-photo" src={previewPhotoUrl??snapshot.photoUrl} width={240} height={240} alt={snapshot.displayName?`${snapshot.displayName} — selected public photograph`:'Selected public photograph'} referrerPolicy="no-referrer"/>}
    <h1>{snapshot?.displayName||'Welcome to ZeusTek Diving'}</h1>
    {snapshot?.biography?<p className="public-biography">{snapshot.biography}</p>:!snapshot&&<p>A private diving logbook and planning workspace.</p>}
    {Boolean(snapshot?.insights.length)&&<dl className="public-insights">{snapshot!.insights.map(item=><div key={item.key}><dt>{item.label}</dt><dd>{item.value} {typeof item.value==='number'?item.unit:''}</dd></div>)}</dl>}
    {snapshot&&<p className="public-profile-source">{snapshot.source} · snapshot {new Date(snapshot.asOf).toLocaleDateString('en-GB')}. Awards describe achievements; they do not grant diving permissions.</p>}
    <a className="focus-primary" href="/signin-with-chatgpt?return_to=%2F">Sign in with ChatGPT</a>
  </section></main>;
}
