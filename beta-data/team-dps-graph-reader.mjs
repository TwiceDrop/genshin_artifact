// Layouts calibrated against the published legacy bridge and extension binaries.
// The instrumented copies expose graph reads; calculation binaries stay intact.
let nativeMemory,extensionMemory,revision=0,lastRevision=-1,depth=0;
let nativeSnapshot,extensionSnapshot;
export const bindNativeGraphMemory=get=>{nativeMemory=get;};
export const bindExtensionGraphMemory=get=>{extensionMemory=get;};
export const capturedTeamGraph=extension=>extension?extensionSnapshot:nativeSnapshot;
function snapshot(memory,ptr,nodeCount){
 const view=new DataView(memory.buffer),u=a=>view.getUint32(a,true),decoder=new TextDecoder();
 const string=(p,n)=>decoder.decode(new Uint8Array(memory.buffer,p,n)),nodes=[],edges=[],offset=nodeCount*80;
 for(let j=0;j<nodeCount;j++){
  const node=ptr+j*80+8,ctrl=u(node),mask=u(node+4),count=u(node+12),values=[];
  if(count)for(let i=0;i<=mask;i++)if(view.getUint8(ctrl+i)<128){const row=ctrl-(i+1)*24;values.push({label:string(u(row+4),u(row+8)),value:view.getFloat64(row+16,true)});}
  nodes.push(values);
 }
 for(let i=0;i<u(ptr+offset+16);i++){
  const row=u(ptr+offset+12)+i*44,table=u(row+16),data=u(row+12);
  edges.push({from1:view.getInt32(row+28,true),from2:view.getInt32(row+32,true),to:u(row+36),label:string(u(row+4),u(row+8)),fn:u(table+20),data:[...new Uint8Array(memory.buffer,data,u(table+4))]});
 }
 return {nodes,edges};
}
export const nativeGraphImports={
 write(){revision++;},edge(){revision++;},
 read(ptr){if(lastRevision===revision)return;lastRevision=revision;nativeSnapshot=snapshot(nativeMemory(),ptr,300);},
};
export const extensionGraphImports={
 read(ptr){if(depth++===0)extensionSnapshot=snapshot(extensionMemory(),ptr,203);},
 leave(){depth--;},
};
