import {DatabaseSync} from 'node:sqlite';

export function sharingDatabase() {
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec('CREATE TABLE dive_records (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,data_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER)');
  const prepare=(sql:string,args:unknown[]=[])=>({
    bind:(...values:unknown[])=>prepare(sql,values),
    first:async()=>sqlite.prepare(sql).get(...args as never[])??null,
    all:async()=>({results:sqlite.prepare(sql).all(...args as never[])}),
    run:async()=>{const result=sqlite.prepare(sql).run(...args as never[]);return {meta:{changes:Number(result.changes)}};},
  });
  let transaction:Promise<unknown>=Promise.resolve();
  const db={prepare,batch:(statements:Array<{run:()=>Promise<unknown>}>)=>{
    const work=transaction.catch(()=>{}).then(async()=>{sqlite.exec('BEGIN');try {const result=[];for(const statement of statements)result.push(await statement.run());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}});
    transaction=work;return work;
  }} as unknown as D1Database;
  const add=(id:string,kind:string,data:object,owner='fixture-owner',deleted:number|null=null)=>sqlite.prepare('INSERT INTO dive_records VALUES (?,?,?,?,?,?,?)').run(id,owner,kind,JSON.stringify(data),100,100,deleted);
  const records=()=>sqlite.prepare('SELECT * FROM dive_records ORDER BY id').all();
  return {sqlite,db,add,records};
}

export function sharingBucket() {
  const objects=new Map<string,{bytes:Uint8Array;contentType:string}>();
  const bucket={put:async(key:string,bytes:ArrayBuffer|Uint8Array,options?:{httpMetadata?:{contentType?:string}})=>{objects.set(key,{bytes:new Uint8Array(bytes),contentType:options?.httpMetadata?.contentType??''});},get:async(key:string)=>{const object=objects.get(key);return object?{body:object.bytes,arrayBuffer:async()=>object.bytes.buffer}:null;},delete:async(key:string)=>{objects.delete(key);}} as unknown as R2Bucket;
  return {bucket,objects};
}
