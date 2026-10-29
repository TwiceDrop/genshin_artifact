self.onmessage=({data})=>{
 try{self.postMessage({blob:new Blob([JSON.stringify(data,null,2)],{type:'application/json'})});}
 catch(error){self.postMessage({error:error.message});}
};
