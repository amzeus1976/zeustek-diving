import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({slots:[] as unknown[],cursor:0,remove:vi.fn()}));
vi.mock('react',async original=>({...await original<typeof import('react')>(),useState:(initial:unknown)=>{const i=state.cursor++;if(!(i in state.slots))state.slots[i]=initial;return [state.slots[i],(next:unknown)=>{state.slots[i]=next;}];}}));
vi.mock('../lib/offline/dive-planning',()=>({removeRecord:state.remove}));
import {DeletePlanningRecordDialog} from '../components/planning/delete-planning-record-dialog';
type Node={type?:unknown;props?:Record<string,unknown>&{children?:unknown}};
function nodes(value:unknown):Node[]{if(Array.isArray(value))return value.flatMap(nodes);if(!value||typeof value!=='object'||!('props' in value))return [];const node=value as Node;return [node,...nodes(node.props?.children)];}
function mount(deleted:()=>Promise<void>,close=vi.fn()) {const render=()=>{state.cursor=0;return nodes(DeletePlanningRecordDialog({record:{entityId:'dummy',name:'Trip'},label:'trip',deleted,close}));};return {close,render,remove:async()=>{const button=render().find(n=>n.type==='button'&&n.props?.children==='Delete trip')!;await (button.props!.onClick as ()=>Promise<void>)();}};}
beforeEach(()=>{state.slots=[];state.cursor=0;state.remove.mockReset();vi.stubGlobal('window',new EventTarget());});
afterEach(()=>vi.unstubAllGlobals());
describe('committed planning deletion versus follow-up failure',()=>{
 it('closes after a committed tombstone even if cleanup fails, with an accurate persistent notice',async()=>{state.remove.mockResolvedValue(undefined);const listener=vi.fn();window.addEventListener('zeustek-operation',listener);const deleted=vi.fn().mockRejectedValue(new Error('PRIVATE cleanup detail')),ui=mount(deleted);await ui.remove();expect(state.remove).toHaveBeenCalledOnce();expect(deleted).toHaveBeenCalledOnce();expect(ui.close).toHaveBeenCalledOnce();expect(listener).toHaveBeenCalledOnce();expect((listener.mock.calls[0]![0] as CustomEvent).detail.message).toMatch(/removed.*refresh/i);expect((listener.mock.calls[0]![0] as CustomEvent).detail.message).not.toContain('PRIVATE');});
 it('keeps the dialog open and preserves the removal error when the tombstone fails',async()=>{state.remove.mockRejectedValue(new Error('Unlink dependencies first'));const deleted=vi.fn(),ui=mount(deleted);await ui.remove();expect(ui.close).not.toHaveBeenCalled();expect(deleted).not.toHaveBeenCalled();expect(ui.render().some(n=>n.props?.role==='alert'&&n.props.children==='Unlink dependencies first')).toBe(true);});
 it('finishes normal deletion once and closes after refresh',async()=>{state.remove.mockResolvedValue(undefined);const deleted=vi.fn().mockResolvedValue(undefined),ui=mount(deleted);await ui.remove();expect(deleted).toHaveBeenCalledOnce();expect(ui.close).toHaveBeenCalledOnce();});
});
