import {sharingJson} from '@/lib/server/sharing-access';
import {readonlyApiContract} from '@/lib/sharing/api-contract';
export async function GET(){return sharingJson(readonlyApiContract);}
