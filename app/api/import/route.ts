import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';

const allowed = new Set(['application/zip','application/json','text/csv','text/xml','application/xml','application/pdf','text/plain','image/jpeg','image/png','image/webp','image/heic','image/heif']);
async function ensureSchema(){await env.DB.prepare(`CREATE TABLE IF NOT EXISTS imports (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, category TEXT NOT NULL,
  file_name TEXT NOT NULL, object_key TEXT NOT NULL, content_type TEXT NOT NULL,
  size INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'uploaded', created_at INTEGER NOT NULL
)`).run();await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_imports_user_created ON imports(user_id, created_at DESC)').run()}
export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:'Authentication required'},{status:401});
  const form=await request.formData();const file=form.get('file');if(!(file instanceof File))return Response.json({error:'File required'},{status:400});
  if(file.size>25*1024*1024)return Response.json({error:'Maximum file size is 25 MB'},{status:413});
  const type=file.type||'application/octet-stream';if(!allowed.has(type)&&!file.name.toLowerCase().match(/\.(zip|json|har|csv|xml|pdf|txt|jpg|jpeg|png|webp|heic)$/))return Response.json({error:'Unsupported file type'},{status:415});
  const category=form.get('category')==='dive'?'dive':'journal';const id=crypto.randomUUID();const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-120);const key=`imports/${user.userId}/${id}-${safe}`;
  await env.FILES.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:type},customMetadata:{userId:user.userId,category,originalName:file.name}});await ensureSchema();
  await env.DB.prepare('INSERT INTO imports (id,user_id,category,file_name,object_key,content_type,size,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,user.userId,category,file.name,key,type,file.size,'uploaded',Date.now()).run();
  return Response.json({id,fileName:file.name,category,status:'uploaded'},{status:201});
}
