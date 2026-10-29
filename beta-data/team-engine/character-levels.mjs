export function teamTalentUnlocked(character,stage){
 const level=stage===1?20:60;
 return character.level>level||(character.level===level&&character.ascend);
}
