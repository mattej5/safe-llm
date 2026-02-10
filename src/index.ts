#!/usr/bin/env -S npx tsx
import 'dotenv/config';
import { Mastra, Agent } from '@mastra/core';
import { createOpenAI } from '@ai-sdk/openai';
import * as readline from 'readline';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';
import {
    STATIC_TOOLS,
    createSearchTool,
    createResendTool,
    TOOL_METADATA,
    createSchedulerTools
} from './tools';
import { createAgent } from './agent-factory';
import { Scheduler } from './scheduler';

import { SessionManager } from './session-manager';

// Configure marked to use terminal renderer
const terminalRenderer = new TerminalRenderer({
    blockquote: chalk.gray.italic,
    firstHeading: chalk.bold.underline.blue,
    heading: chalk.bold.blue,
    code: chalk.yellow,
    strong: chalk.bold.cyan,
    hr: chalk.dim,
    reflowText: true,
    width: process.stdout.columns ? process.stdout.columns - 5 : 80,
    tab: 2,
    list: (body: string, ordered?: boolean) => {
        // Custom list formatting if needed, or just let marked-terminal handle it with smaller tabs
        return body;
    }
});

// Workaround for marked v15 strict validation
// We must only pass standard renderer methods to marked.use
// AND we must wrap them to synchronize the parser state that marked injects
const renderer: any = {};
const markedRendererMethods = [
    'code', 'blockquote', 'html', 'heading', 'hr', 'list', 'listitem',
    'checkbox', 'paragraph', 'table', 'tablerow', 'tablecell',
    'strong', 'em', 'codespan', 'br', 'del', 'link', 'image', 'text'
];

markedRendererMethods.forEach(method => {
    // @ts-expect-error - dynamic access
    if (typeof terminalRenderer[method] === 'function') {
        renderer[method] = function (...args: any[]) {
            // Synchronize parser which marked v15 injects into 'this'
            if (this.parser) {
                // @ts-expect-error - dynamic assignment
                terminalRenderer.parser = this.parser;
            }

            // Synchronize options which marked v15 injects into 'this'
            // Safely merge options ensuring gfm and others are present
            terminalRenderer.options = { ...terminalRenderer.options, ...(this.options || {}) };

            // Custom Check for Thinking Process
            if (method === 'blockquote') {
                const text = args[0];
                if (typeof text === 'string' && text.includes('Thinking Process:')) {
                    // Apply different styling for Thinking Process
                    // Strip existing styles (like gray/italic/blue) and apply plain dim
                    return chalk.dim(stripAnsi(terminalRenderer.blockquote(text)));
                }
            }

            // @ts-expect-error - dynamic call
            return terminalRenderer[method].apply(terminalRenderer, args);
        };
    }
});

marked.use({
    renderer,
    gfm: true,
    breaks: false,
});



import { ensureConfig, saveConfig, type AgentConfig } from './config-wizard';

// ... imports ...
import { runSetupWizard } from './config-wizard';

async function main() {
    let config = await ensureConfig();
    const sessionManager = new SessionManager();
    await sessionManager.createSession();

    // Main Application Loop
    while (true) {
        console.clear();
        const banner = `
  /$$$$$$             /$$$$$$          /$$       /$$       /$$      /$$
 /$$__  $$           /$$__  $$        | $$      | $$      | $$$    /$$$
| $$  \\__/  /$$$$$$ | $$  \\__//$$$$$$ | $$      | $$      | $$$$  /$$$$
|  $$$$$$  |____  $$| $$$$   /$$__  $$| $$      | $$      | $$ $$/$$ $$
 \\____  $$  /$$$$$$$| $$_/  | $$$$$$$$| $$      | $$      | $$  $$$| $$
 /$$  \\ $$ /$$__  $$| $$    | $$_____/| $$      | $$      | $$\\  $ | $$
|  $$$$$$/|  $$$$$$$| $$    |  $$$$$$$| $$$$$$$$| $$$$$$$$| $$ \\/  | $$
 \\______/  \\_______/|__/     \\_______/|________/|________/|__/     |__/
`;
        console.log(chalk.bold.cyan(banner));
        console.log(chalk.bold.green('SafeLLM CLI Initializing...'));
        console.log(`Provider: ${config.provider}`);
        console.log(`Endpoint: ${config.baseUrl}`);
        // console.log(`Model:    ${config.modelId}`);

        // Create Agent and Scheduler using the factory
        // If we want to persist the scheduler across loops (for tasks) we might need to handle it differently?
        // But the original code created a new scheduler every loop: "const scheduler = new Scheduler(config);"
        // So this is consistent.
        // Wait, if loop restarts (e.g. config change), scheduler should probably restart too.

        const { agent, scheduler, activeTools } = await createAgent(config);

        // Start scheduler
        await scheduler.startAll();

        // const activeTools = agent.tools; // Get tools from agent to show count

        // ... (connection check) ...

        // Connection Check
        const connected = await checkConnectionAndPrompt(config);
        if (!connected) {
            console.log('Goodbye!');
            process.exit(0);
        }

        console.log(chalk.bold.cyan('\n🤖 Agent Ready! Type "exit", "quit", or "/config" to configure a new connection.'));

        // Run Chat Session
        const action = await runChatSession(agent, sessionManager, config);

        if (action === 'quit') {
            console.log('Goodbye!');
            process.exit(0);
        } else if (action === 'configure') {
            config = await runSetupWizard();
            // Loop continues with new config
        } else if (action === 'reload') {
            // Loop continues, reloading agent with current config
            continue;
        }
    }
}

async function checkConnectionAndPrompt(config: any): Promise<boolean> {
    while (true) {
        try {
            const response = await fetch(`${config.baseUrl}/models`, {
                headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}
            });

            if (response.ok) {
                console.log(`✅ Connected to ${config.provider}`);
                return true;
            }
            throw new Error(`Status ${response.status}`);
        } catch (error) {
            console.error(chalk.red(`❌ Connection failed to ${config.baseUrl}: ${error instanceof Error ? error.message : String(error)}`));

            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            const answer = await new Promise<string>(resolve => {
                rl.question(chalk.yellow('\n[R]etry, [C]hange Config, or [Q]uit? '), ans => {
                    rl.close();
                    resolve(ans.trim().toLowerCase());
                });
            });

            if (answer === 'q') return false;
            if (answer === 'c') {
                try {
                    // Re-run wizard to update config
                    const newConfig = await runSetupWizard();
                    Object.assign(config, newConfig); // Update the passed config object in place

                    // Also need to save it? runSetupWizard saves it.

                    continue; // Retry connection with new config
                } catch (e) {
                    console.error(e);
                }
            }
        }
    }
}

// Shared commands list for autocomplete and ghost text
const COMMANDS = ['/help', '/config', '/clear', '/history', '/load ', '/rename ', '/tools', '/exit', '/quit'];

// Spinner implementation
class Spinner {
    private timer: NodeJS.Timeout | null = null;
    private frames = ['Thinking   ', 'Thinking.  ', 'Thinking.. ', 'Thinking...'];
    private currentFrame = 0;

    start() {
        if (this.timer) return;
        process.stdout.write('\u001b[?25l'); // Hide cursor
        this.timer = setInterval(() => {
            process.stdout.write(`\r${chalk.dim(this.frames[this.currentFrame])}`);
            this.currentFrame = (this.currentFrame + 1) % this.frames.length;
        }, 500);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
            process.stdout.write('\r\x1b[K'); // Clear line
            process.stdout.write('\u001b[?25h'); // Show cursor
        }
    }
}

function runChatSession(agent: Agent, sessionManager: SessionManager, config: AgentConfig): Promise<'quit' | 'configure' | 'reload'> {
    return new Promise((resolve) => {
        const completer = (line: string) => {
            const hits = COMMANDS.filter((c) => c.startsWith(line));
            return [hits.length ? hits : COMMANDS, line];
        };

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.bold.green('\n> '),
            completer,
        });

        // Ghost Text Logic
        let suggestion = '';
        let rootSuggestionTimer: NodeJS.Timeout | null = null;
        let showRootSuggestion = false;

        // @ts-ignore - hacking private method for valid UI enhancement
        const originalRefresh = rl._refreshLine;
        // @ts-ignore
        rl._refreshLine = function (n: any) {
            // @ts-ignore
            originalRefresh.call(this, n);

            const line = this.line;
            suggestion = '';

            // Clear any pending root suggestion timer on every refresh (keypress)
            if (rootSuggestionTimer) {
                clearTimeout(rootSuggestionTimer);
                rootSuggestionTimer = null;
            }

            // Only suggest if at end of line and typing a command
            if (line.length > 0 && line.startsWith('/') && this.cursor === line.length) {
                // If just '/', wait for pause
                if (line.length === 1) {
                    if (showRootSuggestion) {
                        const match = COMMANDS[0]; // First suggestion
                        suggestion = match.substring(line.length);
                    } else {
                        // Start timer to show suggestion after pause
                        rootSuggestionTimer = setTimeout(() => {
                            showRootSuggestion = true;
                            // @ts-ignore
                            rl._refreshLine(n);
                        }, 500);
                        // Don't show anything yet, just return
                        return;
                    }
                } else {
                    // Deeper typing (e.g. /c), show immediate
                    const match = COMMANDS.find(c => c.startsWith(line) && c !== line);
                    if (match) {
                        suggestion = match.substring(line.length);
                    }
                }

                if (suggestion) {
                    // Write ghost text
                    process.stdout.write(chalk.dim(suggestion));
                    // Move cursor back to where the user is typing
                    process.stdout.write(`\x1B[${suggestion.length}D`);
                }
            } else {
                showRootSuggestion = false;
            }
        };

        // Keypress listener for accepting suggestion
        const keypressHandler = (_str: string, key: any) => {
            if (key && key.name === 'right' && suggestion) {
                if (rl.cursor === rl.line.length) {
                    rl.write(suggestion);
                    suggestion = '';
                }
            }
        };

        // Attach to the input stream which rl is using
        // Node's readline emits 'keypress' on the input stream.
        process.stdin.on('keypress', keypressHandler);

        const cleanup = () => {
            process.stdin.removeListener('keypress', keypressHandler);
        };

        const messages: any[] = []; // Session local messages. 
        // NOTE: In a real app we might want to preserve context across reloads? 
        // For now, let's keep it simple: fresh context on reload, or we could pass it in?
        // The user just wants to reconfig. Usually that implies restart. 
        // Let's assume fresh context for simplicity, or we could pass messages in.

        rl.prompt();

        rl.on('line', async (line) => {
            const input = line.trim();

            if (input === 'exit' || input === 'quit' || input === '/exit' || input === '/quit') {
                cleanup();
                rl.close();
                resolve('quit');
                return;
            }

            if (input === '/config') {
                cleanup();
                rl.close();
                resolve('configure');
                return;
            }

            // Tools Management Command
            if (input.startsWith('/tools')) {
                const parts = input.split(' ');
                const subcmd = parts[1];
                const arg = parts[2];

                if (!subcmd || subcmd === 'list') {
                    console.log(chalk.bold.yellow('\nTool Management:'));

                    // List all possible tools (Static + potential Dynamic)
                    const potentialTools: Record<string, any> = { ...STATIC_TOOLS };
                    if (config.tavilyApiKey) {
                        // Just a dummy to show it exists in potential list
                        potentialTools['search-tool'] = { id: 'search-tool' } as any;
                    } else {
                        // If no key, show it as unavailable? Or just don't show?
                        // Let's show it but mark as missing key
                        // Actually, better to just iterate TOOL_METADATA to show what's *possible*
                    }

                    const disabledList = config.disabledTools || [];

                    Object.entries(TOOL_METADATA).forEach(([id, name]) => {
                        let status = chalk.green('Enabled');

                        if (disabledList.includes(id)) {
                            status = chalk.red('Disabled');
                        } else if (id === 'search-tool' && !config.tavilyApiKey) {
                            status = chalk.dim('Missing Config (API Key)');
                        }

                        console.log(`${chalk.cyan(name.padEnd(30))} [${id.padEnd(20)}] ${status}`);
                    });
                    console.log(chalk.dim('\nUsage: /tools enable <id>, /tools disable <id>'));
                } else if (subcmd === 'enable') {
                    if (!arg) {
                        console.log(chalk.red('Usage: /tools enable <id>'));
                    } else {
                        if (!config.disabledTools?.includes(arg)) {
                            console.log(chalk.yellow(`Tool '${arg}' is already enabled (or unknown).`));
                        } else {
                            config.disabledTools = config.disabledTools.filter(t => t !== arg);
                            await saveConfig(config);
                            console.log(chalk.green(`Enabled '${arg}'. Reloading agent...`));
                            cleanup();
                            rl.close();
                            resolve('reload');
                            return;
                        }
                    }
                } else if (subcmd === 'disable') {
                    if (!arg) {
                        console.log(chalk.red('Usage: /tools disable <id>'));
                    } else {
                        if (!config.disabledTools) config.disabledTools = [];
                        if (config.disabledTools.includes(arg)) {
                            console.log(chalk.yellow(`Tool '${arg}' is already disabled.`));
                        } else {
                            if (!TOOL_METADATA[arg]) {
                                console.log(chalk.red(`Unknown tool ID: ${arg}`));
                            } else {
                                config.disabledTools.push(arg);
                                await saveConfig(config);
                                console.log(chalk.red(`Disabled '${arg}'. Reloading agent...`));
                                cleanup();
                                rl.close();
                                resolve('reload');
                                return;
                            }
                        }
                    }
                } else {
                    console.log(chalk.red('Unknown subcommand. Use list, enable, or disable.'));
                }

                rl.prompt();
                return;
            }

            if (input === '/help') {
                console.log(chalk.bold.yellow('\nAvailable Commands:'));
                console.log(chalk.yellow('  /help   - Show this help message'));
                console.log(chalk.yellow('  /config - Run setup wizard again'));
                console.log(chalk.yellow('  /tools  - Manage agent tools'));
                console.log(chalk.yellow('  /clear  - Clear conversation context'));
                console.log(chalk.yellow('  /history - List past conversation sessions'));
                console.log(chalk.yellow('  /load <id> - Load a past session'));
                console.log(chalk.yellow('  /rename <name> - Rename current session'));
                console.log(chalk.yellow('  /exit   - Exit the agent'));
                rl.prompt();
                return;
            }

            if (input === '/clear') {
                messages.length = 0;
                console.clear();
                console.log(chalk.green('\n🧹 Context cleared!\n'));
                await sessionManager.createSession();
                rl.prompt();
                return;
            }

            if (input === '/history') {
                const sessions = await sessionManager.listSessions();
                console.log(chalk.bold.yellow('\nPast Sessions:'));
                sessions.slice(0, 10).forEach(s => {
                    console.log(chalk.yellow(`  • ${s.id} (${new Date(s.createdAt).toLocaleString()} - ${s.messages.length} msgs)`));
                });
                console.log('');
                rl.prompt();
                return;
            }

            if (input.startsWith('/load ')) {
                const sessionId = input.substring(6).trim();
                const session = await sessionManager.loadSession(sessionId);
                if (session) {
                    messages.length = 0;
                    messages.push(...session.messages);
                    console.log(chalk.green(`\n📂 Loaded session: ${session.id}\n`));
                    const lastMsgs = messages.slice(-2);
                    if (lastMsgs.length > 0) {
                        console.log(chalk.dim('Last messages:'));
                        lastMsgs.forEach(m => console.log(chalk.dim(`  ${m.role}: ${m.content.substring(0, 50)}...`)));
                    }
                } else {
                    console.log(chalk.red(`\n❌ Session not found: ${sessionId}\n`));
                }
                rl.prompt();
                return;
            }

            if (input.startsWith('/rename ')) {
                const newName = input.substring(8).trim();
                if (!newName) {
                    console.log(chalk.red('Please provide a new name. Usage: /rename <new-name>'));
                } else {
                    const currentId = sessionManager.currentId;
                    if (currentId) {
                        const success = await sessionManager.renameSession(currentId, newName);
                        if (success) {
                            console.log(chalk.green(`\n✅ Session renamed to: ${newName}\n`));
                        } else {
                            console.log(chalk.red('\n❌ Failed to rename session.\n'));
                        }
                    } else {
                        console.log(chalk.red('\n❌ No active session to rename.\n'));
                    }
                }
                rl.prompt();
                return;
            }

            if (!input) {
                rl.prompt();
                return;
            }

            try {
                messages.push({ role: 'user', content: input });
                await sessionManager.logInteraction(messages);

                let responseText = '';

                if (config.streamResponse) {
                    console.log(chalk.dim('Thinking... (Streaming)\n'));

                    const result = await agent.stream(messages);

                    // console.log('') // Start new line for stream

                    for await (const chunk of result.textStream) {
                        process.stdout.write(chunk);
                        responseText += chunk;
                    }
                    console.log('\n'); // Ensure newline after stream

                } else {
                    const spinner = new Spinner();
                    spinner.start();

                    const result = await agent.generate(messages);
                    spinner.stop();

                    responseText = result.text;
                    // @ts-ignore
                    if (!responseText && result.reasoningText) {
                        // @ts-ignore
                        responseText = result.reasoningText;
                    }
                }

                if (!responseText) {
                    console.error('⚠️ Empty response generated.');
                }

                // ... Rendering Logic (Clear and Render Markdown) ...
                // Note: If streaming, we might want to clear the screen or just print the markdown AFTER?
                // User requirement: "Otherwise, we can replace the "Thinking..." text... with a basic text animation"
                // Plan said: "Once the stream is complete, functionality will clear the raw output and replace it with the beautified Markdown"

                // Clear the raw output if streaming? 
                // That might be jarring if the user was reading along.
                // But the plan "The CLI will first stream raw text... clear the raw output and replace it with the beautified Markdown" was approved.
                // So I will implement exactly that.

                if (config.streamResponse) {
                    // Clear the raw stream output to replace with formatted version
                    console.clear();
                    // Reprint the User's input so context is maintained for this turn
                    console.log(chalk.bold.green('\n> ') + input + '\n');
                }

                let formattedResponse = responseText.replace(/^\s*<think>([\s\S]*?)<\/think>/, (match: string, content: string) => {
                    const lines = content.split('\n');
                    let minIndent = Infinity;
                    for (const line of lines) {
                        if (line.trim()) {
                            const indent = line.match(/^\s*/)?.[0].length || 0;
                            minIndent = Math.min(minIndent, indent);
                        }
                    }
                    if (minIndent === Infinity) minIndent = 0;
                    const processedLines = lines.map((line: string) => line.slice(minIndent).trimRight());
                    let excerpt = processedLines.join('\n> ');
                    return `\n> **Thinking Process:**\n> ${excerpt}\n\n---\n\n**Response:**\n\n`;
                });

                const rendered = marked.parse(formattedResponse);

                if (config.streamResponse) {
                    // This line is now redundant as console.clear() was called.
                    // console.log(chalk.dim('─'.repeat(process.stdout.columns || 80)));
                    // console.log(chalk.bold.green('Formatted Output:'));
                }

                console.log(chalk.dim('─'.repeat(process.stdout.columns || 80)));
                console.log(rendered);
                console.log(chalk.dim('─'.repeat(process.stdout.columns || 80)));

                const historyContent = responseText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
                messages.push({ role: 'assistant', content: historyContent || responseText });
                await sessionManager.logInteraction(messages);

            } catch (error) {
                console.error('Error generating response:', error);
            }

            rl.prompt();
        });
    });
}


main();
