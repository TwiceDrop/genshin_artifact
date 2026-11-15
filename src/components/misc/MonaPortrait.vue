<template>
    <span class="mona-portrait">
        <img :src="portrait" alt="" />
    </span>
</template>

<script setup>
// 莫娜祈愿立绘（UI_Gacha_AvatarImg_Mona，2048×1024）中 (870, 120) 起 320×320 的脸部特写。
// 欢迎页和侧栏共用；开发者提供正式图标后替换这张图即可。
import portrait from "@/images/misc/mona-portrait.png"
</script>

<style lang="scss" scoped>
// 尺寸由使用方给 .mona-portrait 设置宽高
.mona-portrait {
    display: block;
    border-radius: 50%;
    overflow: hidden;

    img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
}
</style>
