import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
import {api} from '../beta-tools/runtime.mjs';
import {chars,weapons,fixture} from '../beta-tools/interface-audit-7108.mjs';
import {createSkillMultiplierPreview} from '../beta-data/team-engine/multiplier-preview.mjs';
import {changeTeamConstellation,defaultTeamCharacter} from '../beta-data/team-dps-character-rules.mjs';
import {TEAM_ACTION_RULES_VERSION,actionAxisDurationMs} from '../beta-data/team-engine/action-config.mjs';
import {characterPackages} from '../beta-data/team-engine/character-packages.mjs';

test('four-role defaults initialize and the stellar preview applies Polestar Field after talent modifiers',()=>{
 const fresh=fs.readFileSync('src/pages/TeamOptimizationPage/TeamDpsPage.vue','utf8').match(/function fresh[^\n]+/)[0];
 const env={defaultTeamCharacter,characterPackages,characterData:chars,weaponData:weapons,params:()=>({}),upgradeArtifactConfig:x=>x};vm.createContext(env);vm.runInContext(ts.transpileModule(fresh+'\nglobalThis.make=fresh;',{compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.None}}).outputText,env);
 const names=['Sandrone','Alyosha','Qiqi','Odette'];
 for(const name of names){const p=env.make(name);assert.equal(weapons[p.weapon.name].type,chars[name].weapon);changeTeamConstellation(p.character,6);changeTeamConstellation(p.character,0);assert.deepEqual([p.character.skill1,p.character.skill2,p.character.skill3],[9,9,9]);}
 const axis=JSON.parse(fs.readFileSync('examples/team-dps/sandrone-odette-actions.json')),characters=names.map(n=>fixture(n).character);
 const preview=createSkillMultiplierPreview(api,axis,characters);
 const skillHit=preview.roles[0].hits.find(hit=>hit.label==='游衍解析·星超导');
 const burstHit=preview.roles[0].hits.find(hit=>hit.label==='负温聚能光束·星超导');
 assert.ok(skillHit && burstHit);

 // Base includes overcharge and tactics. Both hits occur at 12 Polestar Field stacks.
 const skillBase=0.3888*4;
 const burstBase=3.9696*2;
 const polestarCoefficient=2;
 assert.ok(Math.abs(skillHit.base.atk-skillBase)<1e-12);
 assert.ok(Math.abs(skillHit.effective.atk-skillBase*polestarCoefficient)<1e-12);
 assert.ok(Math.abs(burstHit.base.atk-burstBase)<1e-12);
 assert.ok(Math.abs(burstHit.effective.atk-burstBase*polestarCoefficient)<1e-12);
 assert.equal(preview.duration,23);assert.equal(actionAxisDurationMs(axis),23000);assert.equal(TEAM_ACTION_RULES_VERSION,'mona-team-engine/58');
 const count=preview.roles.flatMap(r=>r.hits).filter(h=>h.time===23).length;assert.ok(count>0);axis.endHit='exclude';const excluded=createSkillMultiplierPreview(api,axis,characters);assert.equal(excluded.duration,23);assert.equal(excluded.roles.flatMap(r=>r.hits).length,preview.roles.flatMap(r=>r.hits).length-count);
});
