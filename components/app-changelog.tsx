'use client';
import { version } from '../package.json';
import { appChangelog } from '@/lib/app-changelog';

export function AppVersionLink({ open }: { open: () => void }) {
  return <a className="app-version-link" href="/?section=Changelog" onClick={event => { event.preventDefault(); open(); }} aria-label={`Version ${version}. Open changelog`}>v{version} · Changelog</a>;
}

export function AppChangelog() {
  return <section className="app-changelog" aria-labelledby="app-changelog-title">
    <span className="focus-eyebrow">APP UPDATES</span>
    <h1 id="app-changelog-title">Changelog</h1>
    <p className="focus-copy">Current version: {version}</p>
    {appChangelog.map(release => <article className="focus-card" key={release.version}>
      <h2>v{release.version} — {release.title}</h2>
      <time dateTime={release.date}>{release.date}</time>
      <ul>{release.changes.map(change => <li key={change}>{change}</li>)}</ul>
    </article>)}
  </section>;
}
