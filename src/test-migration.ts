
import { loadConfig, saveConfig, AgentConfig } from './config-wizard';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';

const CONFIG_FILE = path.join(process.cwd(), 'config.json');

async function testMigration() {
    console.log(chalk.bold('🧪 Testing Config Migration...'));

    // 1. Create legacy config
    const legacyConfig = {
        lmStudioUrl: 'http://legacy-host:1234/v1',
        modelId: 'legacy-model',
        apiKey: 'legacy-key'
    };

    console.log('📝 Writing legacy config:', legacyConfig);
    await fs.writeFile(CONFIG_FILE, JSON.stringify(legacyConfig, null, 2));

    // 2. Load config (should trigger migration)
    console.log('🔄 Loading config...');
    const migratedConfig = await loadConfig();

    // 3. Verify
    console.log('✅ Loaded config:', migratedConfig);

    const passed =
        migratedConfig.provider === 'lm-studio' &&
        migratedConfig.baseUrl === 'http://legacy-host:1234/v1' &&
        migratedConfig.modelId === 'legacy-model' &&
        migratedConfig.apiKey === 'legacy-key' &&
        !('lmStudioUrl' in migratedConfig);

    if (passed) {
        console.log(chalk.green('✅ PASS: Migration successful!'));
        process.exit(0);
    } else {
        console.error(chalk.red('❌ FAIL: Migration failed!'));
        console.error('Expected provider="lm-studio", baseUrl="...", etc.');
        process.exit(1);
    }
}

testMigration().catch(console.error);
