// Only static command/configuration data is supplied to recipe factories.
// Candidate stats, conditional hits and reactive state belong to combat hooks.
// Existing scheduler primitives own identity, ordering, recasts and axis tails.
export function defineActionRecipes(definitions){
 const entries=new Map(definitions.map(definition=>[definition.id,definition]));
 return {
  actions:definitions.map(({events,...metadata})=>metadata),
  expand(context){
   for(const action of context.actions){
    const id=action.actionId??action.action,definition=entries.get(id);
    if(!definition)throw Error('角色动作未声明：'+context.profile.character.name+'/'+id);
    const recipes=typeof definition.events==='function'?definition.events({character:context.profile.character,params:action.params??{},actionId:id}):definition.events;
    for(const recipe of recipes){
     const {kind,key,delay=0,repeat,phase,...values}=recipe;
     if(kind==='window'){context.addWindow(key,action,values.duration,delay,values.values);continue;}
     const emit=offset=>{
      if(kind==='hit')context.hit(action,{...values,label:values.label??definition.label},offset,repeat?(key??id)+'/'+offset:key??id,phase);
      else if(kind==='heal')context.heal(action,offset,values.recipients,values.healing,phase,key===undefined?undefined:repeat?key+'/'+offset:key);
      else throw Error('未实现的动作事件：'+id+'/'+kind);
     };
     if(repeat)context.periodic(action,repeat,offset=>emit(offset+delay));else emit(delay);
    }
   }
  },
 };
}
