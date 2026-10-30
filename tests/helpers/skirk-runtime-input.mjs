import {skirkSeverInput,skirkSeverTeams} from './team-skirk-sever.mjs';
export function skirkRuntimeInput(mode='bonus'){
 const input=skirkSeverInput('control'),a=(id,action,timeMs,params)=>({id,kind:'action',actor:'Skirk',action,timeMs,...(params?{params}:{})});
 if(mode==='form-c2')input.single_interfaces[0].character.constellation=2;
 input.team_dps.axis.timeline=mode==='bonus'?[a('hold','skill.hold',0,{absorbedRifts:1}),a('optional','skill.hold',1000),a('q','burst',2000)]:
  [a('optional','skill',0),a('q','burst',1000,{absorbedRifts:3}),a('normal','normal.3',1100)];
 const teams=skirkSeverTeams(input);teams[1][0].forEach(a=>a.set_name='WanderersTroupe');
 return {input,teams};
}
