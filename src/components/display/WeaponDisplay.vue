<template>
<!--    <div class="root">-->
<!--        <el-popover-->
<!--            placement="right"-->
<!--            trigger="hover"-->
<!--            :visible-arrow="true"-->
<!--        >-->
<!--            <img class="image" :src="data.url" slot="reference" >-->
            <div class="detail">
                <slot name="image" :src="data.url"><img class="image" :src="data.url" alt="" /></slot>
                <div class="detail-body">
                    <p class="name">{{ ta(nameLocaleIndex) }}<WeaponBaseStats :weapon="weapon" /></p>
                    <p class="description" v-if="data.effect && ta(effectLocaleIndex)" v-html="ta(effectLocaleIndex)"></p>
                </div>

            </div>
<!--        </el-popover>-->
<!--    </div>-->
</template>

<script>
import { weaponData } from "@weapon"
import WeaponBaseStats from "./WeaponBaseStats.vue"
import {useI18n} from "../../i18n/i18n";

export default {
    name: "WeaponDisplay",
    components: {WeaponBaseStats},
    props: {
        weapon: {type: Object, required: true},
    },
    computed: {
        data() {
            return weaponData[this.weapon.name]
        },

        nameLocaleIndex() {
            return this.data.nameLocale
        },

        effectLocaleIndex() {
            return this.data.effect
        },
    },
    setup() {
        const { t, ta } = useI18n()

        return {
            t,
            ta
        }
    }
}
</script>

<style scoped lang="scss">
$size: 64px;

p {
    font-size: 12px;
    color: #606266;
}

.image {
    width: $size;
    height: $size;
    border-radius: 50%;
}

.detail {
    display: flex;
    //align-items: flex-start;

    .detail-body {
        padding-left: 12px;

        .name {
            margin-top: 0;
            margin-bottom: 12px;
            font-weight: bold;
        }

        .description {
            margin: 0;
            word-break: break-all;

            // Generated weapon text sets the refinement color inline.
            :deep(span[style*="#409eff" i]) {
                color: var(--cx-gold) !important;
            }
        }
    }
}
</style>
