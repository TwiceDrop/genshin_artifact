import {elementalApplication} from './ice-electro-reactions.mjs';

// Normal and aimed attacks share the same native-index / impact-frame mapping.
export function basicAttackRecipes({element='Physical',normals,charged,aimed,plunge,group}){
 const attack=(id,label,category,element,index,frames,application)=>{
  const contacts=Array.isArray(frames)?frames:[frames];
  return {id,label,endOffsetMs:Math.max(...contacts)*1000/60,events:contacts.map((frame,part)=>({
   kind:'hit',key:id+'/'+part,index,part,category,element,application,delay:frame/60,
  }))};
 };
 const app=element==='Physical'?null:elementalApplication(1,group,3,2.5);
 return [...normals.map(([index,frames],i)=>attack('normal.'+(i+1),'普通攻击·第'+(i+1)+'段','normal',element,index,frames,app)),
  ...(aimed?[attack('aimed','瞄准射击','charged','Physical',...aimed,null)]:[]),
  attack('charged',aimed?'满蓄力瞄准射击':'重击','charged',charged[2]??element,charged[0],charged[1],(charged[2]??element)==='Physical'?null:elementalApplication()),
  ...['plunge.collision','plunge.low','plunge'].map((id,i)=>attack(id,['下落期间伤害','低空下落攻击','高空下落攻击'][i],'plunge',element,plunge[i],0,element==='Physical'?null:elementalApplication())),
 ];
}
export function basicNativeDamage(recipes){
 return Object.fromEntries(recipes.map(({id,events:[e]})=>[e.index,{category:e.category,element:e.element,...(e.category==='plunge'?{plungeImpact:id!=='plunge.collision'}:{})}]));
}

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
