import {fixture,weapon} from '../../beta-tools/interface-audit-7108.mjs';
import {createActionAxis} from '../../beta-data/team-engine/action-config.mjs';
import {normalizeEnemy} from '../../beta-data/enemy-interface.mjs';
export const action=(id,role,name,time,params)=>({id,kind:'action',actor:'member'+(role+1),action:name,timeMs:time*1000,...(params?{params}:{})});
export const switchTo=(id,role,time)=>({id,kind:'switch',actor:'member'+(role+1),timeMs:time*1000});
export function vesnaInput(rows,cons=[0,0,0,6]){
 const names=['Vesna','Vodyanitsa','Odette','Faruzan'],profiles=names.map((name,r)=>{
  const p=fixture(name);p.character.constellation=cons[r];p.character.skill2=cons[r]>=3?12:9;p.character.skill3=cons[r]>=5?12:9;
  p.weapon=weapon(['DullBlade','ApprenticesNotes','DullBlade','HuntersBow'][r]);p.buffs=[];
  p.artifacts=p.artifacts.map((g,i)=>({...g,id:100*r+i+1,set_name:'Empty',main_stat:[i===0?'HPFixed':i===1?'ATKFixed':r===1?'HPPercentage':'ATKPercentage',i===0?4780:i===1?311:.466],sub_stats:[['ElementalMastery',60],['CriticalRate',.06],['CriticalDamage',.12],...(r===1?[['HPPercentage',.2]]:[])]}));return p;
 });
 const axis=createActionAxis('vesna-synthetic',names);axis.timeline=rows??[action('odette-e',2,'skill',0),action('faruzan-q',3,'burst',.6),action('vody-e',1,'skill',1.7),action('vesna-e',0,'skill',2),action('vesna-e1',0,'skill',2.7),action('vesna-e2',0,'skill',3.2),action('vesna-q',0,'burst',4),action('vesna-e3',0,'skill',6.2),switchTo('end',0,8)];
 return {single_interfaces:profiles,team_dps:{axis,enemy:normalizeEnemy({level:100}),enemy_count:1,damage_scope:'all'}};
}

// Cast times adapted from the reference's mixed cast/hit table. Delayed
// pinions restore essence before each subsequent highest-stage skill.
export function vesnaFullInput(burst=false){
 const shift=burst?1.5:0,main=[
  ['e','skill',5],['e1','skill',5.65],['e2','skill',6.1],['q','burst',6.8],['e3a','skill',8.95],
  ['n1a','normal.1',10.3],['n2a','normal.2',10.65],['n3a','normal.3',11.15],['ca','charged',11.85],['e3b','skill',13.25],
  ['n1b','normal.1',14.6],['n2b','normal.2',14.95],['n3b','normal.3',15.45],['cb','charged',16.15],['e3c','skill',17.55],
 ].map(([id,name,t])=>action('vesna-'+id,0,name,t+shift));
 const setup=burst?[action('odette-q',2,'burst',0),action('odette-e1',2,'skill',2.45),action('odette-e2',2,'skill',2.85),action('faruzan-q',3,'burst',3.95),action('vody-e',1,'skill',5)]:[action('odette-e1',2,'skill',0),action('odette-e2',2,'skill',.45),action('faruzan-e',3,'skill',2),action('faruzan-q',3,'burst',2.3),action('vody-e',1,'skill',4.3)];
 const x=vesnaInput([...setup,...main,switchTo('end',0,19+shift)],burst?[6,6,2,6]:[0,0,0,6]);
 x.team_dps.axis.id=burst?'vesna-odette-burst-20_5s':'vesna-default-19s';x.team_dps.axis.title=burst?'薇斯纳队·奥黛塔开大·20.5秒':'薇斯纳队·19秒';
 const sets=['ScarletProof','TenacityOfTheMillelith','HeartOfTheFurnace','ViridescentVenerer'];
 x.single_interfaces[0].weapon=weapon('BeyondTheChrysalis');x.single_interfaces[1].weapon=weapon('HymnOfTheMaelstrom');x.single_interfaces[3].weapon=weapon('FavoniusWarbow');
 x.single_interfaces.forEach((p,r)=>p.artifacts.forEach((g,i)=>{g.set_name=i<4?sets[r]:'Empty';}));
 return x;
}
