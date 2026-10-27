const { spawnSync } = require('child_process')
const path = require('path')
const root = path.resolve(__dirname, '..')
function run(script, args, env=process.env) {
  const result = spawnSync(process.execPath, [script, ...args], {cwd:root,stdio:'inherit',env})
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status)
}
run(path.join(root,'mobile/node_modules/tailwindcss/lib/cli.js'), ['--config',path.join(root,'mobile/tailwind.config.cjs'),'--input',path.join(root,'src/mobile/theme.css'),'--output',path.join(root,'mobile/shadcn.css'),'--minify'])
run(path.join(root,'node_modules/@vue/cli-service/bin/vue-cli-service.js'), ['build',...process.argv.slice(2)], {...process.env,ENV_FILE:'.env.mobile.yaml'})
