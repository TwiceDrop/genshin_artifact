import characterElements from './character-elements.mjs';
// Data-only expression evaluator. No eval, arbitrary JS, or character branches.
const read=(object,path)=>path.split('.').reduce((v,k)=>v!=null&&Object.hasOwn(v,k)?v[k]:undefined,object);
export function evaluateExpression(node, context, locals={}) {
 if(node===null||typeof node!=='object')return node;
 if(Array.isArray(node))return node.map(n=>evaluateExpression(n,context,locals));
 const ev=n=>evaluateExpression(n,context,locals);
 if(node.ref)return read(context,node.ref);
 if(node.local){if(!Object.hasOwn(locals,node.local))throw Error('Unknown rule variable: '+node.local);return locals[node.local];}
 const args=node.args||[];
 switch(node.op){
 case 'coalesce':for(const n of args){const v=ev(n);if(v!==null&&v!==undefined)return v;}return undefined;
 case 'if':return ev(args[0])?ev(args[1]):ev(args[2]);
 case 'and':return args.every(n=>!!ev(n));
 case 'or':return args.some(n=>!!ev(n));
 case 'not':return !ev(args[0]);
 case 'eq':return ev(args[0])===ev(args[1]);
 case 'lt':return ev(args[0])<ev(args[1]);
 case 'gte':return ev(args[0])>=ev(args[1]);
 case 'includes':return ev(args[0]).includes(ev(args[1]));
 case 'add':return args.reduce((v,n)=>v+ev(n),0);
 case 'mul':return args.reduce((v,n)=>v*ev(n),1);
 case 'sub':return ev(args[0])-ev(args[1]);
 case 'div':return ev(args[0])/ev(args[1]);
 case 'min':return Math.min(...args.map(ev));
 case 'max':return Math.max(...args.map(ev));
 case 'floor':return Math.floor(ev(args[0]));
 case 'at':{const a=ev(args[0]),i=ev(args[1]);if(!Number.isInteger(i)||i<0||i>=a.length)throw Error('Rule table index out of range');return a[i];}
 default:throw Error('Unknown effect operator: '+node.op);
 }
}
export function evaluateEffectRule(rule,parameters,input={}) {
 if(rule.version!==1)throw Error('Unsupported effect rule version');
 const who=input.character?.name;
 const recipientElement=parameters.recipient_element??input.character?.element??characterElements[who];
 const onField=input.character?.params?.[who]?.on_field;
 const context={parameters,input:{...input,recipient_element:recipientElement,recipient_on_field:onField}},locals=Object.create(null);
 for(const [key,expression]of Object.entries(rule.variables||{}))locals[key]=evaluateExpression(expression,context,locals);
 const ev=n=>evaluateExpression(n,context,locals);
 if(rule.when!==undefined&&!ev(rule.when))return {};
 for(const check of rule.assertions||[])if(!ev(check.when))throw Error(check.message);
 const values={};
 for(const effect of rule.effects){
  if(effect.when!==undefined&&!ev(effect.when))continue;
  const attribute=typeof effect.attribute==='string'?effect.attribute:ev(effect.attribute);
  const value=ev(effect.value);
  if(typeof value!=='number'||!Number.isFinite(value))throw Error('Non-finite effect: '+effect.attribute);
  values[attribute]=(values[attribute]||0)+value;
 }
 return values;
}
