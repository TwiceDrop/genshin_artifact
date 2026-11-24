import { usePresetStore } from '@/store/pinia/preset'
import { useI18n } from '@/i18n/i18n'
import characters from '@/assets/_gen_character'

// Mixed-character pickers need the wearer as well as the UID to distinguish game presets.
export function useCharacterPresetLabel() {
    const presets = usePresetStore(), { ta } = useI18n()
    return name => {
        const item = presets.getPreset(name)?.item
        const role = item && characters[item.character.name]
        const label = presets.displayName(name)
        return item?.miyousheKey && role ? label + ' · ' + ta(role.nameLocale) : label
    }
}
