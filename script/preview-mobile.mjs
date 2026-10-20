import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLocalServer } from '../server/local.mjs'
import { CredentialStore } from '../server/credentials.mjs'
import { LocalUpdater } from '../server/updates.mjs'

// Trial preview uses an independent origin and credential directory.
const root = fileURLToPath(new URL('../', import.meta.url))
const trial = path.join(root, '.build-target/7110-shadcn-mobile')
const server = createLocalServer({
  root: path.join(trial, 'web'),
  credentialStore: new CredentialStore(path.join(trial, 'preview-data/miyoushe.dpapi')),
  updater: new LocalUpdater({root:trial}),
})
server.listen(0, '127.0.0.1', () => console.log(`手机界面预览：http://127.0.0.1:${server.address().port}/#/calculate`))
