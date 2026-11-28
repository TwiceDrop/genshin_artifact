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

        <header class="account-bar" data-tour="account.header">
            <h2>{{ t('nav.account') }} <PageGuideButton guide-id="detail-account-sync" /></h2>
            <span class="account-actions">
                <button v-if="onlineUser.ready && !onlineUser.user" type="button" class="account-login" @click="router.push({ name: 'login' })"><icon-ep-user aria-hidden="true" />登录在线账号</button>
                <button type="button" class="account-add" @click="addAccount"><icon-ep-plus aria-hidden="true" />{{ t('accountPage.addAccount') }}</button>
            </span>
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
                <!-- 删除控件的点击不能冒泡到卡片去切换账号 -->
                <span v-else class="account-delete-wrap" @click.stop>
                    <UiConfirmPopover
                        :title="t('accountPage.confirmDelete')"
                        :confirm-text="t('accountPage.delete')"
                        :cancel-text="t('misc.cancel')"
                        @confirm="handleDeleteAccount(id)"
                    >
                        <button type="button" class="account-delete" :title="t('accountPage.delete')" :aria-label="t('accountPage.delete') + ' ' + name">
                            <icon-ep-delete aria-hidden="true" />
                        </button>
                    </UiConfirmPopover>
                </span>
            </div>
        </div>
        <UiLoadingOverlay v-if="loadingMessage" :message="loadingMessage" />
    </div>
</template>

<script setup lang="ts">
import PageGuideButton from "@/onboarding/PageGuideButton.vue"
import UiConfirmPopover from "@/components/ui/UiConfirmPopover.vue"
import UiLoadingOverlay from "@/components/ui/UiLoadingOverlay.vue"
import { ElMessage } from "element-plus"
import ClickEditLabel from "@c/misc/ClickEditLabel"
import IconEpSort from "~icons/ep/sort"
import {useI18n} from "@/i18n/i18n"
import {useRouter} from "vue-router"
import {onlineUser} from "@/cloud/online-user.mjs"
import IconEpUser from "~icons/ep/user"
import IconEpPlus from "~icons/ep/plus"
import IconEpCircleCheckFilled from "~icons/ep/circle-check-filled"
import IconEpDelete from "~icons/ep/delete"

import { useAccountStore, deleteAccount, changeAccount, reload } from "@/store/pinia/account"
import storeBackend, { BackendMeta } from "@/store/backend"

// i18n
const { t } = useI18n()

const accountStore = useAccountStore()
const router = useRouter()
const loadingMessage = ref('')

function addAccount() {
    accountStore.addAccount(t('accountPage.newAccountName'))
}

async function handleDeleteAccount(id: number) {
    loadingMessage.value = t('accountPage.deletingAccount')
    try {
        await deleteAccount(id)
    } finally {
        loadingMessage.value = ''
    }
}

async function handleChangeAccount(id: number) {
    if (id === accountStore.currentAccountId.value) {
        return
    }
    loadingMessage.value = t('accountPage.switchingAccount')
    try {
        await changeAccount(id)
    } finally {
        loadingMessage.value = ''
    }
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

.account-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
}

.account-login {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 40px;
    padding: 0 16px;
    border: 0;
    border-radius: 999px;
    background: var(--cx-card);
    color: var(--cx-letter);
    font: inherit;
    cursor: pointer;

    &:hover {
        background: var(--cx-step-2);
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

.account-login:focus-visible,
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
