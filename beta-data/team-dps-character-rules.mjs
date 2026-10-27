export function teamTalentUnlocked(character,stage){
 const level=stage===1?20:60;
 return character.level>level||(character.level===level&&character.ascend);
}

export const TEAM_CONSTELLATION_TALENTS={
 Skirk:{3:'skill3',5:'skill2'},Furina:{3:'skill3',5:'skill2'},
 Escoffier:{3:'skill2',5:'skill3'},Vodyanitsa:{3:'skill2',5:'skill3'},
};

// Stored talents already include constellation levels. Apply only the change.
export function changeTeamConstellation(character,next){
 for(const [level,skill]of Object.entries(TEAM_CONSTELLATION_TALENTS[character.name])){
  const delta=3*(Number(next>=Number(level))-Number(character.constellation>=Number(level)));
  if(delta)character[skill]=Math.min(14,Math.max(0,character[skill]+delta));
 }
 character.constellation=next;
}
