export class EditorNavigationGuard {
  private active: {request:(action:()=>void)=>void} | null = null;
  register(request:(action:()=>void)=>void) {
    const registration={request};
    this.active=registration;
    return ()=>{if(this.active===registration)this.active=null;};
  }
  get guarded(){return this.active!==null;}
  request(action:()=>void){if(this.active)this.active.request(action);else action();}
}

// Registration occurs only in a mounted client editor, never during server rendering.
export const recordNavigation=new EditorNavigationGuard();
