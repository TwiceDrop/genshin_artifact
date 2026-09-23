// Keep the published character implementations. The new target evaluates their
// actual Stellar Swirl damage inside the same WASM used by the damage panel.
export const MIZUKI_STELLAR_TARGET = 'YumemizukiMizukiStellarSwirl';
export function mizukiStellarTarget(target, character) {
    if(target?.name!==MIZUKI_STELLAR_TARGET)return target;
    if(character?.name!=='YumemizukiMizuki')throw Error('瑞希星扩散目标仅适用于梦见月瑞希');
    // The UI retains the selected target name when a user switches to custom
    // DSL. Keep their source and only normalize the enum for the old core.
    if(target.use_dsl)return {...target,name:'YumemizukiMizukiDefault',params:'NoConfig'};
    const mode=target.params?.[MIZUKI_STELLAR_TARGET]?.mode??0;
    if(!Number.isInteger(mode)||mode<0||mode>3)throw Error('瑞希星扩散目标类型无效');
    if(mode===1&&character.constellation<1)throw Error('一命额外星扩散目标需要解锁瑞希一命');
    const skill=mode===1?'C1StellarSwirl':'TalentStellarSwirl';
    const reaction=['direct_stellarswirl','direct_stellarswirl','stellarswirl_anemo','stellarswirl_cryo'][mode];
    return {name:'YumemizukiMizukiDefault',params:'NoConfig',use_dsl:true,dsl_source:`dmg hit = YumemizukiMizuki.${skill}\nresult = hit.${reaction}.e`};
}
export function createStrengthenedFacade(base, transformStellarTarget = input => input) {
    const newTargets=new Set([MIZUKI_STELLAR_TARGET,'SandroneStellarSwirl']);
    const usesTarget=input=>newTargets.has(input?.target_function?.name)||newTargets.has(input?.tf?.name)||input?.single_interfaces?.some(usesTarget);
    function prepare(input) {
        if(!input||typeof input!=='object')return input;
        if(Array.isArray(input.single_interfaces))return {...input,single_interfaces:input.single_interfaces.map(prepare)};
        const selected=input.target_function||input.tf;
        if(input.enemy&&newTargets.has(selected?.name)&&!selected.use_dsl){
            // Published optimization uses a fixed 10% enemy resistance. These
            // targets each deal one element, so an additive resistance offset
            // preserves every candidate's own debuffs and all resistance branches.
            const mode=selected.params?.[selected.name]?.mode??0;
            const key=selected.name==='SandroneStellarSwirl'||mode===3?'cryo_res':'anemo_res';
            const resistance=input.enemy[key]??.1;
            if(typeof resistance!=='number'||!Number.isFinite(resistance))throw Error('星扩散目标的敌人抗性无效');
            const offset=(.1-resistance)*100;
            input={...input,enemy:null,buffs:[...(input.buffs||[]),...(offset?[{name:'ResMinus',config:{ResMinus:{p:offset}}}]:[])]};
        }
        if(input.target_function?.name!==MIZUKI_STELLAR_TARGET&&input.tf?.name!==MIZUKI_STELLAR_TARGET)return input;
        const out={...input};
        for(const key of ['target_function','tf'])if(out[key])out[key]=mizukiStellarTarget(out[key],input.character);
        return out;
    }
    return Object.fromEntries(Object.entries(base).map(([name,Class])=>[name,name==='TransformativeDamage'?Class:new Proxy(Class,{get(target,method){
        const fn=Reflect.get(target,method);if(typeof fn!=='function')return fn;
        return (...args)=>{
            if(usesTarget(args[0])&&name==='CalcArtifactBestSet')
                throw Error('星扩散目标暂不支持理论套装排行，请使用实际库存配装。');
            if(name==='CommonInterface'&&method==='get_artifacts_rank_by_character'&&args[2]?.name===MIZUKI_STELLAR_TARGET)
                throw Error('瑞希星扩散目标按实际伤害配装，不提供静态评分；请使用单人配装。');
            return fn(transformStellarTarget(prepare(args[0])),...args.slice(1));
        };
    }})]));
}
