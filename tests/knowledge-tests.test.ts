import {describe,expect,it} from 'vitest';
import {chooseQuestions,knowledgeEvidence,parseQuestionSet,scoreQuestion,studyNeeds,type Question,type QuestionSet,type TestAttempt} from '../lib/knowledge-tests';

const question=(overrides:Partial<Question>={}):Question=>({id:'q1',topic:'Equipment',exactTopic:'BCD purpose',type:'single-choice',difficulty:'foundation',prompt:'What is the main purpose of a BCD?',options:['Control buoyancy','Analyse gas','Navigate','Warm the diver'],answers:['Control buoyancy'],explanation:'It changes buoyancy by adding or releasing gas.',incorrectExplanations:{'Analyse gas':'A gas analyser measures oxygen.','Navigate':'A compass supports navigation.','Warm the diver':'Exposure protection provides warmth.'},studySources:['Agency buoyancy chapter'],provenance:'Instructor-authored',...overrides});
const set=(questions:Question[]):QuestionSet=>({format:'zeustek-question-set',schemaVersion:1,setId:'equipment',version:1,title:'Equipment',createdAt:'2026-09-11T00:00:00Z',provenance:'Instructor-authored',reviewed:true,questions});
const attempt=(completedAt:string,correct:boolean,difficulty:Question['difficulty']='foundation'):TestAttempt=>({startedAt:completedAt,completedAt,inputs:{training:[],media:[],plan:[],focus:'Equipment'},correct:Number(correct),total:1,diagnostic:true,questions:[{...question({difficulty}),setId:'equipment',setVersion:1,response:correct?['Control buoyancy']:['Navigate'],correct}]});

describe('knowledge testing',()=>{
  it('accepts rich question metadata but never trusts imported review status',()=>{
    const parsed=parseQuestionSet(set([question()]));
    expect(parsed.reviewed).toBe(false);
    expect(parsed.questions[0]?.exactTopic).toBe('BCD purpose');
  });
  it('scores one-or-many answers as an exact set',()=>{
    const multi=question({type:'multiple-response',options:['A','B','C','D','E','F'],answers:['A','C']});
    expect(scoreQuestion(multi,['C','A'])).toBe(true);
    expect(scoreQuestion(multi,['A'])).toBe(false);
    expect(scoreQuestion(multi,['A','B','C'])).toBe(false);
  });
  it('orders selected questions from easier to harder',()=>{
    const questions=chooseQuestions([set([question({id:'hard',difficulty:'expert'}),question({id:'easy',difficulty:'foundation'})])],['Equipment'],12,()=>0.5);
    expect(questions.map(item=>item.id)).toEqual(['easy','hard']);
  });
  it('replaces an earlier weakness after a correct answer on the same exact topic',()=>{
    const attempts=[attempt('2026-09-10T10:00:00Z',false),attempt('2026-09-11T10:00:00Z',true,'novice')];
    expect(studyNeeds(attempts)).toHaveLength(0);
    expect(knowledgeEvidence(attempts,['Equipment'])[0]).toMatchObject({count:1,correct:1,percent:100});
  });
});
