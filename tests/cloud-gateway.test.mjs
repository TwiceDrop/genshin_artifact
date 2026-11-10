import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { CredentialStore } from '../server/credentials.mjs'
import { CloudGateway } from '../server/cloud.mjs'
import { createLocalServer } from '../server/local.mjs'

// Synthetic credentials only. Real DPAPI verifies persistence across bridge instances.
test('cloud bridge protects the token, explicitly transfers one vault account and isolates service changes', {skip:process.platform !== 'win32'}, async t => {
    // Existing update-only consumers inject a minimal credential store.
    const unrelated = createLocalServer({ credentialStore: {} })
    await new Promise(resolve => unrelated.close(resolve))
    const dir = await mkdtemp(path.join(tmpdir(), 'mona-cloud-test-'))
    const game = new CredentialStore(path.join(dir, 'game.dpapi'))
    const file = path.join(dir, 'cloud.dpapi')
    const token = '11111111-1111-4111-8111-111111111111.synthetic-session-secret'
    const cookie = 'ltuid=123;ltoken=synthetic-token;cookie_token=synthetic-cookie;account_id=123;'
    const sent = []
    let revoked = false
    const remote = http.createServer(async(req,res) => {
        let raw = ''; for await (const chunk of req) raw += chunk
        const body = raw ? JSON.parse(raw) : {}
        sent.push({url:req.url,authorization:req.headers.authorization,body})
        let value = {}, status = 200
        if (req.url === '/v1/auth/email/verify') value = {sessionToken:token,user:{id:'synthetic-user',email:'test@example.invalid'},expiresAt:'2099-01-01T00:00:00Z'}
        else if (revoked) {status=401;value={error:{code:'UNAUTHORIZED',message:'会话已过期'}}}
        else if (req.url === '/v1/game-accounts') value={account:{id:'cloud-123',platform:body.platform}}
        else if (req.url === '/v1/me') value={user:{id:'synthetic-user',email:'test@example.invalid'}}
        else value={ok:true}
        res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value))
    })
    await new Promise(resolve=>remote.listen(0,'127.0.0.1',resolve))
    const remoteUrl = `http://127.0.0.1:${remote.address().port}`
    let local
    t.after(async()=>{
        if(local?.listening)await new Promise(resolve=>local.close(resolve))
        await new Promise(resolve=>remote.close(resolve))
        assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep))
        await rm(dir,{recursive:true,force:true})
    })
    await game.upsert({id:'123',accountUid:'123',cookie,device:'synthetic-device',roles:[]})
    const original=await readFile(game.file)
    const gateway=()=>new CloudGateway({file,credentialStore:game})
    const bridge=gateway()
    local=createLocalServer({credentialStore:game,cloudGateway:bridge})
    await new Promise(resolve=>local.listen(0,'127.0.0.1',resolve))
    const url=`http://127.0.0.1:${local.address().port}/api/cloud`
    const request=async(route,method='GET',body)=>{
        const response=await fetch(url+route,{method,headers:{'x-mona-local':'1','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})
        return {status:response.status,data:await response.json()}
    }
    assert.equal((await fetch(url+'/config')).status,403)
    assert.equal((await fetch(url+'/config',{headers:{'x-mona-local':'1',Origin:'https://unrelated.invalid'}})).status,403)
    assert.equal((await request('/config','PUT',{url:remoteUrl})).status,200)
    const login=await request('/v1/auth/email/verify','POST',{challengeId:'synthetic',code:'123456'})
    assert.equal(login.status,200);assert.equal(login.data.sessionToken,undefined)
    const config=await request('/config')
    assert.equal(config.data.user.email,'test@example.invalid');assert.ok(!JSON.stringify(config).includes('session-secret'))
    const localList=await request('/local-accounts')
    assert.equal(localList.data.accounts.length,1);assert.ok(!JSON.stringify(localList).includes('synthetic-cookie'))
    await request('/game-accounts/import-local','POST',{id:'123'})
    assert.equal(sent.at(-1).body.cookie,cookie);assert.equal(sent.at(-1).body.platform,'miyoushe');assert.equal(sent.at(-1).authorization,`Bearer ${token}`)
    assert.deepEqual(await readFile(game.file),original)
    assert.ok(!(await readFile(file)).includes(Buffer.from('session-secret')))
    const restarted=gateway()
    await restarted.handle('/v1/me','GET')
    assert.equal(sent.at(-1).authorization,`Bearer ${token}`)
    revoked=true
    assert.equal((await restarted.handle('/v1/me','GET')).status,401)
    assert.equal((await restarted.handle('/config','GET')).data.user,null)
    revoked=false
    await restarted.handle('/v1/auth/email/verify','POST',{})
    await restarted.handle(`/v1/sessions/${token.split('.')[0]}`,'DELETE')
    assert.equal((await restarted.handle('/config','GET')).data.user,null)
    await restarted.handle('/v1/auth/email/verify','POST',{})
    const changed=await restarted.handle('/config','PUT',{url:'https://new.example.invalid'})
    assert.equal(changed.data.user,null)
    await assert.rejects(restarted.handle('/config','PUT',{url:'http://example.invalid'}),/HTTPS/)
    await assert.rejects(restarted.handle('/config','PUT',{url:'https://example.invalid/alternate'}),/HTTPS/)
})
