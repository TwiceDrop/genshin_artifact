// Base animation at 60 FPS. Normal entries follow the in-game combo order.
export function castFrameTable(actions, normals){
 const entries=new Map(Object.entries(actions));
 normals.forEach((frames,index)=>entries.set(`normal.${index+1}`,frames));
 return (action,rotation,character)=>{
  const entry=entries.get(action.actionId??action.action);
  return typeof entry==='function'?entry(action,rotation,character):entry;
 };
}
