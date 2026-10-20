const assert=require('node:assert/strict'),http=require('http'),fs=require('fs'),path=require('path')
const {chromium}=require('../mobile/node_modules/playwright')
const desktop=process.argv.includes('--desktop')
const root=path.resolve(__dirname,'..'),web=path.join(root,'.build-target/7110-shadcn-mobile',desktop?'desktop':'web'),out=path.join(root,'.build-target/7110-shadcn-mobile')
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.wasm':'application/wasm','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json'}
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(req.url.split('?')[0]),file=path.join(web,pathname==='/'?'index.html':pathname)
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end('missing');return}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data)})
})
const artifact=(slotKey,mainStatKey)=>({setKey:'GladiatorsFinale',slotKey,mainStatKey,rarity:5,level:20,substats:[{key:'critRate_',value:7},{key:'critDMG_',value:7.8},{key:'atk_',value:5.8},{key:'enerRech_',value:11.7}],location:'',lock:false})
const good={format:'GOOD',version:3,source:'mobile-ui-synthetic',artifacts:[artifact('flower','hp'),artifact('plume','atk'),artifact('sands','atk_'),artifact('goblet','cryo_dmg_'),artifact('circlet','critDMG_')]}
async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true})
  try {
    const context=await browser.newContext({viewport:desktop?{width:1280,height:900}:{width:390,height:844},deviceScaleFactor:1,isMobile:!desktop,hasTouch:!desktop,userAgent:desktop?'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36':'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'})
    const page=await context.newPage(),errors=[],logs=[],routes=[]
    page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')logs.push(message.text())})
    await page.addInitScript(()=>localStorage.setItem('mona.automaticReleaseUpdates','false'))
    await page.route('**/api/mys/accounts',route=>route.fulfill({json:{accounts:[],activeId:''}}))
    const sheet=()=>page.locator('.m-sheet:visible').last()
    const closeSheet=()=>sheet().getByRole('button',{name:'关闭',exact:true}).click()
    const screenshot=async name=>{await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0)});await page.waitForTimeout(80);return page.screenshot({path:path.join(out,name+'.png'),fullPage:true})}
    const widthCheck=async()=>{const width=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.ok(width.scroll<=width.viewport+1,JSON.stringify(width));return width}
    const navigate=async target=>{
      await page.locator('.m-app-header').getByRole('button',{name:'全部功能',exact:true}).click()
      assert.equal(await page.locator('.m-all-navigation a').count(),11)
      await page.locator(`.m-all-navigation a[href="#${target}"]`).click()
      await page.waitForTimeout(400)
    }
    await page.goto(url+'/#/calculate');await page.waitForSelector('.config-character');await page.waitForTimeout(600)
    if(desktop){
      await page.waitForSelector('.nav-bar');assert.equal(await page.locator('.m-app-header').count(),0);assert.equal(await page.locator('html.mona-mobile').count(),0);assert.ok(await page.locator('.el-input-number__decrease').count()>0);
      await screenshot('desktop-1280');assert.deepEqual(errors,[]);assert.deepEqual(logs,[]);
      const evidence={check:'desktop retains Element Plus and original navigation',viewport:{width:1280,height:900},errors,logs};fs.writeFileSync(path.join(out,'desktop-evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));return
    }
    assert.equal(await page.locator('.skill-div input').first().inputValue(),'8')
    assert.ok((await page.locator('.skill-div input').first().boundingBox()).width>=40)
    await page.getByRole('combobox',{name:'角色',exact:true}).click();await sheet().getByPlaceholder('搜索角色').fill('凯亚');await sheet().getByRole('option',{name:'凯亚',exact:true}).click()
    await page.getByRole('combobox',{name:'武器',exact:true}).click();await sheet().getByPlaceholder('搜索').fill('银釭');await sheet().getByRole('option',{name:'银釭',exact:true}).click()
    await screenshot('calculate-390');await page.screenshot({path:path.join(out,'calculate-390-viewport.png')});await widthCheck()
    await page.getByRole('button',{name:'添加BUFF',exact:true}).click()
    assert.equal(await sheet().getByRole('tab').count(),5)
    await sheet().getByRole('tab',{name:'元素共鸣',exact:true}).click()
    await sheet().locator('.buff-item:visible').nth(0).click();assert.equal(await page.locator('.m-sheet:visible').count(),1)
    await sheet().locator('.buff-item:visible').nth(1).click();assert.equal(await page.locator('.m-sheet:visible').count(),1)
    await screenshot('buff-390');await closeSheet()
    await page.getByRole('button',{name:'圣遗物与伤害',exact:true}).click();await screenshot('equipment-390');await widthCheck()
    await page.getByRole('button',{name:'面板与曲线',exact:true}).click();await screenshot('panel-390');await widthCheck()
    await page.locator('.m-app-header').getByRole('button',{name:'全部功能',exact:true}).click();await screenshot('navigation-390');await closeSheet()
    await navigate('/artifacts')
    await page.getByRole('button',{name:'导入与导出',exact:true}).click();await sheet().getByRole('button',{name:'导入',exact:true}).click()
    await sheet().locator('input[type=file]').setInputFiles({name:'mobile-synthetic.good.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(good))})
    await sheet().getByRole('button',{name:'确定',exact:true}).click()
    await page.waitForFunction(()=>document.querySelector('.toolbar-mobile')?.textContent.includes('5'))
    const artifactTabs=page.locator('.m-tabs-list [role=tab]');assert.equal(await artifactTabs.count(),5);
    for(let i=0;i<5;i++){await artifactTabs.nth(i).click();assert.equal(await page.locator('.artifact-item:visible').count(),1)}
    await artifactTabs.first().click();
    await screenshot('artifacts-390');await widthCheck()
    await page.getByRole('button',{name:'导入与导出',exact:true}).click()
    const downloadPromise=page.waitForEvent('download');await sheet().getByRole('button',{name:/导出/}).click();const download=await downloadPromise
    const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'))
    assert.equal(Object.values(exported).filter(Array.isArray).reduce((n,list)=>n+list.length,0),5)
    await navigate('/calculate');await page.getByRole('button',{name:'角色与配置',exact:true}).click()
    await page.getByRole('button',{name:'开始计算',exact:true}).click()
    await page.getByText(/共计算\d+组圣遗物搭配/).waitFor({state:'attached',timeout:30000})
    const resultText=await page.getByText(/共计算\d+组圣遗物搭配/).innerText()
    assert.ok((await page.locator('.calculator-page').getAttribute('class')).includes('mobile-section-equipment'));
    await screenshot('optimized-390');await page.getByRole('button',{name:'角色与配置',exact:true}).click()
    await page.getByRole('button',{name:'新建预设',exact:true}).click();await sheet().locator('input').fill('手机合成凯亚');await sheet().getByRole('button',{name:'确定',exact:true}).click()
    for(const target of ['/intro','/setup','/account','/uid-data','/artifacts-kumi','/presets','/team-optimization','/playground','/help/export-tools']){
      await navigate(target);const width=await widthCheck();routes.push({path:target,title:await page.title(),...width})
      if(target==='/uid-data')await screenshot('uid-390')
    }
    await navigate('/calculate');await page.getByRole('button',{name:'角色与配置',exact:true}).click()
    assert.ok((await page.locator('.el-cascader').innerText()).includes('凯亚'))
    for(const width of [360,768]) {await page.setViewportSize({width,height:844});await widthCheck();await screenshot('calculate-'+width)}
    assert.deepEqual(errors,[]);assert.deepEqual(logs,[])
    const evidence={check:'isolated mobile browser navigation, controls, synthetic GOOD import/export and real optimize worker',viewport:{width:390,height:844},navigationCount:11,routes,importedArtifacts:5,exportedArtifacts:5,resultText,errors,logs}
    fs.writeFileSync(path.join(out,'browser-evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence))
  } finally {await browser.close();server.close()}
}
main().catch(error=>{console.error(error);server.close();process.exitCode=1})
