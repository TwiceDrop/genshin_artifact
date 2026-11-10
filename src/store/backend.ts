import localforage from "localforage"

const BACKEND_META_KEY = 'backend_meta'
const BACKEND_VERSION = 1

export interface BackendMeta {
    version: number;
    lastModified: number;
}

function genMeta(): BackendMeta {
    return {
        version: BACKEND_VERSION,
        lastModified: new Date().getTime(),
    }
}

/**
 * 假设这个存储是足够快的
 */
class LocalBackend {
    // localforage apis all return Promise

    // clear = localforage.clear.bind(localforage)
    // getItem = localforage.getItem.bind(localforage)
    // setItem = localforage.setItem.bind(localforage)
    // removeItem = localforage.removeItem.bind(localforage)

    exportContent(): Promise<[[string, any][], BackendMeta]> {
        const content = [] as [string, any][]
        let meta: BackendMeta
        return localforage.iterate((value, key) => {
            if (key === BACKEND_META_KEY) {
                meta = value as BackendMeta
            } else {
                content.push([key, value])
            }
        }).then(() => [content, meta])
    }

    async importContent(content: [string, any][], meta: BackendMeta) {
        await localforage.clear()
        for (const [key, value] of content) {
            await localforage.setItem(key, value)
        }
        await localforage.setItem(BACKEND_META_KEY, meta)
    }

    async batch(entries: [string, any][], removals: string[], meta: BackendMeta, beforeWrite: () => void = () => {}) {
        await localforage.ready()
        if (localforage.driver() !== localforage.INDEXEDDB) throw new Error('云档案恢复需要 IndexedDB 存储')
        const name = (localforage as any).config('name') as string, storeName = (localforage as any).config('storeName') as string
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(name)
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
        })
        try {
            beforeWrite()
            await new Promise<void>((resolve, reject) => {
                const transaction = db.transaction(storeName, 'readwrite'), store = transaction.objectStore(storeName)
                transaction.oncomplete = () => resolve()
                transaction.onabort = () => reject(transaction.error || new Error('云档案写入已中止'))
                transaction.onerror = () => reject(transaction.error)
                for (const key of removals) store.delete(key)
                for (const [key, value] of entries) store.put(value, key)
                store.put(meta, BACKEND_META_KEY)
            })
        } finally { db.close() }
    }

    async getMeta(): Promise<BackendMeta | null> {
        return await localforage.getItem(BACKEND_META_KEY)
    }

    async getItem(key: string) {
        const content = await localforage.getItem(key)
        return typeof content === 'string' ? JSON.parse(content) : content
    }

    async setItem(key: string, value: any, meta: BackendMeta) {
        await localforage.setItem(key, value)
        await localforage.setItem(BACKEND_META_KEY, meta)
    }

    async removeItem(key: string, meta: BackendMeta) {
        await localforage.removeItem(key)
        await localforage.setItem(BACKEND_META_KEY, meta)
    }
}

class ModifiedExternallyError extends Error {}

/**
 * 1. 文件读写API速度较慢，但同一时间可能有多个写请求，因此有写优化（仅保留最后一次写）
 * 2. 考虑到文件可能会被外部修改（云盘同步），内部在内存维护一个元数据以及一个元数据文件的handle
 *    每次写之前检查两个元数据的一致性，若不一致立刻断开连接
 * 3. 写的API返回promise，但如果后续有新的写入，这次写入可能被忽略
 * 4. 提供一个等待所有写完成的接口（须保证接口返回前无新的写请求）
 * 5. 读的API返回的是对该key的所有写完成之后的内容
 */
class FileBackend {
    private dirHandle: any = null
    private metaFileHandle: any = null
    private meta: BackendMeta | null = null
    private keyWriteSequence: Map<string, Promise<void>> = new Map()

    private async clear() {
        this.metaFileHandle = null
        const promises = []
        for await (const name of this.dirHandle.keys()) {
            promises.push(this.dirHandle.removeEntry(name))
        }
        await Promise.all(promises)
    }

    private async readMeta(): Promise<BackendMeta | null> {
        if (!this.metaFileHandle) {
            return null
        }
        try {
            const file = await this.metaFileHandle.getFile()
            return JSON.parse(await file.text())
        } catch (err: any) {
            if (err.name !== 'NotFoundError') {
                this.metaFileHandle = null
                console.error(err)
            }
            return null
        }
    }

    private async checkMeta() {
        const meta = await this.readMeta()
        if (!(this.meta?.version === meta?.version && this.meta?.lastModified === meta?.lastModified)) {
            throw new ModifiedExternallyError()
        }
    }

    private async updateMeta(meta: BackendMeta) {
        if (!this.metaFileHandle) {
            this.metaFileHandle = await this.dirHandle!.getFileHandle(BACKEND_META_KEY + '.json', { create: true })
        }
        const writable = await this.metaFileHandle.createWritable()
        await writable.write(JSON.stringify(meta))
        await writable.close()
        this.meta = Object.assign({}, meta)
    }

    private async write(key: string, value: string) {
        const filename = key + '.json'
        const fileHandle = await this.dirHandle!.getFileHandle(filename, { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(value)
        await writable.close()
    }

    private async delete(key: string) {
        const filename = key + '.json'
        try {
            const fileHandle = await this.dirHandle!.getFileHandle(filename)
            await fileHandle.remove()
        } catch (err: any) {
            if (err.name !== 'NotFoundError') {
                console.error(err)
            }
        }
    }

    async prompt() {
        if (this.dirHandle !== null) {
            return true
        }
        try {
            this.dirHandle = await (window as any).showDirectoryPicker({
                mode: 'readwrite'
            })
        } catch (err) {
            return false
        }
        try {
            this.metaFileHandle = await this.dirHandle.getFileHandle(BACKEND_META_KEY + '.json')
            this.meta = await this.readMeta()
        } catch (err) {
            this.metaFileHandle = null
            this.meta = null
        }
        return true
    }

    disconnect() {
        this.dirHandle = null
    }

    connected() {
        return this.dirHandle !== null
    }

    async allWritten() {
        if (!this.dirHandle) {
            throw new Error('The file backend is not connected')
        }
        while (this.keyWriteSequence.size > 0) {
            await Promise.all(Array.from(this.keyWriteSequence.values()))
        }
    }

    async exportContent(): Promise<[[string, any][], BackendMeta]> {
        await this.allWritten()
        const promises = []
        for await (const entry of this.dirHandle.values()) {
            const promise = (entry.getFile() as Promise<File>)
                .then(file => file.text())
                .then(text => [entry.name.slice(0, -5), JSON.parse(text)] as [string, any])
            promises.push(promise)
        }
        const result = await Promise.all(promises)
        let meta: BackendMeta
        const content = result.filter((value) => {
            if (value[0] === BACKEND_META_KEY) {
                meta = value[1]
                return false
            } else {
                return true
            }
        })
        return [content, meta!]
    }

    async importContent(content: [string, any][], meta: BackendMeta) {
        if (!this.dirHandle) {
            throw new Error('file backend is not connected')
        }
        await this.clear()
        await Promise.all(content.map(value => this.write(value[0], JSON.stringify(value[1]))))
        await this.updateMeta(meta)
    }

    async getMeta() {
        await this.allWritten()
        return await this.readMeta()
    }

    async getItem(key: string) {
        if (!this.dirHandle) {
            throw new Error('file backend is not connected')
        }
        while (true) {
            const seq = this.keyWriteSequence.get(key)
            if (seq) {
                await seq
            } else {
                break
            }
        }
        const filename = key + '.json'
        try {
            const fileHandle = await this.dirHandle.getFileHandle(filename)
            const file = await fileHandle.getFile()
            return JSON.parse(await file.text())
        } catch (err: any) {
            if (err.name !== 'NotFoundError') {
                console.error(err)
            }
            return null
        }
    }

    private pushIntoWriteSequence(key: string, func: () => Promise<void>, meta: BackendMeta) {
        if (!this.dirHandle) {
            throw new Error('file backend is not connected')
        }
        let lastPromise = this.keyWriteSequence.get(key) ?? Promise.resolve()
        const thisPromise = lastPromise
            .then(() => {
                if (this.keyWriteSequence.get(key) === thisPromise) {
                    return this.checkMeta()
                        .then(() => func())
                        .then(() => this.updateMeta(meta))
                        .then(() => {
                            if (this.keyWriteSequence.get(key) === thisPromise) {
                                this.keyWriteSequence.delete(key)
                            }
                        })
                }
            })
        this.keyWriteSequence.set(key, thisPromise)
        return thisPromise
    }

    setItem(key: string, value: any, meta: BackendMeta) {
        const fileValue = JSON.stringify(value)
        return this.pushIntoWriteSequence(key, () => this.write(key, fileValue), meta)
    }

    removeItem(key: string, meta: BackendMeta) {
        return this.pushIntoWriteSequence(key, () => this.delete(key), meta)
    }
}

function isWindowActive() {
    return new Promise((resolve, reject) => {
        let timeoutHandle: number
        let animeHandle = window.requestAnimationFrame(() => {
            window.clearTimeout(timeoutHandle)
            resolve(true)
        })
        timeoutHandle = window.setTimeout(() => {
            window.cancelAnimationFrame(animeHandle)
            resolve(false)
        }, 50)
    })
}

class MixedBackend {
    private writeQueue: Promise<void> = Promise.resolve()
    private writeErrors = new Map<string, any>()
    private mutationListeners = new Set<(event: any) => void>()

    subscribeMutations(callback: (event: any) => void) {
        this.mutationListeners.add(callback)
        return () => this.mutationListeners.delete(callback)
    }

    private enqueue(keys: string[], action: () => Promise<void>, event: any) {
        const task = this.writeQueue.then(action)
        this.writeQueue = task.then(() => { for (const key of keys) this.writeErrors.delete(key) }, error => {
            for (const key of keys) this.writeErrors.set(key, error)
        })
        for (const callback of this.mutationListeners) callback(event)
        return task
    }
    constructor(
        private fileBackend = new FileBackend(),
        private localBackend = new LocalBackend(),
        private callbacks: Record<string, Function> = {}
    ) {}

    on(event: string, callback: Function) {
        this.callbacks[event] = callback
    }

    disconnectFileBackend() {
        this.fileBackend.disconnect()
        this.callbacks['cancelFileBackend']?.apply(undefined)
    }

    async prompt() {
        if (!(await this.fileBackend.prompt())) {
            return null
        }
        return [
            await this.localBackend.getMeta(),
            await this.fileBackend.getMeta(),
        ]
    }

    async sync(type: string) {
        if (type === 'local') {
            await this.fileBackend.importContent(...await this.localBackend.exportContent())
        } else if (type === 'file') {
            await this.localBackend.importContent(...await this.fileBackend.exportContent())
        }
    }

    async allReady() {
        let pending: Promise<void>
        do { pending = this.writeQueue; await pending } while (pending !== this.writeQueue)
        if (this.writeErrors.size) throw this.writeErrors.values().next().value
        if (this.fileBackend.connected()) await this.fileBackend.allWritten()
    }

    // startConsistencyCheck() {
    //     if (this.consistencyCheckHandle) {
    //         return
    //     }
    //     this.consistencyCheckHandle = window.setInterval(async () => {
    //         if (await isWindowActive()) {
    //             this.checkFileUpdate()
    //         }
    //     }, 5000)
    // }

    private async checkConsistency() {
        if (!this.fileBackend.connected()) {
            return
        }
        const localMeta = await this.localBackend.getMeta()
        const fileMeta = await this.fileBackend.getMeta()
        if (localMeta?.version === fileMeta?.version && localMeta?.lastModified === fileMeta?.lastModified) {
            return
        }
        console.log('localMeta', localMeta)
        console.log('fileMeta', fileMeta)
        alert('由于未知原因，本地目录与浏览器存储状态不一致，已停止与本地目录同步。\n' +
            '你可以手动重新同步。\n' +
            'Due to an unknown reason, local directory is inconsistent with the browser storage, synchronization has been stopped.\n' +
            'You can restart synchronization manually.')
        this.fileBackend.disconnect()
        this.callbacks['cancelFileBackend']?.apply(undefined)
        // TODO: check version
    }

    async getItem(key: string) {
        return await this.localBackend.getItem(key)
    }

    setItem(key: string, value: any, options: { source?: string } = {}) {
        const snapshot = JSON.parse(JSON.stringify(value))
        return this.enqueue([key], async () => {
            await this.checkConsistency()
            const meta = genMeta()
            await this.localBackend.setItem(key, snapshot, meta)
            await this.mirror([[key, snapshot]], [], meta)
        }, { keys: [key], entries: [[key, snapshot]], source: options.source || 'local' })
    }

    removeItem(key: string, options: { source?: string } = {}) {
        return this.enqueue([key], async () => {
            await this.checkConsistency()
            const meta = genMeta()
            await this.localBackend.removeItem(key, meta)
            await this.mirror([], [key], meta)
        }, { keys: [key], entries: [], source: options.source || 'local' })
    }

    batch(entries: [string, any][], removals: string[] = [], options: { source?: string, beforeWrite?: () => void } = {}) {
        const snapshot = JSON.parse(JSON.stringify(entries)) as [string, any][], keys = [...snapshot.map(([key]) => key), ...removals]
        return this.enqueue(keys, async () => {
            await this.checkConsistency()
            options.beforeWrite?.()
            const meta = genMeta()
            await this.localBackend.batch(snapshot, removals, meta, options.beforeWrite)
            await this.mirror(snapshot, removals, meta)
        }, { keys, entries: snapshot, source: options.source || 'local' })
    }

    private async mirror(entries: [string, any][], removals: string[], meta: BackendMeta) {
        if (!this.fileBackend.connected()) return
        try {
            for (const key of removals) await this.fileBackend.removeItem(key, meta)
            for (const [key, value] of entries) await this.fileBackend.setItem(key, value, meta)
        } catch (error) {
            if (error instanceof ModifiedExternallyError) {
                this.disconnectFileBackend()
            }
            throw error
        }
    }

}

export default new MixedBackend()
