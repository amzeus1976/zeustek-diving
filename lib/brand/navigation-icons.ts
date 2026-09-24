import manifest from './navigation-icon-manifest.json';

export type NavigationIcon={route:string;src:string;masterPath:string;masterSha256:string;scale:number;key:string;label:string};

/** Owner-approved route artwork. Domain icons and vector UI controls keep their existing registries. */
export const NAVIGATION_ICONS=Object.fromEntries(manifest.map(entry=>[entry.route,{
  ...entry,key:`navigation-${entry.route}`,label:entry.route,
}])) as Record<string,NavigationIcon>;

export function navigationIconForRoute(route:string){return NAVIGATION_ICONS[route]??null;}
