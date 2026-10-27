import fs from 'node:fs';
import {parseTeamDpsConfiguration} from '../../beta-data/team-dps-config.mjs';
export const importedAxis=()=>parseTeamDpsConfiguration(fs.readFileSync(new URL('../../examples/team-dps/skirk-vodyanitsa-20_5.mona-axis.json',import.meta.url),'utf8'));
