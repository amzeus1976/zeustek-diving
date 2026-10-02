import {env} from 'cloudflare:workers';
import {serveApi,methodNotAllowed} from '@/lib/server/readonly-api';
export const GET=(request:Request)=>serveApi(env.DB,request,'equipment-usage');
export const HEAD=GET;
export const POST=methodNotAllowed;
export const PUT=methodNotAllowed;
export const PATCH=methodNotAllowed;
export const DELETE=methodNotAllowed;
export const OPTIONS=methodNotAllowed;
