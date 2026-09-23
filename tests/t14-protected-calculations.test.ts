import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {calculateEmergencyReserve,selectReserve} from '../lib/offline/recreational-gas-reserve';

describe('T14 frozen calculation boundary',()=>{
  const manifest=JSON.parse(readFileSync('docs/t14/protected-calculations.json','utf8')) as {files:Array<{path:string;workingTreeSha256:string}>};
  for(const file of manifest.files)it(`preserves bytes of ${file.path}`,()=>{
    expect(createHash('sha256').update(readFileSync(file.path)).digest('hex')).toBe(file.workingTreeSha256);
  });
  it('retains the independently checked recreational emergency reserve without extra factors',()=>{
    const result=calculateEmergencyReserve({maxDepthM:30,ownRmvLMin:15,buddyRmvLMin:15,ascentRateMMin:9,safetyStopDepthM:5,safetyStopMin:3,waterType:'salt'});
    expect(result.phases.map(phase=>phase.litres)).toEqual([240,371.25,202.5,46.875]);
    expect(result.totalLitres).toBe(860.625);
    expect(selectReserve(2400,result,'most-conservative').selectedLitres).toBe(860.625);
  });
});
