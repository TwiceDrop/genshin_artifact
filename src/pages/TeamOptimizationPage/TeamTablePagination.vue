<script setup lang="ts">
import { PaginationRoot, PaginationList, PaginationListItem, PaginationPrev, PaginationNext, PaginationEllipsis } from 'radix-vue'
import UiButton from '@/components/ui/UiButton.vue'
import { useI18n } from '@/i18n/i18n'

defineProps<{ modelValue: number; pageSize: number; total: number }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: number): void }>()
const { locale } = useI18n()
</script>

<template>
    <PaginationRoot :page="modelValue" :items-per-page="pageSize" :total="total" :sibling-count="2" show-edges
        @update:page="emit('update:modelValue', $event)">
        <PaginationList v-slot="{ items }" class="team-pagination">
            <PaginationPrev as-child><UiButton size="small" :aria-label="locale === 'en' ? 'Previous page' : '上一页'"><i-ep-arrow-left aria-hidden="true" /></UiButton></PaginationPrev>
            <template v-for="(item, index) in items" :key="item.type === 'page' ? item.value : 'ellipsis-' + index">
                <PaginationListItem v-if="item.type === 'page'" :value="item.value" as-child>
                    <UiButton size="small" :variant="item.value === modelValue ? 'primary' : 'outline'">{{ item.value }}</UiButton>
                </PaginationListItem>
                <PaginationEllipsis v-else :index="index">…</PaginationEllipsis>
            </template>
            <PaginationNext as-child><UiButton size="small" :aria-label="locale === 'en' ? 'Next page' : '下一页'"><i-ep-arrow-right aria-hidden="true" /></UiButton></PaginationNext>
        </PaginationList>
    </PaginationRoot>
</template>

<style scoped>
.team-pagination { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-top: 10px; }
.team-pagination :deep([data-slot="button"]) { min-width: 32px; min-height: 28px; padding-inline: 8px; }
</style>
