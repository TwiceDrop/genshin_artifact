const action=(id,label,riftInput=false,timing={})=>({id,label,riftInput,...timing});
export const TEAM_ACTION_CATALOG={
 Mona:[action('burst','星命定轨',false,{bubbleInput:true,endOffsetMs:1000/60}),action('skill','水中幻愿·点按',false,{endOffsetMs:329/60*1000}),action('skill.hold','水中幻愿·长按',false,{endOffsetMs:344/60*1000}),action('charged','重击')],
 Skirk:[action('skill','元素战技·点按'),action('skill.hold','元素战技·长按',true),action('burst','元素爆发',true,{endOffsetMs:158/60*1000}),...Array.from({length:5},(_,i)=>action('normal.'+(i+1),'普通攻击·第'+(i+1)+'式')),action('charged','重击',true)],
 Furina:[action('skill','孤心沙龙',false,{endOffsetMs:300}),action('burst','万众狂欢',false,{endOffsetMs:2000}),...Array.from({length:4},(_,i)=>action('normal.'+(i+1),'普通攻击·第'+(i+1)+'段',false,{endOffsetMs:500})),action('charged','重击·切换荒芒'),action('plunge','高空下落攻击'),action('plunge.low','低空下落攻击'),action('plunge.collision','下落期间伤害')],
 Escoffier:[action('skill','冻霜芭菲'),action('burst','花刀技法'),action('normal.1','普通攻击·一段'),action('charged','重击'),action('plunge','下落攻击')],
 Vodyanitsa:[action('skill','晨声纷流'),action('burst','终奏·伴尔沉沦'),action('normal.1','普通攻击·一段'),action('charged','重击'),action('plunge','下落攻击')],
};
