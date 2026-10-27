// Token positions preserve comments and quoted text during DSL adaptation.
export function dslTokens(source) {
    const tokens=[];
    for(let i=0;i<source.length;) {
        const start=i, c=source[i];
        if(/\s/.test(c)) {i++;continue;}
        if(source.startsWith('//',i)) {i=source.indexOf('\n',i+2);if(i<0)i=source.length;continue;}
        if(source.startsWith('/*',i)) {const end=source.indexOf('*/',i+2);i=end<0?source.length:end+2;continue;}
        if(c==='"') {i++;while(i<source.length){if(source[i++]==='\\')i++;else if(source[i-1]==='"')break;}tokens.push({value:source.slice(start,i),start,end:i,type:'string'});continue;}
        if(/[A-Za-z_]/.test(c)){i++;while(i<source.length&&/[A-Za-z_0-9]/.test(source[i]))i++;tokens.push({value:source.slice(start,i),start,end:i,type:'id'});continue;}
        if(/[0-9]/.test(c)){i++;while(i<source.length&&/[0-9.]/.test(source[i]))i++;tokens.push({value:source.slice(start,i),start,end:i,type:'number'});continue;}
        i++;tokens.push({value:c,start,end:i,type:'symbol'});
    }
    return tokens;
}
