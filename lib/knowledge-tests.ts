import validateQuestionSet from './generated/question-set-v1-validator.js';
import questionSetSchema from '../schemas/question-set-v1.json';

export const QUESTION_DIFFICULTIES = ['foundation','beginner','novice','competent','proficient','advanced','specialist','expert','master','world-class'] as const;
export const KNOWLEDGE_RANKS = ['Unknown','New diver','Foundation','Beginner','Developing','Novice','Competent','Proficient','Advanced','Specialist','Expert','Master','World-class expert'] as const;
export type QuestionDifficulty = typeof QUESTION_DIFFICULTIES[number] | 'introductory' | 'intermediate';
export type QuestionType = 'single-choice'|'multiple-response'|'missing-word'|'diagram-labels'|'scenario-response'|'multiple-choice'|'fill-gap';
export type Question = {
  id:string; topic:string; exactTopic?:string; objective?:string; type:QuestionType; difficulty:QuestionDifficulty;
  prompt:string; options?:string[]; answers:string[]; explanation:string;
  incorrectExplanations?:Record<string,string>; studySources?:string[]; diagramImage?:string; provenance:string;
};
export type QuestionSet = { format:'zeustek-question-set'; schemaVersion:1; setId:string; version:number; title:string; createdAt:string; provenance:string; reviewed:boolean; questions:Question[] };
export type AttemptQuestion = Question & {setId:string;setVersion:number;response:string|string[];correct:boolean};
export type TestAttempt = { startedAt:string; completedAt:string; inputs:{training:string[];media:string[];plan:string[];focus:string}; questions:AttemptQuestion[]; correct:number; total:number; diagnostic:boolean };
export type QuestionReviewStateLike = {setId:string;setVersion:number;questionId:string;usageState:'active'|'suppressed'};
export { questionSetSchema };

const normal=(value:string)=>value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
const unique=(values:string[])=>[...new Set(values.map(normal))].sort();
export function difficultyIndex(value:QuestionDifficulty){
  if(value==='introductory')return 0;
  if(value==='intermediate')return 4;
  return Math.max(0,QUESTION_DIFFICULTIES.indexOf(value));
}
export function difficultyLabel(value:QuestionDifficulty){return value==='world-class'?'World class':value.replace(/(^|-)\w/g,part=>part.toUpperCase()).replace('-',' ');}

function normalizedQuestion(question:Question):Question {
  const type=question.type==='multiple-choice'?'single-choice':question.type==='fill-gap'?'missing-word':question.type;
  return {...question,type,exactTopic:question.exactTopic?.trim()||question.topic,incorrectExplanations:question.incorrectExplanations??{},studySources:question.studySources?.filter(Boolean)??[question.provenance]};
}
export function parseQuestionSet(value:unknown):QuestionSet {
  if(!validateQuestionSet(value))throw new Error(`Invalid question set: ${validateQuestionSet.errors?.slice(0,3).map(e=>`${e.instancePath || '/'} ${e.message}`).join('; ')}`);
  const source=value as QuestionSet;const ids=new Set<string>();
  if(!Number.isFinite(Date.parse(source.createdAt)))throw new Error('Question set creation date is invalid.');
  const questions=source.questions.map(normalizedQuestion);
  for(let index=0;index<questions.length;index++){
    const question=questions[index]!;const importedType=source.questions[index]!.type;
    if(ids.has(question.id))throw new Error(`Duplicate question ID: ${question.id}`);ids.add(question.id);
    if(!question.options?.length||question.answers.some(answer=>!question.options!.includes(answer)))throw new Error(`Question ${question.id} needs options and a matching answer for every correct choice.`);
    const expected=question.type==='multiple-response'?6:4;
    if(importedType!=='multiple-choice'&&importedType!=='fill-gap'&&question.options.length!==expected)throw new Error(`Question ${question.id} needs exactly ${expected} answer choices for ${question.type}.`);
    if(question.type!=='multiple-response'&&question.answers.length!==1)throw new Error(`Question ${question.id} needs exactly one correct answer.`);
  }
  return {...source,reviewed:false,questions};
}
export function scoreQuestion(question:Question,response:string|string[]){
  const selected=Array.isArray(response)?response:[response];
  return unique(selected.filter(Boolean)).join('\u0000')===unique(question.answers).join('\u0000');
}
export const KNOWLEDGE_TOPICS=['Buoyancy','Dive planning','Equipment','Gas management','Decompression','Navigation','Rescue','Marine environment','Technical diving'];
export function relevantTopics(texts:string[],topics:string[]) {
  const context=texts.join(' ').toLowerCase();return topics.filter(topic=>context.includes(topic.toLowerCase())||topic.toLowerCase().split(/[\s-]+/).some(word=>word.length>4&&context.includes(word)));
}
type SelectedQuestion=Question&{setId:string;setVersion:number};
export function reviewedQuestions(sets:QuestionSet[],reviewStates:QuestionReviewStateLike[]=[]):SelectedQuestion[]{
  const suppressed=new Set(reviewStates.filter(row=>row.usageState==='suppressed').map(row=>`${row.setId}|${row.setVersion}|${row.questionId}`));
  return sets.filter(set=>set.reviewed).flatMap(set=>set.questions.map(question=>({...normalizedQuestion(question),setId:set.setId,setVersion:set.version}))).filter(question=>!suppressed.has(`${question.setId}|${question.setVersion}|${question.id}`));
}
export function chooseQuestions(sets:QuestionSet[],topics:string[],count=12,random=()=>crypto.getRandomValues(new Uint32Array(1))[0]!/4294967296,reviewStates:QuestionReviewStateLike[]=[]){
  const pool=reviewedQuestions(sets,reviewStates).filter(question=>!topics.length||topics.includes(question.topic));const groups=new Map<string,typeof pool>();
  for(const question of pool){const list=groups.get(question.topic)??[];list.push(question);groups.set(question.topic,list);}
  const shuffle=<T,>(items:T[])=>{for(let i=items.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[items[i],items[j]]=[items[j]!,items[i]!];}return items;};
  const buckets=shuffle([...groups.values()]).map(items=>shuffle(items).sort((a,b)=>difficultyIndex(a.difficulty)-difficultyIndex(b.difficulty)));const result:typeof pool=[];
  while(result.length<count&&buckets.some(bucket=>bucket.length)){for(const bucket of buckets){const question=bucket.shift();if(question&&result.length<count)result.push(question);}}
  return result.sort((a,b)=>difficultyIndex(a.difficulty)-difficultyIndex(b.difficulty));
}
export function chooseDiagnosticQuestions(sets:QuestionSet[],attempts:TestAttempt[],count=18,reviewStates:QuestionReviewStateLike[]=[]){
  const all=reviewedQuestions(sets,reviewStates);const answered=new Set(attempts.filter(attempt=>attempt.diagnostic).flatMap(attempt=>attempt.questions.map(question=>`${question.topic}\u0000${difficultyIndex(question.difficulty)}`)));
  const ordered=[...all].sort((a,b)=>difficultyIndex(a.difficulty)-difficultyIndex(b.difficulty));
  const selected:SelectedQuestion[]=[];const coveredTopics=new Set<string>();
  for(const question of ordered){if(!coveredTopics.has(question.topic)&&!answered.has(`${question.topic}\u0000${difficultyIndex(question.difficulty)}`)){selected.push(question);coveredTopics.add(question.topic);}}
  for(const question of ordered){if(selected.length>=count)break;const key=`${question.topic}\u0000${difficultyIndex(question.difficulty)}`;if(!answered.has(key)&&!selected.includes(question))selected.push(question);}
  if(!selected.length)return chooseQuestions(sets,[],count,undefined,reviewStates);
  return selected.slice(0,count).sort((a,b)=>difficultyIndex(a.difficulty)-difficultyIndex(b.difficulty));
}
export function diagnosticCoverage(attempts:TestAttempt[],topics:string[]){
  const tested=new Set(attempts.filter(attempt=>attempt.diagnostic).flatMap(attempt=>attempt.questions.map(question=>question.topic)));
  return {tested:[...tested],missing:topics.filter(topic=>!tested.has(topic)),complete:topics.length>0&&topics.every(topic=>tested.has(topic))};
}
function latestByExactTopic(attempts:TestAttempt[]){
  const latest=new Map<string,AttemptQuestion>();
  for(const attempt of [...attempts].sort((a,b)=>a.completedAt.localeCompare(b.completedAt)))for(const question of attempt.questions)latest.set(`${question.topic}\u0000${normal(question.exactTopic||question.topic)}`,question);
  return latest;
}
export function knowledgeEvidence(attempts:TestAttempt[],topics:string[]){
  const latest=[...latestByExactTopic(attempts).values()];
  return topics.map(topic=>{
    const questions=latest.filter(question=>question.topic===topic);const correct=questions.filter(question=>question.correct).length;
    const weight=questions.reduce((sum,question)=>sum+difficultyIndex(question.difficulty)+1,0);const earned=questions.reduce((sum,question)=>sum+(question.correct?difficultyIndex(question.difficulty)+1:0),0);
    const percent=weight?Math.round(earned/weight*100):null;let rankIndex=0;
    if(percent!==null){const performance=Math.max(1,Math.min(KNOWLEDGE_RANKS.length-1,Math.floor(percent/100*(KNOWLEDGE_RANKS.length-1))));const evidenceCap=Math.min(KNOWLEDGE_RANKS.length-1,2+Math.ceil(questions.length/2));const difficultyCap=Math.min(KNOWLEDGE_RANKS.length-1,3+Math.max(0,...questions.filter(q=>q.correct).map(q=>difficultyIndex(q.difficulty))));rankIndex=Math.min(performance,evidenceCap,difficultyCap);}
    return {topic,count:questions.length,correct,percent,rank:KNOWLEDGE_RANKS[rankIndex],attempts:attempts.filter(attempt=>attempt.questions.some(question=>question.topic===topic)).length};
  });
}
export function studyNeeds(attempts:TestAttempt[]){return [...latestByExactTopic(attempts).values()].filter(question=>!question.correct).sort((a,b)=>difficultyIndex(a.difficulty)-difficultyIndex(b.difficulty));}
