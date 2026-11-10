import {ref,computed,watchEffect} from 'vue';

// A preview URL is temporary. A deliberate Settings choice is remembered.
const requested=new URLSearchParams(location.search).get('theme');
const preference=matchMedia('(prefers-color-scheme: dark)');
const systemDark=ref(preference.matches);
export const colorMode=ref(requested||localStorage.getItem('mona_color_mode')||'auto');
export const darkMode=computed(()=>colorMode.value==='dark'||colorMode.value==='auto'&&systemDark.value);
watchEffect(()=>{
 document.documentElement.dataset.colorMode=darkMode.value?'dark':'light';
 document.documentElement.classList.toggle('dark',darkMode.value);
});
preference.addEventListener('change',event=>{systemDark.value=event.matches});
export function setColorMode(mode){
 colorMode.value=mode;
 localStorage.setItem('mona_color_mode',mode);
 const url=new URL(location.href);
 url.searchParams.delete('theme');
 history.replaceState(history.state,'',url);
}

const axis={axisLine:{lineStyle:{color:'#52667d'}},axisTick:{lineStyle:{color:'#52667d'}},axisLabel:{color:'#afbed0'},splitLine:{lineStyle:{color:'#2b394a'}}};
export const chartTheme=computed(()=>darkMode.value?{
 backgroundColor:'transparent',textStyle:{color:'#afbed0'},title:{textStyle:{color:'#e4ebf5'},subtextStyle:{color:'#afbed0'}},
 legend:{textStyle:{color:'#c5d1e0'}},tooltip:{backgroundColor:'#222e3d',borderColor:'#42546b',textStyle:{color:'#e4ebf5'}},
 categoryAxis:axis,valueAxis:axis,logAxis:axis,timeAxis:axis,
 color:['#87b7ed','#83c7a3','#dbb674','#ee8c91','#bb9be7','#81c7d0'],
 pie:{label:{color:'#c5d1e0'},labelLine:{lineStyle:{color:'#6e829c'}}},
}:undefined);
