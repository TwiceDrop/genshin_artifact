// IEEE-754 binary64 arithmetic for WGSL, represented as low/high u32 words.
// All rounding is round-to-nearest, ties-to-even, including subnormal results.
export const teamF64Wgsl=String.raw`
fn uz(a:vec2<u32>)->bool{return (a.x|a.y)==0u;}
fn ul(a:vec2<u32>,b:vec2<u32>)->bool{return a.y<b.y||(a.y==b.y&&a.x<b.x);}
fn ua(a:vec2<u32>,b:vec2<u32>)->vec2<u32>{let lo=a.x+b.x;return vec2<u32>(lo,a.y+b.y+select(0u,1u,lo<a.x));}
fn us(a:vec2<u32>,b:vec2<u32>)->vec2<u32>{return vec2<u32>(a.x-b.x,a.y-b.y-select(0u,1u,a.x<b.x));}
fn shl(a:vec2<u32>,n:u32)->vec2<u32>{
 if(n==0u){return a;}if(n>=64u){return vec2<u32>(0u);}if(n>=32u){return vec2<u32>(0u,a.x<<(n-32u));}
 return vec2<u32>(a.x<<n,(a.y<<n)|(a.x>>(32u-n)));
}
fn shr(a:vec2<u32>,n:u32)->vec2<u32>{
 if(n==0u){return a;}if(n>=64u){return vec2<u32>(0u);}if(n>=32u){return vec2<u32>(a.y>>(n-32u),0u);}
 return vec2<u32>((a.x>>n)|(a.y<<(32u-n)),a.y>>n);
}
fn jam(a:vec2<u32>,n:u32)->vec2<u32>{
 if(n==0u){return a;}if(n>=64u){return vec2<u32>(select(1u,0u,uz(a)),0u);}
 let rest=shl(a,64u-n);var result=shr(a,n);result.x|=select(1u,0u,uz(rest));return result;
}
fn wide(a:u32,b:u32)->vec2<u32>{
 let a0=a&65535u;let a1=a>>16u;let b0=b&65535u;let b1=b>>16u;
 let t0=a0*b0;let t1=a1*b0+(t0>>16u);let t2=a0*b1+(t1&65535u);
 return vec2<u32>((t2<<16u)|(t0&65535u),a1*b1+(t1>>16u)+(t2>>16u));
}
fn add128(a:vec4<u32>,b:vec4<u32>)->vec4<u32>{
 var result:vec4<u32>;var carry=0u;
 for(var i=0u;i<4u;i++){let s=a[i]+b[i];let t=s+carry;carry=select(0u,1u,s<a[i]||t<s);result[i]=t;}return result;
}
fn mul128(a:vec2<u32>,b:vec2<u32>)->vec4<u32>{
 let p0=wide(a.x,b.x);let p1=wide(a.y,b.x);let p2=wide(a.x,b.y);let p3=wide(a.y,b.y);
 return add128(add128(vec4<u32>(p0,0u,0u),vec4<u32>(0u,p1,0u)),add128(vec4<u32>(0u,p2,0u),vec4<u32>(0u,0u,p3)));
}
struct Unpacked { sign:u32, exponent:i32, sig:vec2<u32> }
fn unpack(a:vec2<u32>)->Unpacked{
 let sign=a.y>>31u;var exponent=i32((a.y>>20u)&2047u);var sig=vec2<u32>(a.x,a.y&1048575u);
 if(exponent!=0){sig.y|=1048576u;}else{
  exponent=1;if(!uz(sig)){for(var i=0u;i<52u;i++){if((sig.y&1048576u)!=0u){break;}sig=shl(sig,1u);exponent--;}}
 }
 return Unpacked(sign,exponent,sig);
}
fn pack(sign:u32,exponent:i32,extended:vec2<u32>)->vec2<u32>{
 var e=exponent;var sig=extended;
 if(e<1){sig=jam(sig,u32(1-e));e=1;}
 let rounding=sig.x&7u;sig=shr(sig,3u);
 if(rounding>4u||(rounding==4u&&(sig.x&1u)!=0u)){sig=ua(sig,vec2<u32>(1u,0u));}
 if((sig.y&2097152u)!=0u){sig=shr(sig,1u);e++;}
 if(e>=2047){return vec2<u32>(0u,(sign<<31u)|0x7ff00000u);}
 if(uz(sig)){return vec2<u32>(0u,sign<<31u);}
 if(e==1&&(sig.y&1048576u)==0u){e=0;}
 return vec2<u32>(sig.x,(sign<<31u)|(u32(e)<<20u)|(sig.y&1048575u));
}
fn nan(a:vec2<u32>)->bool{return (a.y&0x7ff00000u)==0x7ff00000u&&((a.y&1048575u)|a.x)!=0u;}
fn inf(a:vec2<u32>)->bool{return (a.y&0x7fffffffu)==0x7ff00000u&&a.x==0u;}
fn zero(a:vec2<u32>)->bool{return (a.y&0x7fffffffu)==0u&&a.x==0u;}
fn fp_nan()->vec2<u32>{return vec2<u32>(0u,0x7ff80000u);}
fn fp_add(a:vec2<u32>,b:vec2<u32>)->vec2<u32>{
 if(nan(a)||nan(b)){return fp_nan();}
 if(inf(a)){if(inf(b)&&((a.y^b.y)>>31u)!=0u){return fp_nan();}return a;}if(inf(b)){return b;}
 if(zero(a)&&zero(b)){return vec2<u32>(0u,(a.y&b.y)&0x80000000u);}if(zero(a)){return b;}if(zero(b)){return a;}
 var x=unpack(a);var y=unpack(b);if(x.exponent<y.exponent){let t=x;x=y;y=t;}
 var exponent=x.exponent;var sign=x.sign;let p=shl(x.sig,3u);let q=jam(shl(y.sig,3u),u32(x.exponent-y.exponent));var sig:vec2<u32>;
 if(x.sign==y.sign){sig=ua(p,q);if((sig.y&16777216u)!=0u){sig=jam(sig,1u);exponent++;}}
 else{
  if(ul(p,q)){sig=us(q,p);sign=y.sign;}else{sig=us(p,q);}
  if(uz(sig)){return vec2<u32>(0u);}
  for(var i=0u;i<56u;i++){if((sig.y&8388608u)!=0u){break;}sig=shl(sig,1u);exponent--;}
 }
 return pack(sign,exponent,sig);
}
fn fp_sub(a:vec2<u32>,b:vec2<u32>)->vec2<u32>{return fp_add(a,vec2<u32>(b.x,b.y^0x80000000u));}
fn fp_mul(a:vec2<u32>,b:vec2<u32>)->vec2<u32>{
 let sign=(a.y^b.y)>>31u;
 if(nan(a)||nan(b)){return fp_nan();}if(inf(a)||inf(b)){if(zero(a)||zero(b)){return fp_nan();}return vec2<u32>(0u,(sign<<31u)|0x7ff00000u);}
 if(zero(a)||zero(b)){return vec2<u32>(0u,sign<<31u);}
 let x=unpack(a);let y=unpack(b);let product=mul128(x.sig,y.sig);let extra=select(0u,1u,(product.w&512u)!=0u);let shift=17u+extra;
 var sig=vec2<u32>((product.y>>shift)|(product.z<<(32u-shift)),(product.z>>shift)|(product.w<<(32u-shift)));
 sig.x|=select(0u,1u,product.x!=0u||(product.y&((1u<<shift)-1u))!=0u);
 return pack(sign,x.exponent+y.exponent-1023+i32(extra),sig);
}
fn fp_div(a:vec2<u32>,b:vec2<u32>)->vec2<u32>{
 let sign=(a.y^b.y)>>31u;
 if(nan(a)||nan(b)||(zero(a)&&zero(b))||(inf(a)&&inf(b))){return fp_nan();}
 if(inf(a)||zero(b)){return vec2<u32>(0u,(sign<<31u)|0x7ff00000u);}
 if(zero(a)||inf(b)){return vec2<u32>(0u,sign<<31u);}
 var x=unpack(a);let y=unpack(b);var exponent=x.exponent-y.exponent+1023;
 if(ul(x.sig,y.sig)){x.sig=shl(x.sig,1u);exponent--;}
 var remainder=us(x.sig,y.sig);var sig=vec2<u32>(1u,0u);
 for(var i=0u;i<55u;i++){
  remainder=shl(remainder,1u);sig=shl(sig,1u);
  if(!ul(remainder,y.sig)){remainder=us(remainder,y.sig);sig.x|=1u;}
 }
 sig.x|=select(1u,0u,uz(remainder));return pack(sign,exponent,sig);
}
fn fp_eq(a:vec2<u32>,b:vec2<u32>)->bool{return !nan(a)&&!nan(b)&&(all(a==b)||(zero(a)&&zero(b)));}
fn fp_lt(a:vec2<u32>,b:vec2<u32>)->bool{
 if(nan(a)||nan(b)||(zero(a)&&zero(b))){return false;}
 let sa=a.y>>31u;let sb=b.y>>31u;if(sa!=sb){return sa!=0u;}
 return select(ul(a,b),ul(b,a),sa!=0u);
}
fn fp_min(a:vec2<u32>,b:vec2<u32>)->vec2<u32>{
 if(nan(a)||nan(b)){return fp_nan();}if(zero(a)&&zero(b)){return vec2<u32>(0u,(a.y|b.y)&0x80000000u);}return select(b,a,fp_lt(a,b));
}
fn fp_max(a:vec2<u32>,b:vec2<u32>)->vec2<u32>{
 if(nan(a)||nan(b)){return fp_nan();}if(zero(a)&&zero(b)){return vec2<u32>(0u,(a.y&b.y)&0x80000000u);}return select(a,b,fp_lt(a,b));
}
fn fp_floor(a:vec2<u32>)->vec2<u32>{
 let exponent=i32((a.y>>20u)&2047u)-1023;
 if(exponent>=52||zero(a)||nan(a)){return a;}
 let negative=(a.y&0x80000000u)!=0u;
 if(exponent<0){return select(vec2<u32>(0u),vec2<u32>(0u,0xbff00000u),negative);}
 let shift=u32(52-exponent);var mask:vec2<u32>;
 if(shift>=32u){mask=vec2<u32>(0xffffffffu,(1u<<(shift-32u))-1u);}
 else{mask=vec2<u32>((1u<<shift)-1u,0u);}
 let truncated=a&~mask;
 if(negative&&any(a!=truncated)){return fp_sub(truncated,vec2<u32>(0u,0x3ff00000u));}
 return truncated;
}
fn fp_bool(value:bool)->vec2<u32>{return select(vec2<u32>(0u),vec2<u32>(0u,0x3ff00000u),value);}
`;
