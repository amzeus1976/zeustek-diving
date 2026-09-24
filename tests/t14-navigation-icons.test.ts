import {describe,expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {WORKFLOW_ROUTES} from '../lib/workflow/workflow-model';
import {NAVIGATION_ICONS,navigationIconForRoute} from '../lib/brand/navigation-icons';

const root=new URL('../',import.meta.url);
const file=(path:string)=>new URL(path,root);
const expected:Record<string,string>={
  Overview:'overview.png',Insights:'insights.png',Equipment:'equipment.png','Loadouts & Gas':'loadouts.png',
  'Cylinders & Gas':'cylinders_and_gas.png','Gear Wishlist':'gear_wishlist.png',Logbook:'logbook.png',
  'Dive Computer Imports':'dive_computer_imports.png',Sites:'sites.png','Dive Site Map':'dive_location_map.png',
  People:'people.png','Dive Centres':'dive_centres.png',Albums:'albums.png',
  'Diving Calendar & Bookings':'diving_calendar_and_bookings.png',Trips:'trips_and_expeditions.png',
  'Dive Bucket List':'bucket_list.png','Dive Plans':'dive_planning_centre.png','Gas Planning':'gas_planning.png',
  Training:'certifications.png','Course Map':'planned_training.png','Skills & Currency':'dive_skills.png',
  'Technical Diving':'technical_diving.png','Conservation & AWARE':'conservation_and_aware.png',
  'Dive Knowledge':'dive_knowledge.png','Dive Media':'dive_bibliography.png','Dive News':'dive_news.png',
  'Professional Development':'professional_development.png',Admin:'site_logs.png',Settings:'site_configuration.png',
  'Data & Backups':'data_and_backups.png','Diver Summary Export':'diver_summary_export.png',
};

describe('31 supplied navigation artworks',()=>{
  it('covers every current route once, with the exact approved individual artwork',()=>{
    expect(WORKFLOW_ROUTES).toHaveLength(31);
    expect(Object.keys(NAVIGATION_ICONS).sort()).toEqual(WORKFLOW_ROUTES.map(route=>route.route).sort());
    expect(new Set(Object.values(NAVIGATION_ICONS).map(icon=>icon.src)).size).toBe(31);
    for(const [route,name] of Object.entries(expected))expect(navigationIconForRoute(route)?.src).toBe(`/brand/icons/navigation/${name}`);
    expect(navigationIconForRoute('Insights')?.src).toMatch(/insights\.png$/);
    expect(navigationIconForRoute('People')?.src).toMatch(/people\.png$/);
    expect(navigationIconForRoute('Dive Centres')?.src).toMatch(/dive_centres\.png$/);
    expect(WORKFLOW_ROUTES.find(route=>route.route==='People')?.label).toBe('People');
  });
  it('retains byte-identical masters and loads only 128px alpha PNG derivatives in navigation',()=>{
    for(const icon of Object.values(NAVIGATION_ICONS)){
      expect(icon.masterPath.startsWith('assets/navigation-icons/master/')).toBe(true);
      expect(existsSync(file(icon.masterPath))).toBe(true);
      expect(existsSync(file(`public${icon.src}`))).toBe(true);
      const master=readFileSync(file(icon.masterPath));
      const runtime=readFileSync(file(`public${icon.src}`));
      expect(master.subarray(16,24).readUInt32BE(0)).toBe(1254);
      expect(master.subarray(16,24).readUInt32BE(4)).toBe(1254);
      expect(runtime.subarray(16,24).readUInt32BE(0)).toBe(128);
      expect(runtime.subarray(16,24).readUInt32BE(4)).toBe(128);
      expect(master[25]).toBe(6);
      expect(runtime[25]).toBe(6);
      expect(createHash('sha256').update(master).digest('hex')).toBe(icon.masterSha256);
      expect(runtime.length).toBeLessThan(master.length);
    }
    const vite=readFileSync(file('vite.config.ts'),'utf8');
    expect(vite).not.toContain('assets/navigation-icons/master');
  });
});
