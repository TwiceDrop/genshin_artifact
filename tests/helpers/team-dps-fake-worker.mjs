export class FakeTeamWorker{
 sent=[];terminated=false;
 postMessage(data,transfer=[]){this.sent.push(structuredClone(data,{transfer}));}
 terminate(){this.terminated=true;for(const data of this.sent){data.port?.close();data.ports?.forEach(port=>port.close());}}
 emit(data){this.onmessage({data});}
}
export const simpleTeamModel={program:{nodes:[{op:'input',args:[],value:0}],outputs:[0]},eventTrace:{groups:[]}};
