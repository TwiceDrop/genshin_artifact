const labels={initialize:'正在初始化计算',compile:'正在构建整队计算图',baseline:'正在计算当前配装明细',detail:'正在计算配装明细',search:'正在联合搜索',bounds:'正在建立属性上界',finalize:'正在计算最佳配装明细',complete:'计算完成'};
export const teamDpsProgressIndeterminate=progress=>!['search','complete'].includes(progress?.phase);
export function teamDpsProgressText(progress){
 const title=labels[progress?.phase]||labels.initialize;
 const backend=progress?.backendStage==='gpu-compile'?' · 正在准备GPU计算':'';
 const segment=progress?.segments?` · 计算段 ${progress.segment}/${progress.segments}`:'';
 return title+backend+segment;
}
