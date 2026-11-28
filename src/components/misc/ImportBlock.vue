<template>
    <div>
        <UiButton
            class="root"
            :class="{ over: isDragover }"
            :disabled="disabled"
            @dragenter="handleDragEnter"
            @dragleave="handleDragLeave"
            @dragover="handleDragover"
            @drop="handleDrop"
            @click="handleClick"
        >
            <span class="center-div">
                <i-fa6-solid-upload aria-hidden="true" />
                <span>点击，或拖拽上传</span>
            </span>
        </UiButton>
        <p v-if="file" class="filename">{{ file.name }}</p>

        <input type="file" ref="fileInput" class="file-input"
            @change="handleSelectFile"
            :accept="props.accept"
        />
    </div>

</template>

<script setup lang="ts">
// drag drop
import { computed, ref, type Ref } from "vue"
import UiButton from "@/components/ui/UiButton.vue"

const props = defineProps<{
    file: File | null
    accept?: string
    disabled?: boolean
}>()
const emit = defineEmits<{ (event: 'update:file', value: File | null): void }>()

const isDragover = ref(false)

function handleDragEnter(e: DragEvent) {
    e.preventDefault()

    isDragover.value = true
}

function handleDragLeave(e: DragEvent) {
    e.preventDefault()

    isDragover.value = false
}

function handleDragover(e: DragEvent) {
    e.preventDefault()
}


// select or drop file
const file = computed({
    get: () => props.file,
    set: value => emit('update:file', value),
})
const fileInput: Ref<null | HTMLInputElement> = ref(null)

function handleClick() {
    if (!fileInput.value) {
        return
    }

    fileInput.value.click()
}

function handleSelectFile() {
    if (!fileInput.value) {
        return
    }

    if (fileInput.value.files) {
        const files = Array.from(fileInput.value.files)
        // console.log(files)
        if (files.length > 0) {
            file.value = files[0]
        }
    }
}

function handleDrop(ev: DragEvent) {
    ev.preventDefault()

    isDragover.value = false
    if (props.disabled) return

    let f: File | null = null

    if (ev.dataTransfer) {
        if (ev.dataTransfer.items) {
            // Use DataTransferItemList interface to access the file(s)
            for (let i = 0; i < ev.dataTransfer.items.length; i++) {
                // If dropped items aren't files, reject them
                if (ev.dataTransfer.items[i].kind === 'file') {
                    f = ev.dataTransfer.items[i].getAsFile()
                    break
                    // console.log('... file[' + i + '].name = ' + file.name);
                }
            }
        } else {
            // Use DataTransfer interface to access the file(s)
            f = ev.dataTransfer.files[0]
        }
    }


    // if (!file) {
    //     return
    // }

    // let fileReader = new FileReader()
    file.value = f

}

function getReadPromise(): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!file.value) {
            reject("未选择文件")
            return
        }

        try {
            let fileReader = new FileReader()

            fileReader.onload = result => {
                if (result.target) {
                    resolve(result.target.result as string)
                }
            }
            fileReader.onerror = error => {
                reject(error)
            }

            fileReader.readAsText(file.value as File)
        } catch(e) {
            reject(e)
        }
    })
}

defineExpose({
    getReadPromise
})
</script>

<style scoped lang="scss">
.root {
    width: 100%;
    background: var(--cx-card);
    border: 1px dashed #d9d9d9;
    height: 180px;
    border-radius: 5px;
    display: flex;
    //flex-direction: column;
    align-items: center;
    justify-content: center;

    &:hover {
        border: 1px dashed var(--cx-gold);
    }

    &.over {
        border: 1px dashed var(--cx-gold);
        background-color: rgba(32, 159, 255, .06);
    }

    .center-div {
        //text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        //justify-content: center;
        pointer-events: none;

        svg {
            width: 30px;
            height: 30px;
            color: var(--cx-dim);
        }

        span {
            font-size: 14px;
            color: var(--cx-dim);
            margin-top: 8px;
        }
    }
}

.filename {
    font-size: 12px;
    color: var(--cx-dim);
    margin: 0;
    height: 28px;
    line-height: 28px;
}

.file-input {
    display: none;
}
</style>
