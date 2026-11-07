// Full IEEE values, not a digest or approximate bucket. Keys are private to an
// in-memory distribution; they are never persisted or shared between devices.
// Preserve signed zero. All NaN payloads share the previous numeric identity.
export function createExactVector(width){
 const values=new Float64Array(width),words=new Uint16Array(values.buffer);
 let normalized,normalizedWords;
 return {values,key(){
  let source=words;
  for(let i=0;i<width;i++)if(Number.isNaN(values[i])){
   if(!normalized){normalized=new Float64Array(width);normalizedWords=new Uint16Array(normalized.buffer);}
   normalized.set(values);
   for(let j=i;j<width;j++)if(Number.isNaN(normalized[j]))normalized[j]=NaN;
   source=normalizedWords;break;
  }
  // Typed-array spread walks the iterator and boxes every word. The array-like
  // call keeps this conversion in the engine; chunk wide vectors explicitly.
  if(source.length<=8192)return String.fromCharCode.apply(null,source);
  let key='';
  for(let offset=0;offset<source.length;offset+=8192)key+=String.fromCharCode.apply(null,source.subarray(offset,offset+8192));
  return key;
 }};
}
