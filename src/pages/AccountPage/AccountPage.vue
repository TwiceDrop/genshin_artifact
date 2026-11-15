<template>
    <div class="account-page cx-scope">
<!--        <el-dialog-->
<!--            :title="t('accountPage.chooseSyncBase')"-->
<!--            width="30%"-->
<!--            v-model="showSyncDialog"-->
<!--            @closed="handleSyncDialogClosed"-->
<!--        >-->
<!--            <div>-->
<!--                <el-button-->
<!--                    @click="selectSyncType('local')"-->
<!--                >-->
<!--                    {{ t('accountPage.browserBase') }} ( {{ t('accountPage.lastModifiedAt') + new Date(localLastModified).toLocaleString()}} )-->
<!--                </el-button>-->
<!--            </div>-->
<!--            <div style="margin-top: 10px;">-->
<!--                <el-button-->
<!--                @click="selectSyncType('file')"-->
<!--                >-->
<!--                    {{ t('accountPage.fileBase') }} ( {{ t('accountPage.lastModifiedAt') + new Date(fileLastModified).toLocaleString()}} )-->
<!--                </el-button>-->
<!--            </div>-->
<!--        </el-dialog>-->

<!--        <div class="top-things">-->
<!--            <el-row>-->
<!--                <el-col :span="6">-->
<!--                    <span>{{ t('accountPage.title') }}</span>-->
<!--                </el-col>-->
<!--                <el-col :span="18">-->
<!--                    <div style="float: right">-->
<!--                        <el-button-->
<!--                            type="primary"-->

<!--                            :icon="IconEpSort"-->
<!--                            :disabled="accountStore.syncStatus.value !== 'no sync'"-->
<!--                            @click="handleSync"-->
<!--                        >-->
<!--                            {{ t('accountPage', accountStore.syncStatus.value === 'no sync' ? 'syncButton' : 'syncedButton') }}-->
<!--                        </el-button>-->
<!--                    </div>-->
<!--                </el-col>-->
<!--            </el-row>-->
<!--            <el-divider></el-divider>-->
<!--        </div>-->

        <header class="account-bar">
            <h2>账号</h2>
            <button type="button" class="account-add" @click="addAccount"><icon-ep-plus aria-hidden="true" />{{ t('accountPage.addAccount') }}</button>
        </header>

        <div class="account-grid">
            <div
                v-for="{id, name} in accountStore.allAccounts"
                :key="id"
                class="account-card"
                :class="{ active: id === accountStore.currentAccountId.value }"
                :aria-current="id === accountStore.currentAccountId.value ? 'true' : undefined"
                @click="handleChangeAccount(id)"
            >
                <span class="account-avatar" aria-hidden="true">{{ (name || '?').slice(0, 1).toUpperCase() }}</span>
                <click-edit-label
                    :value="name"
                    @input="newName => handleChangeName(id, name, newName)"
                    fontsize="16px"
                    :editable="true"
                    class="account-name"
                ></click-edit-label>
                <icon-ep-circle-check-filled v-if="id === accountStore.currentAccountId.value" class="account-check" aria-hidden="true" />
                <!-- 确认气泡渲染在卡片里（:teleported="false" 才能取到配色），点击不能冒泡到卡片去切换账号 -->
                <span v-else class="account-delete-wrap" @click.stop>
                <el-popconfirm
                    :title="t('accountPage.confirmDelete')"
                    :confirm-button-text="t('accountPage.delete')"
                    :cancel-button-text="t('misc.cancel')"
                    :teleported="false"
                    @confirm="handleDeleteAccount(id)"
                >
                    <template #reference>
                        <button type="button" class="account-delete" :title="t('accountPage.delete')" :aria-label="t('accountPage.delete') + ' ' + name" @click.stop="">
                            <icon-ep-delete aria-hidden="true" />
                        </button>
                    </template>
                </el-popconfirm>
                </span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus"
import ClickEditLabel from "@c/misc/ClickEditLabel"
import IconEpSort from "~icons/ep/sort"
import {useI18n} from "@/i18n/i18n"
import IconEpPlus from "~icons/ep/plus"
import IconEpCircleCheckFilled from "~icons/ep/circle-check-filled"
import IconEpDelete from "~icons/ep/delete"

import { useAccountStore, deleteAccount, changeAccount, reload } from "@/store/pinia/account"
import storeBackend, { BackendMeta } from "@/store/backend"

// i18n
const { t } = useI18n()

const accountStore = useAccountStore()

function addAccount() {
    accountStore.addAccount(t('accountPage.newAccountName'))
}

async function handleDeleteAccount(id: number) {
    const loading = ElLoading.service({
        lock: true,
        text: t('accountPage.deletingAccount')
    })
    await deleteAccount(id)
    loading.close()
}

async function handleChangeAccount(id: number) {
    if (id === accountStore.currentAccountId.value) {
        return
    }
    const loading = ElLoading.service({
        lock: true,
        text: t('accountPage.switchingAccount')
    })

    // ElLoading存在bug，导致滚动条会被拿掉，如果changeAccount太快会导致滚动条突然消失又突然出现，因此这里设置至少切换1s
    let change = changeAccount(id)
    // let timer = new Promise((resolve, reject) => {
    //     setTimeout(() => { resolve(null) }, 1000)
    // })
    // await Promise.all([change, timer])
    await change

    loading.close()
}

function handleChangeName(id: number, oldName: string, newName: string) {
    if (newName !== oldName && newName !== '') {
        accountStore.changeAccountName(id, newName)
    }
}


const showSyncDialog = ref(false)
const localLastModified = ref(0)
const fileLastModified = ref(0)
const selectSyncType = ref<((t: 'local' | 'file') => void) | null>(null)
const handleSyncDialogClosed = ref<(() => void) | null>(null)

function querySyncType(localMeta: BackendMeta | null, fileMeta: BackendMeta | null) {
    return new Promise<string>((resolve, reject) => {
        if (!fileMeta) {
            resolve('local')
            return
        }
        if (!localMeta) {
            resolve('')
            return
        }
        if (localMeta.lastModified === fileMeta.lastModified) {
            resolve('')
            return
        }
        localLastModified.value = localMeta.lastModified
        fileLastModified.value = fileMeta.lastModified
        let resolved = false
        selectSyncType.value = (type) => {
            resolved = true
            showSyncDialog.value = false
            resolve(type)
        };
        handleSyncDialogClosed.value = () => {
            if (!resolved) {
                storeBackend.disconnectFileBackend()
                reject(new Error(t('accountPage.cancelSyncing')))
            }
        }
        showSyncDialog.value = true
    })
}

async function handleSync() {
    const metas = await storeBackend.prompt()
    if (!metas) {
        // alert(t('accountPage.cancelSyncing'))
        // ElMessage.error(t('accountPage.cancelSyncing'))  // TODO: not work
        return
    }
    let type: string
    try {
        type = await querySyncType(metas[0], metas[1])
    } catch (err) {
        storeBackend.disconnectFileBackend()
        // alert(t('accountPage.cancelSyncing'))
        ElMessage.error({ message: t('accountPage.cancelSyncing') })
        return
    }
    await storeBackend.sync(type)
    await reload()
    accountStore.syncStatus.value = 'synced'
}

</script>

<style lang="scss" scoped>
// 账号页（夜空风格）：颜色读 src/styles/content-theme.css 的 --cx-*
.account-page {
    box-sizing: border-box;
    min-height: calc(100vh - 48px);
    padding: 16px clamp(10px, 1.3vw, 18px) 18px;
    border-radius: var(--cx-radius);
    background: var(--cx-ground);
    color: var(--cx-letter);
}

.account-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;

    h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 700;
    }
}

.account-add {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 40px;
    padding: 0 18px;
    border: 0;
    border-radius: 999px;
    background: var(--cx-gold);
    color: var(--cx-gold-on);
    font: inherit;
    font-weight: 700;
    cursor: pointer;

    &:hover {
        filter: brightness(1.08);
    }
}

.account-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr));
    gap: 12px;
}

.account-card {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    padding: 14px 14px 14px 16px;
    border-radius: 16px;
    background: var(--cx-card);
    cursor: pointer;
    transition: box-shadow .15s ease;

    &:hover {
        box-shadow: 0 0 0 2px var(--cx-step-2);
    }

    &.active {
        box-shadow: 0 0 0 2px var(--cx-gold);
        cursor: default;
    }
}

.account-avatar {
    flex: none;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--cx-step-2);
    color: var(--cx-dim);
    font-size: 18px;
    font-weight: 700;
}

.account-card.active .account-avatar {
    background: var(--cx-gold);
    color: var(--cx-gold-on);
}

// 名称可点击改名（ClickEditLabel，只有这一页在用）
.account-name {
    flex: 1;
    min-width: 0;

    :deep(input) {
        padding: 6px 8px;
        border-radius: 8px;
        color: var(--cx-letter);
        font-weight: 600;
        cursor: text;

        &:focus {
            background: var(--cx-step);
        }
    }

    :deep(.border) {
        background: var(--cx-gold);
    }
}

.account-check {
    flex: none;
    width: 22px;
    height: 22px;
    color: var(--cx-gold);
}

.account-delete-wrap {
    flex: none;
    display: flex;
}

.account-delete {
    flex: none;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 0;
    border-radius: 50%;
    background: var(--cx-step);
    color: var(--cx-up);
    cursor: pointer;

    &:hover {
        background: var(--cx-step-2);
    }
}

.account-add:focus-visible,
.account-delete:focus-visible {
    outline: 2px solid var(--cx-gold);
    outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
    .account-card {
        transition: none;
    }
}
</style>
