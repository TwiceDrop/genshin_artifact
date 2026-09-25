import test from 'node:test';
import assert from 'node:assert/strict';
import {createTeamContextSource,deriveSingleTeamContext} from '../src/algorithms/single-team-context.mjs';

const api = {CommonInterface:{get_attribute(input) {
    const gear = input.artifacts.reduce((total, artifact) => total + artifact.stat, 0);
    return {hp:{base:40000,gear},atk:{base:2000,gear}};
}}};
const recipient = {character:{name:'Skirk'},weapon:{name:'DullBlade'},
    target_function:{name:'SkirkDefault'},artifacts:[],equipped_artifact_ids:[],buffs:[],
    team_effects:{stellar_mode:'ordinary'}};
const item = (name, ids, params = {}) => ({character:{name,level:90,skill2:9,constellation:2,params:{[name]:params}},
    weapon:{name:name==='Vodyanitsa'?'HymnOfTheMaelstrom':'BeyondTheChrysalis',refine:1,params:'NoConfig'},
    buffs:[],artifactIds:ids,artifactEffectMode:'auto'});
const artifacts = new Map([1,2,3,4,5,6,7,8,9,10].map(id => [id,{id,stat:id*100}]));
const derive = (target,contexts,presets) => deriveSingleTeamContext(api,target,contexts,presets,
    id => artifacts.get(id), artifact => ({...artifact}));

test('a teammate uses current equipped pieces and keeps a stable source ID', () => {
    const presets = {hydro:{item:item('Vodyanitsa',[1,2,3,4,5],{c1_active:true})}};
    const context = createTeamContextSource('hydro',presets.hydro);
    const first = derive(recipient,[context],presets);
    assert.deepEqual(first.issues,[]);
    const c1 = first.automatic.find(effect => effect.name==='VodyanitsaC1');
    assert.equal(c1.config.VodyanitsaC1.hp,41500);
    assert.equal(c1.source_id,'preset:hydro');
    assert.equal(first.team_context[0].source_id,'preset:hydro');
    presets.hydro.item.artifactIds=[6,7,8,9,10];
    const second = derive(recipient,[context],presets);
    assert.equal(second.automatic.find(effect => effect.name==='VodyanitsaC1').config.VodyanitsaC1.hp,44000);
});

test('explicit manual same-source buff wins without removing a different source', () => {
    const presets = {hydro:{item:item('Vodyanitsa',[1,2,3,4,5],{c1_active:true})}};
    const context = createTeamContextSource('hydro',presets.hydro);
    const manuallyOverridden = derive({...recipient,buffs:[{name:'VodyanitsaC1',source_id:context.sourceId,
        config:{VodyanitsaC1:{hp:90000}}}]},[context],presets);
    assert.equal(manuallyOverridden.automatic.some(effect => effect.name==='VodyanitsaC1'),false);
    assert.equal(manuallyOverridden.buffs[0].config.VodyanitsaC1.hp,90000);
    const differentSource = derive({...recipient,buffs:[{name:'VodyanitsaC1',source_id:'another-source',config:'NoConfig'}]},
        [context],presets);
    assert.equal(differentSource.automatic.some(effect => effect.name==='VodyanitsaC1'),true);
});

test('Vesna coverage comes from an explicit trigger and her current attack', () => {
    const presets={anemo:{item:item('Vesna',[1,2,3,4,5],{radiance:false})}};
    const context=createTeamContextSource('anemo',presets.anemo);
    context.triggers.vesnaRadiance=true;
    context.triggers.vesnaTalentActive=true;
    context.triggers.vesnaTalentCoverage=.4;
    const output=derive(recipient,[context],presets);
    const buff=output.automatic.find(effect=>effect.name==='VesnaTalent1');
    assert.equal(buff.config.VesnaTalent1.atk,3500);
    assert.equal(buff.config.VesnaTalent1.coverage,.4);
});

test('Vodyanitsa signature only applies after its explicit trigger is enabled', () => {
    const presets={hydro:{item:item('Vodyanitsa',[1,2,3,4,5])}};
    const context=createTeamContextSource('hydro',presets.hydro);
    context.triggers.signatureStacks=2;
    context.triggers.signatureOnField=false;
    assert.equal(derive(recipient,[context],presets).automatic.some(effect=>effect.name==='VodyanitsaSignature'),false);
    context.triggers.signatureOnField=true;
    assert.equal(derive(recipient,[context],presets).automatic.some(effect=>effect.name==='VodyanitsaSignature'),true);
});

test('an explicit ordinary or Stellar mode overrides target-name inference', () => {
    const presets={hydro:{item:item('Vodyanitsa',[1,2,3,4,5],{song_active:true})}};
    const context=createTeamContextSource('hydro',presets.hydro);
    context.triggers.a4Active=true;
    const target={...recipient,character:{name:'Sandrone'},target_function:{name:'SandroneStellarSwirl'},
        team_effects:{stellar_mode:'ordinary'}};
    const ordinary=derive(target,[context],presets).automatic.find(effect=>effect.name==='VodyanitsaA4');
    assert.equal(ordinary.config.VodyanitsaA4.ordinary_mode,true);
    const stellar=derive({...target,team_effects:{stellar_mode:'stellar'}},[context],presets)
        .automatic.find(effect=>effect.name==='VodyanitsaA4');
    assert.equal(stellar.config.VodyanitsaA4.ordinary_mode,false);
});

test('missing saved equipment and duplicate occupation are reported, not silently omitted', () => {
    const presets={hydro:{item:item('Vodyanitsa',undefined,{c1_active:true})}};
    const context=createTeamContextSource('hydro',presets.hydro);
    assert.match(derive(recipient,[context],presets).issues[0],/没有保存当前装备/);
    presets.hydro.item.artifactIds=[1,2,3,4,5];
    assert.match(derive({...recipient,equipped_artifact_ids:[3]},[context],presets).issues[0],/同一件圣遗物/);
});
