import { ref, shallowRef } from 'vue'
import { usesPrimaryTime } from '../../beta-data/team-engine/action-timing.mjs'
import { defaultTeamCharacter } from '../../beta-data/team-dps-character-rules.mjs'

// Editor tests run the Vue setup in a VM with imports stripped. Supply the
// navigation and sharing collaborators for tests that only exercise local edits.
export const teamEditorEnvironment = {
    shallowRef, usesPrimaryTime, defaultTeamCharacter,
    navigator: { userAgent: '' },
    useRouter: () => ({}),
    useRoute: () => ({ path:'/team-optimization', query:{} }),
    useAxisSharing: () => ({ open:ref(false), close() {}, entryStatus: () => '' }),
    shareLoginReturn: { draft: null },
    useMiyousheStore: () => ({ selectedUid:ref('') }),
    onActivated() {}, setInterval: () => 1, clearInterval() {},
}
