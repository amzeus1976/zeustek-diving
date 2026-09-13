import {describe,it,expect} from 'vitest';
import {elapsedRuntime,normaliseMyMaps} from '../lib/dive-record-details';
import {canonicalUrl,groupNewsStories,recordIdentity} from '../lib/record-identity';
import {parseMediaRecommendations} from '../lib/media-import';
import {parseQuestionSet,chooseQuestions,scoreQuestion,knowledgeEvidence,type QuestionSet} from '../lib/knowledge-tests';

const bank:QuestionSet={format:'zeustek-question-set',schemaVersion:1,setId:'synthetic-test-bank',version:1,title:'Software test fixture',createdAt:'2026-09-07',provenance:'Synthetic software test: not diving instruction',reviewed:true,questions:Array.from({length:12},(_,index)=>({id:`q${index}`,topic:index%2?'Equipment':'Buoyancy',type:'multiple-choice' as const,difficulty:'introductory' as const,prompt:`Select the fixture answer for example ${index}`,options:['Fixture answer','Other example'],answers:['Fixture answer'],explanation:'Synthetic example',provenance:'Software fixture'}))};
describe('issue register data rules',()=>{
  it('calculates elapsed times including midnight and leaves missing or invalid times unknown',()=>{
    expect(elapsedRuntime('09:12','10:03')).toBe(51);
    expect(elapsedRuntime('23:40','00:30')).toBe(50);
    expect(elapsedRuntime('24:00','01:00')).toBeNull();
    expect(elapsedRuntime('09:00','')).toBeNull();
  });
  it('accepts My Maps IDs and share links while rejecting unrelated URLs',()=>{
    expect(normaliseMyMaps('https://www.google.com/maps/d/u/0/viewer?mid=abc1234567890')).toBe('https://www.google.com/maps/d/embed?mid=abc1234567890');
    expect(normaliseMyMaps('abc1234567890')).toContain('mid=abc1234567890');
    expect(()=>normaliseMyMaps('https://example.com/maps/d/viewer?mid=abc1234567890')).toThrow();
  });
  it('removes tracking but preserves meaningful URL parameters in duplicate detection',()=>{
    expect(canonicalUrl('https://example.com/story?id=1&utm_source=x#top')).toBe('https://example.com/story?id=1');
    expect(recordIdentity('dive-media',{url:'https://example.com/story?id=1'})).not.toBe(recordIdentity('dive-media',{url:'https://example.com/story?id=2'}));
  });
  it('groups matching stories with all sources and keeps different events separate',()=>{
    const title='A sufficiently specific common example headline';
    const stories=groupNewsStories([{title,source:'A',link:'https://example.com/one',summary:'',publishedAt:'2026-09-07'},{title,source:'B',link:'https://example.org/two',summary:'',publishedAt:'2026-09-08'},{title,source:'C',link:'https://example.net/three',summary:'',publishedAt:'2025-01-01'}]);
    expect(stories).toHaveLength(2);expect(stories[0]?.sources).toHaveLength(2);
  });
  it('groups differently worded reports about the same identifiable incident',()=>{
    const stories=groupNewsStories([
      {title:'Diver Injured After Diving Cylinder Failure Aboard Boat Off Procida',source:'A',link:'https://example.com/procida-one',summary:'',publishedAt:'2026-09-09'},
      {title:'Scuba diver seriously by exploding tank off Procida, Italy',source:'B',link:'https://example.org/procida-two',summary:'',publishedAt:'2026-09-10'},
      {title:'Diving cylinder failure investigated at a training centre in London',source:'C',link:'https://example.net/london',summary:'',publishedAt:'2026-09-10'},
    ]);
    expect(stories).toHaveLength(2);expect(stories[0]?.sources).toHaveLength(2);
  });
  it('validates every recommendation before importing any',()=>{
    expect(()=>parseMediaRecommendations({mediaRecommendations:[{title:'Good',format:'book'},{title:'Bad',url:'javascript:alert(1)'}]})).toThrow('invalid URL');
    expect(()=>parseMediaRecommendations({mediaRecommendations:[]})).toThrow();
  });
});
describe('knowledge assessment',()=>{
  it('requires user review of imported banks and rejects duplicate or invalid answers',()=>{
    expect(parseQuestionSet(bank).reviewed).toBe(false);
    expect(()=>parseQuestionSet({...bank,questions:[bank.questions[0],bank.questions[0]]})).toThrow('Duplicate question ID');
    expect(()=>parseQuestionSet({...bank,questions:[{...bank.questions[0],answers:['Missing option']}]})).toThrow('matching answer');
    expect(()=>parseQuestionSet({...bank,questions:[{...bank.questions[0],provenance:''}]})).toThrow();
  });
  it('samples across areas without repeated question IDs and excludes unreviewed banks',()=>{
    expect(chooseQuestions([{...bank,reviewed:false}],[],6)).toEqual([]);
    const sample=chooseQuestions([bank],[],6,()=>0.4);
    expect(sample).toHaveLength(6);expect(new Set(sample.map(q=>q.id)).size).toBe(6);
    expect(sample.filter(q=>q.topic==='Equipment')).toHaveLength(3);
    expect(chooseQuestions([bank],['Buoyancy'],6).every(q=>q.topic==='Buoyancy')).toBe(true);
  });
  it('normalizes fill-gap answers while representing untested topics as unknown',()=>{
    expect(scoreQuestion({...bank.questions[0]!,type:'fill-gap',answers:['Example phrase']},'  EXAMPLE   phrase  ')).toBe(true);
    expect(knowledgeEvidence([],['Equipment'])[0]?.percent).toBeNull();
  });
});
