import {createLocalServer} from './server/local.mjs';

const server = createLocalServer();
server.on('error', error => { console.error(error); process.exitCode = 1; });
server.listen(Number(process.env.MONA_PORT), '127.0.0.1', () => {
    process.stdout.write(JSON.stringify({port: server.address().port}) + '\n');
});
process.stdin.resume();
process.stdin.once('end', () => server.close());
