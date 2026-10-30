import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
import {api} from '../beta-tools/runtime-7106.mjs';
import {chars,weapons,fixture} from '../beta-tools/interface-audit-7108.mjs';
import {createSkillMultiplierPreview} from '../beta-data/team-engine/multiplier-preview.mjs';
import {changeTeamConstellation} from '../beta-data/team-dps-character-rules.mjs';
import {TEAM_ACTION_RULES_VERSION,actionAxisDurationMs} from '../beta-data/team-engine/action-config.mjs';

test('new four-role defaults and constellation talents initialize; preview separates raw talent, A1 and K',()=>{
 const fresh=fs.readFileSync('src/pages/TeamOptimizationPage/TeamDpsPage.vue','utf8').match(/function fresh[^\n]+/)[0];
 const env={characterData:chars,weaponData:weapons,params:()=>({}),upgradeArtifactConfig:x=>x};vm.createContext(env);vm.runInContext(ts.transpileModule(fresh+'\nglobalThis.make=fresh;',{compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.None}}).outputText,env);
 const names=['Sandrone','Alyosha','Qiqi','Odette'];
 for(const name of names){const p=env.make(name);assert.equal(weapons[p.weapon.name].type,chars[name].weapon);changeTeamConstellation(p.character,6);changeTeamConstellation(p.character,0);assert.deepEqual([p.character.skill1,p.character.skill2,p.character.skill3],[9,9,9]);}
 const axis=JSON.parse(fs.readFileSync('examples/team-dps/sandrone-odette-actions.json')),characters=names.map(n=>fixture(n).character);
 const preview=createSkillMultiplierPreview(api,axis,characters),e=preview.roles[0].hits.find(h=>h.label==='游衍解析·星超导'&&h.modifiers.length),q=preview.roles[0].hits.find(h=>h.label==='负温聚能光束·星超导');
 assert.ok(Math.abs(e.base.stellar_atk-.3888)<1e-12);assert.ok(Math.abs(e.effective.stellar_atk-1.5552)<1e-12);
 assert.ok(Math.abs(q.base.stellar_atk-3.9696)<1e-12);assert.ok(Math.abs(q.effective.stellar_atk-7.9392)<1e-12);
 assert.equal(preview.duration,23);assert.equal(actionAxisDurationMs(axis),23000);assert.equal(TEAM_ACTION_RULES_VERSION,'mona-team-engine/11');
 const count=preview.roles.flatMap(r=>r.hits).filter(h=>h.time===23).length;assert.ok(count>0);axis.endHit='exclude';const excluded=createSkillMultiplierPreview(api,axis,characters);assert.equal(excluded.duration,23);assert.equal(excluded.roles.flatMap(r=>r.hits).length,preview.roles.flatMap(r=>r.hits).length-count);
});
