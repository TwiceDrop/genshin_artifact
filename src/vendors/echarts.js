import Vue from "vue"
// echarts relies on composition-api
// import "@vue/composition-api"
import { use } from "echarts/core"
import { CanvasRenderer } from "echarts/renderers"
import {
    LineChart,
    PieChart,
    BarChart
} from "echarts/charts"
import {
    TooltipComponent,
    VisualMapComponent,
    ToolboxComponent,
    LegendComponent,
    GridComponent,
    TitleComponent,
} from "echarts/components"

import VueECharts from "vue-echarts"

use([
    CanvasRenderer,
    LineChart,
    PieChart,
    BarChart,
    TooltipComponent,
    VisualMapComponent,
    ToolboxComponent,
    LegendComponent,
    GridComponent,
    TitleComponent
])

Vue.component("v-chart", VueECharts)