// Independent full-path reference: no expectation rewrite or state merging.
export function enumerate(program,input,{ratios=[]}={}){
 const {nodes,outputs}=program,values=new Float64Array(nodes.length),result=outputs.map(()=>0);let leaves=0,weightSum=0,operations=0;
 function path(start,weight){
  for(let i=start;i<nodes.length;i++){
   const n=nodes[i],a=values[n.args[0]],b=values[n.args[1]];operations++;
   switch(n.op){
    case 'literal':values[i]=n.value;break;case 'input':values[i]=input[n.value];break;
    case 'add':values[i]=a+b;break;case 'sub':values[i]=a-b;break;case 'mul':values[i]=a*b;break;case 'div':values[i]=a/b;break;
    case 'min':values[i]=Math.min(a,b);break;case 'max':values[i]=Math.max(a,b);break;case 'abs':values[i]=Math.abs(a);break;case 'floor':values[i]=Math.floor(a);break;
    case 'lt':values[i]=Number(a<b);break;case 'gt':values[i]=Number(a>b);break;case 'ge':values[i]=Number(a>=b);break;case 'eq':values[i]=Number(a===b);break;
    case 'choose':values[i]=a?b:values[n.args[2]];break;
    case 'bernoulli':
     if(!(a>=0&&a<=1))throw Error('Invalid probability '+a);
     if(a<1){values[i]=0;path(i+1,weight*(1-a));}if(a>0){values[i]=1;path(i+1,weight*a);}return;
    default:throw Error('Unknown operation '+n.op);
   }
  }
  leaves++;weightSum+=weight;outputs.forEach((id,i)=>result[i]+=weight*values[id]);
 }
 path(0,1);for(const ratio of ratios)result[ratio.output]=result[ratio.numerator]/result[ratio.denominator];
 return {values:result,stats:{leaves,weight:weightSum,operations}};
}
