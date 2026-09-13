"use client";
import { DIVE_SETTING_GROUPS, diveSettingValue, otherSavedDiveSettings } from '@/lib/dive-setting-options';

export function DiveSettingActivity({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  const toggle = (value: string, checked: boolean) => onChange(checked ? [...new Set([...values, value])] : values.filter(item => item !== value));
  const choice = (label: string, value: string) => <label key={value}><input type="checkbox" checked={values.includes(value)} onChange={event => toggle(value, event.target.checked)} />{label}</label>;
  const legacy = otherSavedDiveSettings(values);
  return <div className="dive-setting-groups">
    {DIVE_SETTING_GROUPS.map(group => <fieldset className="dive-setting-group" key={group.title}>
      <legend>{'section' in group && <span>{group.section} · </span>}{group.title}</legend>
      <div className="choice-grid">{group.options.map(option => choice(option, diveSettingValue(group.title, option)))}</div>
    </fieldset>)}
    {legacy.length > 0 && <fieldset className="dive-setting-group"><legend>Other saved tags</legend><p>Kept from this record. Deselect a tag to remove it.</p><div className="choice-grid">{legacy.map(value => choice(value, value))}</div></fieldset>}
  </div>;
}
