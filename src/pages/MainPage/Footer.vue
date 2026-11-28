<template>
    <footer class="footer">
        <span>©{{ year }} 莫娜占卜铺</span>
        <span>#{{ revision }} {{ date }}</span>
        <a target="_blank" rel="noopener" href="https://github.com/TwiceDrop/genshin_artifact">Github</a>
    </footer>
</template>

<script>
export default {
    name: "Footer",
    data() {
        return {
            revision: process.env.MONA_REVISION,
            date: process.env.MONA_BUILD_DATE,
            year: (new Date()).getFullYear(),
        }
    }
}
</script>

<style scoped>
.footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 2px 8px;
    color: var(--cx-dim);
    font-size: 11px;
    line-height: 1.4;
}

.footer > * + * {
    padding-inline-start: 8px;
    border-inline-start: 1px solid var(--cx-step-2);
}

.footer a {
    color: inherit;
    text-decoration: none;
}

.footer a:is(:hover, :focus-visible) {
    color: var(--cx-letter);
    text-decoration: underline;
}
</style>
