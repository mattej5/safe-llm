
import * as fs from 'fs/promises';
import * as path from 'path';
import * as net from 'net';
import * as readline from 'readline';
import chalk from 'chalk';

const CONFIG_FILE = path.join(process.cwd(), 'config.json');

export type ProviderType = 'lm-studio' | 'ollama' | 'custom';

export interface AgentConfig {
    provider: ProviderType;
    baseUrl: string;
    modelId: string;
    apiKey?: string;
    tavilyApiKey?: string;
    disabledTools?: string[];
    streamResponse?: boolean;
    resendApiKey?: string;
    resendFromEmail?: string;
    primaryEmail?: string;
    scheduledTasks?: ScheduledTask[];
}

export interface ScheduledTask {
    id: string;
    cronExpression: string;
    prompt: string;
    action: 'log' | 'email';
    emailRecipient?: string;
}

const DEFAULT_CONFIG: AgentConfig = {
    provider: 'lm-studio',
    baseUrl: 'http://localhost:1234/v1',
    modelId: 'mistralai/ministral-3-14b-reasoning',
    disabledTools: ['search-tool'], // Disabled by default
    streamResponse: true,
};

async function prompt(question: string, defaultValue?: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        const query = defaultValue
            ? `${chalk.green('?')} ${question} ${chalk.dim(`(${defaultValue})`)} `
            : `${chalk.green('?')} ${question} `;

        rl.question(query, (answer) => {
            rl.close();
            resolve(answer.trim() || defaultValue || '');
        });
    });
}

export async function loadConfig(): Promise<AgentConfig> {
    try {
        const data = await fs.readFile(CONFIG_FILE, 'utf-8');
        const config = JSON.parse(data);

        // Migration: map old lmStudioUrl to baseUrl if missing
        if (!config.baseUrl && config.lmStudioUrl) {
            config.baseUrl = config.lmStudioUrl;
            config.provider = 'lm-studio';
            delete config.lmStudioUrl;
        }

        // Docker Networking Fix: automatically remap localhost -> host.docker.internal
        if (process.env.RUNNING_IN_DOCKER === 'true') {
            if (config.baseUrl.includes('localhost') || config.baseUrl.includes('127.0.0.1')) {
                console.log(chalk.yellow('🐳 Running in Docker: Remapping localhost to host.docker.internal'));
                config.baseUrl = config.baseUrl
                    .replace('localhost', 'host.docker.internal')
                    .replace('127.0.0.1', 'host.docker.internal');
            }
        }

        // Auto-fix: Ensure /v1 is present for LM Studio/Ollama if missing
        // This handles cases where users configured the port but forgot the path suffix
        if (config.baseUrl && (config.provider === 'lm-studio' || config.provider === 'ollama') && !config.baseUrl.endsWith('/v1')) {
            // Check if it ends in /v1/ (trailing slash) just in case
            if (!config.baseUrl.endsWith('/v1/')) {
                const fixed = config.baseUrl.endsWith('/') ? `${config.baseUrl}v1` : `${config.baseUrl}/v1`;
                console.log(chalk.yellow(`\n⚠️  Configuration Fix: Appended missing '/v1' to Base URL: ${fixed}`));
                config.baseUrl = fixed;
            }
        }

        // Ensure disabledTools exists
        if (!config.disabledTools) {
            config.disabledTools = ['search-tool'];
        }

        return config;
    } catch (error) {
        return DEFAULT_CONFIG;
    }
}


export async function saveConfig(config: AgentConfig): Promise<void> {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

async function checkServiceRunning(port: number): Promise<boolean> {
    const host = process.env.RUNNING_IN_DOCKER === 'true' ? 'host.docker.internal' : '127.0.0.1';
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(1000);
        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        socket.on('error', () => {
            socket.destroy();
            resolve(false);
        });
        socket.connect(port, host);
    });
}

async function checkLMStudioInstalled() {
    // In Docker, we can't check host installation easily
    if (process.env.RUNNING_IN_DOCKER === 'true') return false;

    const commonPaths = [
        '/Applications/LM Studio.app',
        `${process.env.HOME}/Applications/LM Studio.app`
    ];

    for (const p of commonPaths) {
        try {
            await fs.access(p);
            return true;
        } catch {
            // continue
        }
    }
    return false;
}

export async function runSetupWizard(): Promise<AgentConfig> {
    console.clear();
    console.log(chalk.bold.cyan('🧙 SafeLLM Setup Wizard'));
    console.log(chalk.dim('Let\'s configure your agent.\n'));

    const startSetup = await prompt('No configuration found (or strictly requested). Run setup? (Y/n)', 'Y');
    if (startSetup.toLowerCase() === 'n') {
        return DEFAULT_CONFIG;
    }

    console.log(chalk.green('\nChoose your AI Provider:'));
    console.log('1. LM Studio (Default port 1234)');
    console.log('2. Ollama    (Default port 11434)');
    console.log('3. Custom\n');

    const choice = await prompt('Select provider (1-3):', '1');
    let provider: ProviderType = 'lm-studio';
    let defaultBaseUrl = 'http://localhost:1234/v1';
    let defaultModelId = 'mistralai/ministral-3-14b-reasoning'; // default prompt
    let checkPort = 1234;

    if (choice === '2') {
        provider = 'ollama';
        defaultBaseUrl = 'http://localhost:11434/v1';
        defaultModelId = 'llama3';
        checkPort = 11434;
    } else if (choice === '3') {
        provider = 'custom';
        defaultBaseUrl = 'http://localhost:8000/v1';
        defaultModelId = 'my-model';
        checkPort = 0; // Skip check or ask?
    }

    console.log(chalk.dim(`\nChecking status for ${provider}...`));

    const isDocker = process.env.RUNNING_IN_DOCKER === 'true';

    if (provider === 'lm-studio') {
        const isRunning = await checkServiceRunning(1234);
        if (isRunning) {
            console.log(chalk.green(isDocker ? '✅ LM Studio reachable on host.' : '✅ LM Studio is running.'));
        } else {
            if (isDocker) {
                console.log(chalk.yellow('⚠️  Could not reach LM Studio on host machine (host.docker.internal:1234).'));
                console.log('Ensure LM Studio server is running on your host machine.');
            } else {
                const isInstalled = await checkLMStudioInstalled();
                if (isInstalled) {
                    console.log(chalk.yellow('⚠️  LM Studio is installed but not running.'));
                    console.log('Please start the LM Studio server.');
                } else {
                    console.log(chalk.red('❌ LM Studio not detected.'));
                }
            }
            await prompt('Press Enter to continue configuration...');
        }
    } else if (provider === 'ollama') {
        const isRunning = await checkServiceRunning(11434);
        if (isRunning) {
            console.log(chalk.green(isDocker ? '✅ Ollama reachable on host.' : '✅ Ollama is running.'));
        } else {
            console.log(chalk.yellow(isDocker ? '⚠️  Could not reach Ollama on host (host.docker.internal:11434).' : '⚠️  Ollama does not appear to be running on port 11434.'));
            console.log('Ensure `ollama serve` is running.');
            await prompt('Press Enter to continue configuration...');
        }
    }

    let baseUrl = await prompt('API Base URL:', defaultBaseUrl);

    // Auto-fix: Ensure /v1 is present for standard providers if missing
    // Many users forget this when typing manually
    if ((provider === 'lm-studio' || provider === 'ollama') && !baseUrl.endsWith('/v1')) {
        // Simple heuristic: if it doesn't end with /v1, append it.
        // Unless user explicitly wants without it? Safest is to ask or just do it with notification.
        // Given the user complaint, let's fix it automatically.
        const fixed = baseUrl.endsWith('/') ? `${baseUrl}v1` : `${baseUrl}/v1`;
        console.log(chalk.yellow(`\n⚠️  Appended '/v1' to Base URL for compatibility: ${fixed}`));
        baseUrl = fixed;
    }

    const modelId = await prompt('Model ID:', defaultModelId);

    // Check if we are keeping the same provider to suggest the old API key
    const sameProvider = choice === '1' && provider === 'lm-studio' ||  // Logic check: previous config might be passed in? 
        choice === '2' && provider === 'ollama';
    // Wait, 'provider' variable is set based on choice. We need to compare with *loaded* config (if any).
    // Let's rely on the fact that if they chose a specific provider, we guide them.

    const useAuth = await prompt('Enforce authentication? (y/N)', 'N');
    let apiKey: string | undefined;

    if (useAuth.toLowerCase() === 'y') {
        if (provider === 'lm-studio') {
            console.log(chalk.yellow('\nTo get your API Token:'));
            console.log('1. Open LM Studio Developer Page');
            console.log('2. Go to Server Settings');
            console.log('3. Enable "API Token Authentication"');
            console.log('4. Generate and copy the token\n');
        }

        // Only suggest previous API Key if provider matches? 
        // Simpler: Just ask. If they switched providers, they shouldn't use the old key.
        // But we don't have easy access to "old provider" here cleanly without passing it.
        // safe choice: Don't provide a default for API Key to avoid leaking it, or just blank it.
        apiKey = await prompt('Enter your API Token:');
    }

    // Internet Search Configuration
    const enableSearch = await prompt('Enable internet search (Tavily API)? (y/N)', 'N');
    let tavilyApiKey: string | undefined;
    let disabledTools: string[] = [];

    if (enableSearch.toLowerCase() === 'y') {
        tavilyApiKey = await prompt('Enter your Tavily API Key:');
    } else {
        disabledTools.push('search-tool');
    }

    // Docker Networking Fix: automatically remap localhost -> host.docker.internal
    if (process.env.RUNNING_IN_DOCKER === 'true') {
        if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
            console.log(chalk.yellow('🐳 Running in Docker: Remapping localhost to host.docker.internal'));
            baseUrl = baseUrl
                .replace('localhost', 'host.docker.internal')
                .replace('127.0.0.1', 'host.docker.internal');
        }
    }

    // Stream Response Configuration
    const streamResponseStr = await prompt('Stream AI response? (Y/n)', 'Y');
    const streamResponse = streamResponseStr.toLowerCase() !== 'n';

    // Email Configuration (Resend)
    const enableEmail = await prompt('Enable email sending (Resend API)? (y/N)', 'N');
    let resendApiKey: string | undefined;
    let resendFromEmail: string | undefined;

    if (enableEmail.toLowerCase() === 'y') {
        resendApiKey = await prompt('Enter your Resend API Key:');
        resendFromEmail = await prompt('Enter "From" email (e.g., onboarding@resend.dev):', 'onboarding@resend.dev');
    } else {
        disabledTools.push('resend-email');
    }

    const newConfig: AgentConfig = {
        provider,
        baseUrl,
        modelId,
        apiKey,
        tavilyApiKey,
        disabledTools,
        streamResponse,
        resendApiKey,
        resendFromEmail
    };

    await saveConfig(newConfig);
    console.log(chalk.green('\n✅ Configuration saved!\n'));

    return newConfig;
}

export async function ensureConfig(): Promise<AgentConfig> {
    try {
        await fs.access(CONFIG_FILE);
        return loadConfig();
    } catch {
        return runSetupWizard();
    }
}
