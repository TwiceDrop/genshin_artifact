// Types follow WeaponConfig. These gates are sampled as booleans by the native
// bridge; their correlated coverage fields must be sampled in the same variant.
const booleans={
 Azurelight:['zero_energy'],
 AthameArtis:['burst_hit'],SerenitysCall:['reaction_active'],Emberwell:['reaction_active'],
 NightweaversLookingGlass:['skill_active'],DawningFrost:['charged_active','skill_active'],
 ClashOfKings:['active'],ForgedByTheGoldenMelody:['counterpoint_active'],Frostbreath:['active'],EchoesOfTheHeart:['reaction_active'],HymnOfTheMaelstrom:['boosted'],
};
export const equipmentNativeParameters=Object.fromEntries(Object.entries(booleans).flatMap(([name,fields])=>fields.map(field=>['weapon.params.'+name+'.'+field,{zero:false,unit:true}])));

Object.assign(equipmentNativeParameters,{
 'weapon.params.MistsplitterReforged.emblem_level':{values:[0,1,2,3]},
 'weapon.params.ThunderingPulse.stack':{values:[0,1,2,3]},
 'weapon.params.FadingTwilight.state':{values:[0,1,2]},
 'weapon.params.ForgedByTheGoldenMelody.counterpoint_state':{values:[0,1,2,3]},
});
