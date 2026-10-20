const {spawn} = require('child_process'),fs=require('fs'),path=require('path')
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.build-target/7110-shadcn-mobile')
const mobile=process.argv[2]==='mobile'
const log=fs.openSync(path.join(dir,mobile?'build-mobile.log':'build-desktop.log'),'w')
const args=mobile?[path.join(root,'script/build-mobile.cjs'),'--dest','.build-target/7110-shadcn-mobile/web']:[path.join(root,'node_modules/@vue/cli-service/bin/vue-cli-service.js'),'build','--dest','.build-target/7110-shadcn-mobile/desktop']
const child=spawn(process.execPath,args,{cwd:root,env:{...process.env,ENV_FILE:mobile?'.env.mobile.yaml':'.env.development.yaml',NODE_OPTIONS:'--max-old-space-size=6144'},stdio:['ignore',log,log]})
child.on('error',e=>{console.error(e);process.exit(1)})
child.on('exit',code=>{fs.closeSync(log);console.log(`${mobile?'mobile':'desktop'} build exited ${code}`);process.exit(code)})
