import test from 'node:test';
import assert from 'node:assert/strict';
import * as score from '../src/algorithms/artifact-score/score.mjs';
import {createScoreEvaluator} from '../src/algorithms/artifact-score/vendor/miao.mjs';
import facts from '../src/algorithms/artifact-score/vendor/character-facts.mjs';
import {sourceScore} from '../.build-target/character-score-20261002/oracle.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const cup={id:1,position:'cup',star:5,level:20,setName:'GladiatorsFinale',mainTag:{name:'windBonus',value:.466},normalTags:[{name:'critical',value:.07},{name:'elementalMastery',value:23},{name:'recharge',value:.117},{name:'lifeStatic',value:209}]};

test('1 六命万叶并列元素伤害/精通主词条：分母 1075，与固定上游及独立算式一致',()=>{
 const name='枫原万叶',options={elem:'anemo',cons:6,charAttrs:{mastery:600,cpct:70,cdmg:160}},context={name,options};
 const artifact=score.toScoreArtifact(cup),source=sourceScore(name,facts.baseAttrMap[name],[artifact],options);
 const actual=createScoreEvaluator(name,[artifact],options);
 const numerator=46.6*100/(3.885*1.5)/4+7*100/3.885+23*100/(3.885*6)+11.7*55/(3.885/.6);
 const expected=66*numerator/1075;
 near(source.scores[0],expected);near(actual.score(artifact),expected);
 assert.deepEqual(actual.weights,JSON.parse(JSON.stringify(source.weights)));
 const build=score.scoreBuild([cup],context),detail=score.scoreDetails(cup,context,[cup]);
 assert.equal(build.artifacts[0].score,35.5);assert.equal(build.total,35.5);assert.equal(detail.score,35.5);
 console.log({name,raw:actual.score(artifact),score:build.artifacts[0].score,denominator:1075});
});

test('2 雷电将军默认评分并列杯主词条：单件、明细和排名均与固定上游一致',()=>{
 const name='雷电将军',item={...cup,mainTag:{name:'thunderBonus',value:.466},normalTags:cup.normalTags.slice(0,3)};
 const options={elem:'electro',cons:0,charAttrs:{mastery:0,cpct:5,cdmg:50}},context={name,options};
 const artifact=score.toScoreArtifact(item),source=sourceScore(name,facts.baseAttrMap[name],[artifact],options);
 const actual=createScoreEvaluator(name,[artifact],options),expected=32.04032181372084;
 near(source.scores[0],expected);near(actual.score(artifact),expected);
 assert.deepEqual(actual.weights,JSON.parse(JSON.stringify(source.weights)));
 const build=score.scoreBuild([item],context),detail=score.scoreDetails(item,context,[item]);
 assert.equal(build.artifacts[0].score,32);assert.equal(build.total,32);assert.equal(detail.score,32);
 const rank=score.scoreRanking(item).characters.find(row=>row.name===name);assert.equal(rank.score,32);
 console.log({name,raw:actual.score(artifact),score:build.artifacts[0].score,ranking:rank.score});
});