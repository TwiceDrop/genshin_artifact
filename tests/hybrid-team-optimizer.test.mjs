import test from 'node:test';
import assert from 'node:assert/strict';
import {optimizeHybridTeam} from '../beta-data/hybrid-team-optimizer.mjs';

const slots = ['Flower','Feather','Sand','Goblet','Head'];
const artifacts = slots.flatMap((slot,index) => [0,1].map(side => ({
    id:index*2+side+1, slot, hp:side ? 2000 : 0, score:side ? 2 : 1,
})));
const entry = build => Object.fromEntries(build.map(a => [a.slot.toLowerCase(),a.id]));
const api = {
    CommonInterface:{get_attribute:input => ({hp:{base:40000,artifact:input.artifacts.reduce((n,a) => n+a.hp,0)},atk:{base:2000}})},
    OptimizeSingleWasm:{optimize:(input,build) => {
        if (build.length !== 5 || new Set(build.map(a => a.slot)).size !== 5) return [];
        const support = input.buffs?.find(b => b.name === 'VodyanitsaC1');
        const hp = support?.config.VodyanitsaC1.hp ?? 0;
        return [{...entry(build),value:build.reduce((n,a) => n+a.score,0) + (input.character.name === 'Kaeya' ? hp/1000 : 0)}];
    }},
};
const source = {character:{name:'Vodyanitsa',level:90,skill2:9,constellation:1,
    params:{Vodyanitsa:{c1_active:true}}},weapon:{name:'HymnOfTheMaelstrom',refine:1,params:{}},buffs:[],target_function:{name:'VodyanitsaDefault'}};
const recipient = {character:{name:'Kaeya'},weapon:{name:'DullBlade'},buffs:[],target_function:{name:'KaeyaDefault'}};

test('hybrid team search uses disjoint inventory and recalculates source HP for every candidate', () => {
    const result = optimizeHybridTeam(api,{single_interfaces:[source,recipient],weights:[1,1],hyper_param:{count:3}},artifacts);
    assert.equal(result.search_complete,true);
    assert.ok(result.evaluated_teams > 0);
    assert.equal(result.artifacts.length,3);
    for (const team of result.artifacts) {
        const assigned = team.flatMap(member => Object.values(member));
        assert.equal(new Set(assigned).size,10);
    }
    // The five high-value items all belong to the source: they improve her
    // own score and her C1 bonus to the recipient. This checks candidate HP.
    assert.deepEqual(Object.values(result.artifacts[0][0]),[2,4,6,8,10]);
});

test('single-copy inventory cannot equip two full teams', () => {
    const result = optimizeHybridTeam(api,{single_interfaces:[source,recipient],weights:[1,1]},artifacts.filter(a => a.id%2));
    assert.deepEqual(result.artifacts,[]);
    assert.equal(result.search_complete,true);
});

test('active weapon reaction bonus is reported instead of silently omitted', () => {
    const nightweaver = {...source,weapon:{name:'NightweaversLookingGlass',level:90,ascend:false,refine:1,
        params:{NightweaversLookingGlass:{skill_active:true,lunar_bloom_active:true,
            skill_rate:1,lunar_rate:1}}}};
    assert.throws(() => optimizeHybridTeam(api,{single_interfaces:[nightweaver,recipient],weights:[1,1]},artifacts),
        /队友绽放／月绽放增伤尚未接入/);
});
