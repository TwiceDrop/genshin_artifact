// Element Plus 组件自带的默认文字（暂无数据、无匹配数据、分页等）跟随界面语言；
// App.vue 根部的 el-config-provider 读这个值。
import {computed} from "vue"
import elementZhCn from "element-plus/es/locale/lang/zh-cn"
import elementEn from "element-plus/es/locale/lang/en"
import {useI18n} from "./i18n"

export const elementLocale = computed(() => useI18n().locale.value === "en" ? elementEn : elementZhCn)
