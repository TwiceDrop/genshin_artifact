<template>
    <div class="export-tools cx-scope">
        <h2>导出工具汇总</h2>
        <div class="tool-grid">
            <export-tool-item
                v-for="(item, index) in items"
                :key="index"
                :name="item.name"
                :description="item.description"
                :buttons="item.buttons"
            ></export-tool-item>
        </div>

        <details class="tool-archive">
            <summary><span>其他工具</span><icon-ep-arrow-right class="tool-archive-arrow" aria-hidden="true" /></summary>
            <p class="tool-archive-note" role="note"><icon-ep-warning-filled aria-hidden="true" />这些工具已经停更，请勿使用</p>
            <div class="tool-grid archived">
                <export-tool-item
                    v-for="(item, index) in nonActiveItems"
                    :key="index"
                    :name="item.name"
                    :description="item.description"
                    :buttons="item.buttons"
                ></export-tool-item>
            </div>
        </details>
    </div>
</template>

<script setup lang="ts">
import ExportToolItem from "./ExportToolItem.vue"

import IconFa6BrandsGithub from "~icons/fa6-brands/github"

const items = [
    {
        name: "GOODScanner",
        description: "",
        buttons: [
            {
                label: "项目地址",
                primary: true,
                link: "https://github.com/Anyrainel/GOODScanner",
                icon: IconFa6BrandsGithub
            }
        ]
    },
    {
        name: "yas",
        description: "当前维护的 Yet Another Scanner（YAS）圣遗物扫描器",
        buttons: [
            {
                label: "项目地址",
                primary: true,
                link: "https://github.com/1803233552/yas",
                icon: IconFa6BrandsGithub
            }
        ]
    }
]

const nonActiveItems = [
    {
        name: "Genshin Art Scanner（已停更）",
        description: "本地识别，基本实现全自动，无UI模式，速度大致每分钟100-200个",
        buttons: [
            {
                label: "项目地址",
                primary: true,
                link: "https://github.com/ProblemFactory/GenshinArtScanner",
                icon: IconFa6BrandsGithub
            }
        ]
    },
    {
        name: "椰羊cocogoat（已停更）",
        description: "本地识别，基本实现全自动，有UI。椰羊的原项目地址已经改为椰羊的成就管理",
        buttons: [
            {
                label: "项目地址",
                primary: true,
                link: "https://github.com/YuehaiTeam/cocogoat",
                icon: IconFa6BrandsGithub
            },
            {
                label: "下载地址",
                primary: false,
                link: "https://77.cocogoat.work/v1/ascension/",
                icon: IconFa6BrandsGithub
            }
        ]
    },
    {
        name: "蹦蹦炸弹（已停更）",
        description: "使用百度API进行远程OCR自动识别，缺点是需要注册百度AI账号",
        buttons: [
            {
                label: "项目地址",
                primary: true,
                link: "https://github.com/kites262/JumpyDumpty",
                icon: IconFa6BrandsGithub
            },
        ]
    },
]

// export default {
//     name: "ExportToolPage",
//     methods: {
//         getIndex() {
//             iter += 1;
//             return iter;
//         }
//     }
// }
</script>

<style scoped>
/* 导出工具汇总（夜空风格）：颜色读 src/styles/content-theme.css 的 --cx-* */
.export-tools {
    box-sizing: border-box;
    min-height: calc(100vh - 48px);
    padding: 16px clamp(10px, 1.3vw, 18px) 18px;
    border-radius: var(--cx-radius);
    background: var(--cx-ground);
    color: var(--cx-letter);
}

.export-tools h2 {
    margin: 0 0 14px;
    font-size: 20px;
    font-weight: 700;
}

.tool-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(360px, 100%), 1fr));
    gap: 12px;
}

.tool-archive {
    margin-top: 20px;
}

.tool-archive summary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 999px;
    background: var(--cx-card);
    color: var(--cx-dim);
    font-weight: 600;
    cursor: pointer;
    list-style: none;
}

.tool-archive summary::-webkit-details-marker {
    display: none;
}

.tool-archive summary:hover {
    background: var(--cx-step-2);
    color: var(--cx-letter);
}

.tool-archive summary:focus-visible {
    outline: 2px solid var(--cx-gold);
    outline-offset: 2px;
}

.tool-archive-arrow {
    transition: transform .15s ease;
}

.tool-archive[open] .tool-archive-arrow {
    transform: rotate(90deg);
}

.tool-archive-note {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 14px 0 12px;
    color: var(--cx-gold);
    font-size: 13px;
}

.archived {
    opacity: .6;
}

@media (prefers-reduced-motion: reduce) {
    .tool-archive-arrow {
        transition: none;
    }
}
</style>
