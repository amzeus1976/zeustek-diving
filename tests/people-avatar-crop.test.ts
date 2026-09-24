import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {moveCrop,zoomCrop,resetCrop} from '../lib/people/avatar-crop';
import {PersonAvatar,ProfilePicture} from '../components/profile-picture';

describe('Person avatar crop',()=>{
  const image={attachmentId:'portrait',zoom:1.5,x:50,y:50};
  it('clamps drag and zoom within a filled circular crop',()=>{
    expect(moveCrop(image,1000,-1000,160)).toMatchObject({x:0,y:100});
    expect(zoomCrop(image,10).zoom).toBe(3);
    expect(zoomCrop(image,-10).zoom).toBe(1);
    expect(resetCrop(image)).toMatchObject({x:50,y:50,zoom:1});
  });
  it('provides a circular preview and explicit crop controls for current and legacy images',()=>{
    const html=renderToStaticMarkup(createElement(ProfilePicture,{value:image,legacyId:'old',change:()=>{},removeLegacy:()=>{}}));
    expect(html).toContain('Save Crop');
    expect(html).toContain('Cancel');
    expect(html).toContain('Reset');
    expect(html).toContain('Replace');
    expect(html).toContain('Zoom');
    expect(html).toContain('aria-label="Circular crop preview"');
  });
  it('renders the legacy media ID inside the same circular viewport without a data rewrite',()=>{
    const html=renderToStaticMarkup(createElement(PersonAvatar,{image:null,legacyId:'legacy-photo',label:'Alex profile'}));
    expect(html).toContain('person-avatar-viewport');
    expect(html).toContain('/api/media?id=legacy-photo');
    expect(html).toContain('Alex profile');
  });
});
