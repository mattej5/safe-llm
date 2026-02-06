
import * as fs from 'fs/promises';
import * as net from 'net';

async function checkLMStudioInstalled() {
    const commonPaths = [
        '/Applications/LM Studio.app',
        `${process.env.HOME}/Applications/LM Studio.app`
    ];

    for (const p of commonPaths) {
        try {
            await fs.access(p);
            console.log(`✅ LM Studio found at: ${p}`);
            return true;
        } catch {
            // continue
        }
    }
    console.log('❌ LM Studio not found in common locations.');
    return false;
}

async function checkLMStudioRunning(port: number = 1234): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(1000);
        socket.on('connect', () => {
            socket.destroy();
            console.log(`✅ LM Studio running on port ${port}`);
            resolve(true);
        });
        socket.on('timeout', () => {
            socket.destroy();
            console.log(`❌ Connection timed out on port ${port}`);
            resolve(false);
        });
        socket.on('error', (err) => {
            socket.destroy();
            console.log(`❌ Error connecting to port ${port}: ${err.message}`);
            resolve(false);
        });
        socket.connect(port, '127.0.0.1');
    });
}

async function main() {
    console.log('Checking installation...');
    await checkLMStudioInstalled();
    console.log('\nChecking if running...');
    await checkLMStudioRunning();
}

main();
