import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {IntegrationConsentPicker} from '../components/sharing/integration-consent-picker';
import {PublicProfileSettings} from '../components/sharing/public-profile-settings';
import {apiUsageGuide} from '../lib/sharing/api-guide';
import {API_LABELS,API_RESOURCES} from '../lib/sharing/readonly-api';
describe('compact accessible API and explicit public-profile address',()=>{
  it('renders every enabled resource with an independent minimised panel and preserved selected count',()=>{const selection=Object.fromEntries(API_RESOURCES.map(resource=>[resource,{ids:['dummy-selected'],fields:[]} ]));const before=structuredClone(selection);const html=renderToStaticMarkup(createElement(IntegrationConsentPicker,{selection,change:()=>{},onCollecting:()=>{}}));for(const resource of API_RESOURCES){expect(html).toContain(`Allow ${API_LABELS[resource].replace('&','&amp;')}`);expect(html).toContain(`aria-controls="api-selection-${resource}"`);expect(html).toContain(`id="api-selection-${resource}"`);}expect(html.match(/aria-expanded="false"/g)).toHaveLength(7);expect(html.match(/hidden=""/g)).toHaveLength(7);expect(html).toContain('Select all matching Dives');expect(html).toContain('Select all Equipment fields');expect(html).toContain('Minimise all sections');expect(selection).toEqual(before);});
  it('keeps public publication off and shows its actual canonical URL without hydration-dependent rendering',()=>{const html=renderToStaticMarkup(createElement(PublicProfileSettings));expect(html).toContain('href="/public-profile"');expect(html).toContain('Public visitor page');expect(html).toContain('Full URL:');expect(html).toContain('generic welcome');expect(html).not.toContain('Publish approved public snapshot');});
  it('produces a script-free readable reference with no live credentials or owner fields',()=>{const html=apiUsageGuide();expect(html).toContain('API usage guide');expect(html).toContain('format=json');expect(html).toContain('Gas Plans');expect(html).toContain('Select all matching');expect(html).not.toMatch(/<script|<input|ZT1\.[a-f0-9-]{36}\.[a-f0-9]{64}|fixture-owner/);});
});
