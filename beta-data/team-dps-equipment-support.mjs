// TeamDPS equipment catalog. The page and joint search share this selection.
export const INCOMPLETE_WEAPONS={};
export const INCOMPLETE_ARTIFACT_SETS={};
export const teamDpsWeaponAvailable=name=>!Object.hasOwn(INCOMPLETE_WEAPONS,name);
export const teamDpsArtifactAvailable=name=>!Object.hasOwn(INCOMPLETE_ARTIFACT_SETS,name);
