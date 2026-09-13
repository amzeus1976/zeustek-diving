import type {DiveMediaRecord} from './offline/dive-planning';
export function parseMediaRecommendations(value:unknown){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Choose a media recommendations JSON object.');
  const root=value as Record<string,unknown>;const rows=root.mediaRecommendations??root.media;
  if(!Array.isArray(rows)||!rows.length||rows.length>100)throw new Error('Provide between 1 and 100 media recommendations.');
  return rows.map((row,index)=>{
    if(!row||typeof row!=='object'||Array.isArray(row))throw new Error(`Recommendation ${index+1} is invalid.`);
    const text=(key:string,max:number)=>{const value=row[key];if(value==null)return '';if(typeof value!=='string'||value.length>max)throw new Error(`Recommendation ${index+1}: invalid ${key}.`);return value.trim();};
    const title=text('title',500);if(!title)throw new Error(`Recommendation ${index+1} needs a title.`);
    const format=text('format',30)||'other';if(!['book','video','podcast','article','documentary','course','other'].includes(format))throw new Error(`Recommendation ${index+1} has an unsupported format.`);
    const url=text('url',3000);if(url){try{if(!['https:','http:'].includes(new URL(url).protocol))throw new Error();}catch{throw new Error(`Recommendation ${index+1} has an invalid URL.`);}}
    const topics=row.topics??[];if(!Array.isArray(topics)||topics.length>20||topics.some(topic=>typeof topic!=='string'||topic.length>100))throw new Error(`Recommendation ${index+1} has invalid topics.`);
    return {title,format:format as DiveMediaRecord['format'],creator:text('creator',500),url,topics:topics.map(topic=>topic.trim()).filter(Boolean),notes:text('notes',10000),recommendedFor:text('recommendedFor',3000),status:'planned' as const,rating:null};
  });
}
