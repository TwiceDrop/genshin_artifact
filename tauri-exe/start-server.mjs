import {createLocalServer} from './server/local.mjs';
import {LocalUpdater} from './server/updates.mjs';
import {createInterface} from 'node:readline';
import path from 'node:path';

const input = createInterface({input: process.stdin});
function prepareTauriInstall(file) {
    return new Promise((resolve, reject) => {
        const closed = () => { input.off('line', reply); reject(new Error('Tauri 更新连接已关闭')) };
        const reply = line => {
            input.off('close', closed);
            try {
                const result = JSON.parse(line);
                if (!result.ready) throw new Error(result.error || '更新程序未就绪');
                resolve();
            } catch (error) { reject(error); }
        };
        input.once('line', reply);
        input.once('close', closed);
        process.stdout.write('MONA_TAURI_PREPARE ' + JSON.stringify(file) + '\n');
    });
}
const updater = new LocalUpdater({directory: path.join(process.env.MONA_DATA_DIR, '..', 'updates'), prepareTauriInstall,
    notify: () => process.stdout.write('MONA_TAURI_INSTALL\n')});
const server = createLocalServer({updater});
server.on('error', error => { console.error(error); process.exitCode = 1; });
server.listen(Number(process.env.MONA_PORT), '127.0.0.1', () => {
    process.stdout.write(JSON.stringify({port: server.address().port}) + '\n');
});
input.once('close', () => server.close());
