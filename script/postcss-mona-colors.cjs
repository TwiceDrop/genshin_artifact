// Preserve every existing declaration and its light value. Only colour literals
// gain a dark-mode variable; selectors, geometry, images and content are untouched.
const valueParser=require('postcss-value-parser');
const {TinyColor}=require('@ctrl/tinycolor');
const palette={text:'#e4ebf5',muted:'#afbed0',quiet:'#94a6bc',surface:'#1b2430',inset:'#202c3a',border:'#344457',line:'#2b394a',blue:'#87b7ed',green:'#83c7a3',red:'#ee8c91',gold:'#dbb674',purple:'#bb9be7',cyan:'#81c7d0'};
function role(prop){
 if(prop.startsWith('--')){
  if(/shadow/.test(prop))return 'shadow';
  if(/border|line|rule|edge|focus/.test(prop))return 'border';
  if(/background|canvas|surface|inset|tint|profile|portrait|fill|bg/.test(prop))return 'bg';
  if(/ink|text|muted|quiet|foreground|accent|blue|color|action/.test(prop))return 'fg';
  return null;
 }
 if(/^(color|fill|stroke|caret-color|text-decoration-color)$/.test(prop))return 'fg';
 if(prop==='box-shadow'||prop==='text-shadow')return 'shadow';
 if(prop.startsWith('background'))return 'bg';
 if(prop.startsWith('border')||prop.startsWith('outline')||prop==='scrollbar-color')return 'border';
 return null;
}
function mapped(color,kind){
 const {h,s,l,a}=color.toHsl();
 let result;
 const semantic=h<25||h>=345?palette.red:h<75?palette.gold:h<165?palette.green:h<200?palette.cyan:h<250?palette.blue:palette.purple;
 if(kind==='fg')result=l>.91&&s<.12?'#f2f6fc':s<.18||l<.3&&s<.48?(l<.3?palette.text:l<.58?palette.muted:palette.quiet):semantic;
 else if(kind==='shadow')result='#000000';
 else if(kind==='border')result=s>.4&&l<.75?new TinyColor(semantic).darken(23).toHexString():l>.85?palette.line:palette.border;
 else if(a<.2&&l<.1)result='#d7e5f5';
 else if(a>=.2&&a<1&&l<.1)result='#000000';
 else if(l>.82)result=s>.38?new TinyColor({h,s:Math.min(s,.42),l:.2}).toHexString():l>.975?palette.surface:palette.inset;
 else if(s<.18)result=l<.2?'#111820':'#293647';
 else result=new TinyColor({h,s:Math.min(s,.5),l:Math.min(l,.36)}).toHexString();
 return new TinyColor(result).setAlpha(a).toRgbString();
}
module.exports=({scoped=false}={})=>({postcssPlugin:'mona-dark-colors',OnceExit(root,{postcss}){
 const file=root.source?.input?.file||'';
 if(/(?:dark[\\/]css-vars|mona-theme\.css)/.test(file))return;
 const vars=new Map();
 root.walkDecls(decl=>{
  const kind=role(decl.prop);if(!kind)return;
  const parsed=valueParser(decl.value);
  parsed.walk(node=>{
   if(node.type==='function'&&['url','var'].includes(node.value.toLowerCase()))return false;
   if(node.type!=='word'&&!(node.type==='function'&&/^(rgba?|hsla?)$/i.test(node.value)))return;
   const original=valueParser.stringify(node);
   if(!/^(#[\da-f]{3,8}|rgba?\(|hsla?\(|white$|black$|gray$|grey$|red$|green$|blue$|orange$|purple$|yellow$)/i.test(original))return;
   const color=new TinyColor(original);if(!color.isValid)return;
   const name='--mona-'+kind+'-'+color.toHex8();vars.set(name,mapped(color,kind));
   node.type='word';node.value=`var(${name}, ${original})`;delete node.nodes;return false;
  });
  decl.value=parsed.toString();
 });
 // vue-loader scopes styles in a separate, later loader. Keep this palette global.
 if(vars.size){const selector='html[data-color-mode="dark"]';const rule=postcss.rule({selector:scoped?`:global(${selector})`:selector});for(const[prop,value]of vars)rule.append(postcss.decl({prop,value}));root.append(rule)}
}});
module.exports.postcss=true;
