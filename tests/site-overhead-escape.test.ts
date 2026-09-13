import {describe,expect,it,vi} from 'vitest';
import {handleOverheadEscape} from '../components/site-overhead-profile';

describe('T03 local topmost editor Escape boundary',()=>{
  function fixture(dirty=false){
    let siteOpen=true,editorOpen=true,focus='editor',confirmation=false;
    const closeButton={click:vi.fn(()=>{
      if(dirty){confirmation=true;return;}
      editorOpen=false;focus='launch editor';
    })};
    const dialog={querySelector:()=>closeButton};
    const event={key:'Escape',defaultPrevented:false,target:{closest:()=>dialog},
      currentTarget:{querySelector:()=>editorOpen?dialog:null},
      preventDefault(){this.defaultPrevented=true;},stopPropagation:vi.fn()};
    const escape=()=>{
      handleOverheadEscape(event as unknown as Parameters<typeof handleOverheadEscape>[0]);
      // Native cancel is not dispatched after a prevented keydown. Otherwise the
      // existing read-only Site dialog closes and restores its launch control.
      if(!event.defaultPrevented){siteOpen=false;focus='launch Site';}
    };
    return {event,dialog,closeButton,escape,state:()=>({siteOpen,editorOpen,focus,confirmation})};
  }
  it('closes only the child, restores its launcher, then leaves second Escape to the Site',()=>{
    const f=fixture();expect(f.state()).toMatchObject({siteOpen:true,editorOpen:true});
    f.escape();expect(f.state()).toMatchObject({siteOpen:true,editorOpen:false,focus:'launch editor'});
    expect(f.event.stopPropagation).toHaveBeenCalledOnce();expect(f.closeButton.click).toHaveBeenCalledOnce();
    f.event.defaultPrevented=false;f.escape();
    expect(f.state()).toMatchObject({siteOpen:false,focus:'launch Site'});
  });
  it('routes dirty Escape through the existing Close confirmation instead of silently discarding',()=>{
    const f=fixture(true);f.escape();
    expect(f.state()).toEqual({siteOpen:true,editorOpen:true,focus:'editor',confirmation:true});
    expect(f.event.defaultPrevented).toBe(true);
  });
  it('does not intercept a different topmost dialog or an already handled key',()=>{
    const f=fixture();f.event.target.closest=()=>({...f.dialog});
    f.escape();expect(f.closeButton.click).not.toHaveBeenCalled();
    const handled=fixture();handled.event.defaultPrevented=true;handled.escape();
    expect(handled.closeButton.click).not.toHaveBeenCalled();
  });
});
