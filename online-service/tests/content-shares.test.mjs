import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { fixture } from './helpers.mjs'

test('DSL and presets publish immutable, anonymous snapshots and honor expiry and ownership', async t => {
    const f=await fixture()
    t.after(()=>f.close())
    const owner=await f.login(), other=await f.login('reader@example.test')
    const post=(body,token=owner.sessionToken)=>f.request('/v1/shares',{method:'POST',token,body})
    const source='dmg hit = Amber.test({ a: 0 })\r\nresult = hit.e  // <合成>\n'
    const description='第一行\r\n第二行 <合成描述> 🧪'
    const dsl={kind:'dsl',days:7,requestId:randomUUID(),content:{character:'Amber',title:'合成目标',source,description,uid:'PRIVATE'}}
    assert.equal((await post(dsl,'')).status,401)
    for (const invalidDescription of ['第一行\0第二行', '\uD800', '\uDC00']) {
        const rejected = await post({ ...dsl, content:{ ...dsl.content, description:invalidDescription } })
        assert.equal(rejected.status, 400)
        assert.equal(rejected.body.error.code, 'INVALID_INPUT')
        assert.equal(rejected.body.error.message, 'DSL 手法描述含有无法发布的字符，请编辑描述后重试。')
    }
    const created=await post(dsl)
    assert.equal(created.status,200,JSON.stringify(created.body))
    const {id,content}=created.body
    assert.deepEqual(content,{character:'Amber',title:'合成目标',source,description})
    assert.equal((await post(dsl)).body.id,id)
    const publicUrl=id=>f.base+'/s/'+id
    const dslDownload = shareId => f.request('/v1/dsl-shares/' + shareId)
    const downloaded = await dslDownload(id)
    assert.equal(downloaded.status, 200)
    assert.deepEqual(downloaded.body, { document: { name:'合成目标', character:'Amber', source, description, generator:null, weapon:null } })
    const html=await (await fetch(publicUrl(id))).text()
    assert.match(html,/一键复制 DSL 源码/)
    assert.match(html,/&lt;合成&gt;/)
    assert.doesNotMatch(html,/PRIVATE/)
    assert.equal((await fetch(publicUrl(id)+'/download')).status,404)
    const update=await f.request('/v1/shares/'+id,{method:'PUT',token:owner.sessionToken,body:{version:1}})
    assert.equal(update.status,400)
    const piece={position:'flower',level:20,set:'合成套装',main:'生命值 +4780',subs:['暴击率 +3.1%'],id:'PRIVATE'}
    const preset={kind:'preset',days:null,requestId:randomUUID(),content:{title:'合成预设',character:'Amber',level:80,constellation:2,
        talents:[6,7,8],weapon:{name:'合成弓',level:80,refine:2,account:'PRIVATE',params:[{label:'层数',value:'2',account:'PRIVATE'}]},target:'合成目标',
        enemy:{level:93,pyro_res:.2,uid:'PRIVATE'},limits:{minRecharge:1.3},sets:['合成套装'],filters:{sand:[],cup:[],head:['暴击率']},
        buffs:['合成增益'],includeEquipment:false,equipment:[piece],miyousheKey:'PRIVATE'}}
    const hidden=await post(preset)
    assert.equal(hidden.status,200)
    assert.equal(hidden.body.content.equipment,undefined)
    assert.equal((await dslDownload(hidden.body.id)).status, 404)
    const omitted=await (await fetch(publicUrl(hidden.body.id))).text()
    assert.match(omitted,/此预设仅含养成/)
    assert.doesNotMatch(omitted,/PRIVATE|4780|gear-cards/)
    const withGear=await post({...preset,requestId:randomUUID(),content:{...preset.content,includeEquipment:true}})
    assert.equal(withGear.status,200)
    assert.ok(!JSON.stringify(withGear.body.content).includes('PRIVATE'))
    const gearPage=await (await fetch(publicUrl(withGear.body.id))).text()
    assert.match(gearPage,/生命值 \+4,780/)
    assert.match(gearPage,/火 20%/)
    assert.match(gearPage,/<dt>层数<\/dt><dd>2<\/dd>/)
    assert.equal((await f.request('/v1/shares/'+hidden.body.id,{method:'DELETE',token:other.sessionToken})).status,404)
    const mine=await f.request('/v1/shares',{token:owner.sessionToken})
    assert.deepEqual(mine.body.shares.map(item=>item.kind).sort(),['dsl','preset','preset'])
    await f.request('/v1/shares/'+hidden.body.id,{method:'DELETE',token:owner.sessionToken})
    assert.equal((await fetch(publicUrl(hidden.body.id))).status,410)
    const secondDsl = await post({ ...dsl, requestId:randomUUID(), content:{ ...dsl.content, description:undefined } })
    const withoutDescription = await dslDownload(secondDsl.body.id)
    assert.equal(withoutDescription.status, 200)
    assert.deepEqual(withoutDescription.body, { document: { name:'合成目标', character:'Amber', source, generator:null, weapon:null } })
    await f.request('/v1/shares/'+secondDsl.body.id,{method:'DELETE',token:owner.sessionToken})
    assert.equal((await dslDownload(secondDsl.body.id)).body.error.code, 'SHARE_REVOKED')
    f.advance(7*86400000)
    assert.equal((await fetch(publicUrl(id))).status,410)
    assert.equal((await dslDownload(id)).body.error.code, 'SHARE_EXPIRED')
    assert.equal((await fetch(publicUrl(withGear.body.id))).status,200)
})
