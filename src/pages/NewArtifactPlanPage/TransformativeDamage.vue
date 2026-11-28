<template>
    <div class="reaction-table-wrap">
        <table class="reaction-table">
            <thead><tr><th scope="col">{{ t('misc.type1') }}</th><th scope="col">{{ t('misc.dmg') }}</th></tr></thead>
            <tbody>
                <tr v-for="row in reactionRows" :key="row.key">
                    <th scope="row">{{ row.title || t('dmg', row.key) }}</th>
                    <td>{{ row.value.toFixed(1) }}</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script>
import {useI18n} from "@/i18n/i18n";

export default defineComponent({
    name: "TransformativeDamage",
    props: ["data"],
    computed: {
        reactionRows() {
            let results = []
            results.push({ value: this.data.hyperbloom, key: "hyperbloom" })
            results.push({ value: this.data.burgeon, key: "burgeon" })
            results.push({ value: this.data.bloom, key: "bloom" })
            results.push({ value: this.data.electro_charged, key: "electroCharged" })
            results.push({ value: this.data.overload, key: "overload" })
            results.push({ value: this.data.shatter, key: "shattered" })
            results.push({ value: this.data.superconduct, key: "superConduct" })
            results.push({ value: this.data.burning, key: "burning" })
            results.push({ value: this.data.swirl_electro, key: "swirlElectro" })
            results.push({ value: this.data.swirl_pyro, key: "swirlPyro" })
            results.push({ value: this.data.swirl_cryo, key: "swirlCryo" })
            results.push({ value: this.data.swirl_hydro, key: "swirlHydro" })
            results.push({ value: this.data.crystallize, key: "crystallize" })
            
            return results.filter(row => Number.isFinite(row.value))
        }
    },
    setup() {
        const { t } = useI18n()

        return {
            t
        }
    }
})
</script>

<style scoped>
.reaction-table-wrap { overflow: auto; border: 1px solid var(--cx-step-2); border-radius: 10px; }
.reaction-table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.reaction-table th, .reaction-table td { padding: 9px 12px; border-bottom: 1px solid var(--cx-step-2); text-align: left; }
.reaction-table tr > :last-child { text-align: right; }
.reaction-table thead { background: var(--cx-step); }
.reaction-table tbody th { font-weight: 500; }
.reaction-table tbody tr:last-child > * { border-bottom: 0; }
</style>
