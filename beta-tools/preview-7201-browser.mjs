import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {input,gear} from './preview-7201-fixtures.mjs';import {api} from './runtime-7106.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[],out=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:18301/#/calculate');await page.getByRole('button',{name:'开始计算',exact:true}).waitFor();
 await page.evaluate(()=>window.webpackChunkgenshin_artifacts.push([['preview7201'],{},r=>window.__previewRequire=r]));
 console.log('MODULES',await page.evaluate(()=>Object.keys(window.__previewRequire.m).filter(k=>k.includes('single_optimize')||k.includes('mona_wasm/pkg/index'))));
 for(const [name,label] of [['Mitya','米提亚'],['Valeriy','瓦列里']]){
  await page.locator('.select-character .el-cascader').first().click();await page.locator('.el-cascader-menu:visible').first().getByText('雷',{exact:true}).click();await page.locator('.el-cascader-menu:visible').last().getByText(label,{exact:true}).click();
  await page.locator('.damage-analysis-div .el-select').click();await page.locator('.el-select-dropdown:visible').getByText(name==='Mitya'?'递变聚爆星超导伤害':'臼炮直射·抵近轰击',{exact:true}).click();
  if(name==='Mitya')await page.locator('.damage-analysis-div').getByText('直接星超导',{exact:true}).waitFor();
  await page.locator('.character-splash').waitFor();await page.waitForTimeout(400);assert.equal(await page.locator('.character-splash').evaluate(i=>i.complete&&i.naturalWidth>0),true);
  const x=input(name);x.artifacts=structuredClone(gear);const alt={...structuredClone(gear[2]),id:6,main_stat:name==='Mitya'?['ElementalMastery',287]:['ATKPercentage',.466]},config={...x,target_function:{name:name+'Default',params:'NoConfig'},algorithm:'AStar',constraint:null,filter:null},pool=[...gear,alt],expected=api.OptimizeSingleWasm.optimize(config,pool);
  const result=await page.evaluate(async({config,pool})=>{const module=await window.__previewRequire('./src/wasm/single_optimize.js');return await module.wasmSingleOptimize(config,pool);},{config,pool});assert.equal(result.length,expected.length);assert.ok(Math.abs(result[0].value-expected[0].value)<1e-7);out.push({name,results:result,ui:await page.locator('.config-character').innerText()});await page.screenshot({path:'.build-target/research-7201/'+name+'-browser.png',fullPage:true});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync('.build-target/research-7201/browser-result.json',JSON.stringify({errors,out},null,2));console.log('PASS: 两角色界面、图片、实际 AStar Worker 与 Node 结果一致');
}finally{await browser.close()}
