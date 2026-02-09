import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

const MEMORY_FILE = path.join(process.cwd(), 'MEMORY.md');

import { SessionManager } from './session-manager';
const sessionManager = new SessionManager();

export const weatherTool = createTool({
    id: 'get-weather',
    description: 'Get the current weather for a location',
    inputSchema: z.object({
        location: z.string().describe('The city or location to get the weather for'),
    }),
    execute: async (input) => {
        const location = input.location;
        return {
            location,
            temperature: '72°F',
            condition: 'Sunny',
            description: `It is currently sunny and 72°F in ${location}.`,
        };
    },
});

export const timeTool = createTool({
    id: 'get-time',
    description: 'Get the current time',
    inputSchema: z.object({}),
    execute: async () => {
        return {
            time: new Date().toLocaleTimeString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
    },
});

export const saveMemoryTool = createTool({
    id: 'save-memory',
    description: 'Save important information to long-term memory',
    inputSchema: z.object({
        memory: z.string().describe('The information to remember'),
    }),
    execute: async (input) => {
        const timestamp = new Date().toISOString();
        const entry = `\n- [${timestamp}] ${input.memory}`;

        try {
            await fs.appendFile(MEMORY_FILE, entry);
            return { success: true, message: 'Memory saved.' };
        } catch (error) {
            return { success: false, message: 'Failed to save memory.' };
        }
    },
});

export const readMemoryTool = createTool({
    id: 'read-memory',
    description: 'Read all saved long-term memories',
    inputSchema: z.object({}),
    execute: async () => {
        try {
            const data = await fs.readFile(MEMORY_FILE, 'utf-8');
            return { memories: data };
        } catch (error) {
            return { memories: 'No memories found.' };
        }
    },
});

export const deleteMemoryTool = createTool({
    id: 'delete-memory',
    description: 'Delete a specific memory from long-term storage',
    inputSchema: z.object({
        memory: z.string().describe('The content of the memory to delete (exact or partial match)'),
    }),
    execute: async (input) => {
        try {
            const data = await fs.readFile(MEMORY_FILE, 'utf-8');
            const lines = data.split('\n');
            const memoryToDelete = input.memory.trim();

            const newLines = lines.filter(line => !line.includes(memoryToDelete));

            if (newLines.length === lines.length) {
                return { success: false, message: 'Memory not found.' };
            }

            await fs.writeFile(MEMORY_FILE, newLines.join('\n'));
            return { success: true, message: 'Memory deleted.' };
        } catch (error) {
            return { success: false, message: 'Failed to delete memory.' };
        }
    },
});

export const replaceMemoryTool = createTool({
    id: 'replace-memory',
    description: 'Replace an existing memory with new content',
    inputSchema: z.object({
        originalContent: z.string().describe('The content of the existing memory to find (exact or partial match)'),
        newContent: z.string().describe('The new content to replace it with'),
    }),
    execute: async (input) => {
        try {
            const data = await fs.readFile(MEMORY_FILE, 'utf-8');
            const lines = data.split('\n');
            const memoryToFind = input.originalContent.trim();
            const timestamp = new Date().toISOString();

            let found = false;
            const newLines = lines.map(line => {
                if (line.includes(memoryToFind)) {
                    found = true;
                    // Preserve existing format if possible, or just overwrite
                    // We'll standard format: - [Timestamp] Content
                    return `- [${timestamp}] ${input.newContent}`;
                }
                return line;
            });

            if (!found) {
                return { success: false, message: 'Original memory not found.' };
            }

            await fs.writeFile(MEMORY_FILE, newLines.join('\n'));
            return { success: true, message: 'Memory replaced.' };
        } catch (error) {
            return { success: false, message: 'Failed to replace memory.' };
        }
    },
});

export const listSessionsTool = createTool({
    id: 'list-sessions',
    description: 'List all available past conversation sessions',
    inputSchema: z.object({}),
    execute: async () => {
        const sessions = await sessionManager.listSessions();
        return {
            sessions: sessions.map(s => ({
                id: s.id,
                created: s.createdAt,
                messageCount: s.messages.length
            }))
        };
    },
});

export const readSessionTool = createTool({
    id: 'read-session',
    description: 'Read the content of a past conversation session',
    inputSchema: z.object({
        sessionId: z.string().describe('The ID of the session to read'),
    }),
    execute: async (input) => {
        const session = await sessionManager.loadSession(input.sessionId);
        if (!session) return { error: 'Session not found' };
        return { session };
    },
});

export const renameSessionTool = createTool({
    id: 'rename-session',
    description: 'Rename a conversation session',
    inputSchema: z.object({
        sessionId: z.string().describe('The ID of the session to rename'),
        newName: z.string().describe('The new name for the session'),
    }),
    execute: async (input) => {
        const success = await sessionManager.renameSession(input.sessionId, input.newName);
        if (success) return { success: true, message: `Session renamed to ${input.newName}` };
        return { success: false, message: 'Failed to rename session' };
    },
});
export const calculatorTool = createTool({
    id: 'calculator',
    description: 'Perform a basic arithmetic operation on two numbers',
    inputSchema: z.object({
        a: z.number().describe('The first number'),
        b: z.number().describe('The second number'),
        operation: z.enum(['+', '-', '*', '/', '^']).describe('The operator to apply'),
    }),
    execute: async (input) => {
        const { a, b, operation } = input;
        switch (operation) {
            case '+': return { result: a + b };
            case '-': return { result: a - b };
            case '*': return { result: a * b };
            case '/':
                if (b === 0) return { error: 'Division by zero' };
                return { result: a / b };
            case '^': return { result: Math.pow(a, b) };
            default:
                return { error: 'Invalid operation' };
        }
    },

});

export const safeCurlTool = createTool({
    id: 'safe-curl',
    description: 'Safely fetch the content of a public URL (HTTP/HTTPS only)',
    inputSchema: z.object({
        url: z.string().describe('The URL to fetch'),
    }),
    execute: async (input) => {
        let urlStr = input.url;
        try {
            // 1. Basic Protocol Check
            const parsedUrl = new URL(urlStr);
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                return { error: 'Invalid protocol. Only HTTP and HTTPS are allowed.' };
            }

            let hostname = parsedUrl.hostname;

            // 2. Docker / Localhost Handling
            const isDocker = process.env.RUNNING_IN_DOCKER === 'true';
            if (isDocker && (hostname === 'localhost' || hostname === '127.0.0.1')) {
                // Rewrite to host.docker.internal
                hostname = 'host.docker.internal';
                urlStr = urlStr.replace(/^https?:\/\/[^/]+/, `${parsedUrl.protocol}//${hostname}:${parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80)}`);
            } else {
                // 3. SSRF Protection (Block private ranges unless explicitly handled above)
                // We need to resolve the hostname to an IP to check against ranges.
                // However, for simplicity and standard environment limitations (no 'dns' module in all edge runtimes, though we are in Node),
                // we will do a basic check on the hostname string first, and if it's an IP, check ranges.
                // Doing full DNS resolution manually here to block private IPs is best practice.

                // const fetch = (await import('node-fetch')).default; // Use native fetch
                const dns = await import('dns/promises');

                try {
                    const { address } = await dns.lookup(hostname);

                    // Private IP Ranges Check
                    // 127.0.0.0/8
                    if (address.startsWith('127.')) return { error: 'Access to loopback interface is restricted.' };
                    // 10.0.0.0/8
                    if (address.startsWith('10.')) return { error: 'Access to private network (10.x.x.x) is restricted.' };
                    // 192.168.0.0/16
                    if (address.startsWith('192.168.')) return { error: 'Access to private network (192.168.x.x) is restricted.' };
                    // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
                    const parts = address.split('.').map(Number);
                    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
                        return { error: 'Access to private network (172.16.x.x) is restricted.' };
                    }
                    // IPv6 Loopback
                    if (address === '::1') return { error: 'Access to loopback interface is restricted.' };
                    // IPv6 Private (fc00::/7) - Basic check
                    if (address.toLowerCase().startsWith('fc') || address.toLowerCase().startsWith('fd')) {
                        return { error: 'Access to private IPv6 network is restricted.' };
                    }

                } catch (e) {
                    // If we can't resolve it, it might be an internal name or just failure.
                    // Fail safe.
                    return { error: `Failed to resolve hostname: ${hostname}` };
                }
            }

            // 4. Execute Fetch
            const response = await fetch(urlStr);
            const text = await response.text();

            // 5. Return Result
            return {
                status: response.status,
                contentType: response.headers.get('content-type'),
                length: text.length,
                body: text.substring(0, 5000) + (text.length > 5000 ? '\n...[truncated]' : ''),
            };

        } catch (error) {
            return { error: `Failed to fetch URL: ${error instanceof Error ? error.message : String(error)}` };
        }
    },
});

export const createSearchTool = (apiKey: string) => createTool({
    id: 'search-tool',
    description: 'Search the internet for up-to-date information usage Tavily API',
    inputSchema: z.object({
        query: z.string().describe('The search query'),
        maxResults: z.number().optional().describe('Maximum number of results to return (default: 5)'),
    }),
    execute: async (input) => {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const response = await fetch('https://api.tavily.com/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    api_key: apiKey,
                    query: input.query,
                    max_results: input.maxResults || 5,
                    include_answer: true,
                }),
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (!response.ok) {
                const text = await response.text();
                return { error: `Search failed: ${response.status} ${response.statusText}`, details: text };
            }

            const data = await response.json();
            return {
                answer: data.answer,
                results: data.results.map((r: any) => ({
                    title: r.title,
                    url: r.url,
                    content: r.content,
                })),
            };

        } catch (error) {
            return { error: `Search failed: ${error instanceof Error ? error.message : String(error)}` };
        }
    },
});

export const createResendTool = (apiKey: string, fromEmail: string) => createTool({
    id: 'resend-email',
    description: 'Send an email using the Resend API',
    inputSchema: z.object({
        to: z.string().email().describe('Recipient email address'),
        subject: z.string().describe('Email subject'),
        html: z.string().describe('Email body content (HTML supported)'),
    }),
    execute: async (input) => {
        try {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    from: fromEmail,
                    to: input.to,
                    subject: input.subject,
                    html: input.html,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                return { error: `Failed to send email: ${response.statusText}`, details: errorText };
            }

            const data = await response.json();
            return { success: true, id: data.id };
        } catch (error) {
            return { error: `Email sending failed: ${error instanceof Error ? error.message : String(error)}` };
        }
    },
});


// Export a map of all static tools for easy access
import { Scheduler } from './scheduler';

// ... (existing imports/interfaces)

export const createSchedulerTools = (scheduler: Scheduler) => {
    return {
        scheduleTask: createTool({
            id: 'schedule_task',
            description: 'Schedule a recurring task. You MUST generate a valid cron expression.',
            inputSchema: z.object({
                cronExpression: z.string().describe('Valid cron expression (e.g. "0 8 * * *")'),
                prompt: z.string().describe('The prompt to send to the AI agent'),
                action: z.enum(['log', 'email']).describe('Action to take with the result'),
                emailRecipient: z.string().email().optional().describe('Specific email recipient (optional)'),
            }),
            execute: async (input) => {
                try {
                    const task = await scheduler.addTask(
                        input.cronExpression,
                        input.prompt,
                        input.action,
                        input.emailRecipient
                    );
                    return { success: true, message: `Task scheduled with ID: ${task.id}`, taskId: task.id };
                } catch (error) {
                    return { error: `Failed to schedule task: ${String(error)}` };
                }
            },
        }),

        listTasks: createTool({
            id: 'list_scheduled_tasks',
            description: 'List all currently scheduled tasks.',
            inputSchema: z.object({}),
            execute: async () => {
                const tasks = scheduler.getTasks();
                return {
                    count: tasks.length,
                    tasks: tasks.map(t => ({
                        id: t.id,
                        cron: t.cronExpression,
                        prompt: t.prompt,
                        action: t.action,
                        recipient: t.emailRecipient || '(default)'
                    }))
                };
            },
        }),

        deleteTask: createTool({
            id: 'delete_scheduled_task',
            description: 'Delete a scheduled task by ID.',
            inputSchema: z.object({
                taskId: z.string().describe('The ID of the task to delete'),
            }),
            execute: async (input) => {
                const deleted = await scheduler.removeTask(input.taskId);
                if (deleted) {
                    return { success: true, message: `Task ${input.taskId} deleted.` };
                } else {
                    return { error: `Task ${input.taskId} not found.` };
                }
            },
        }),
    };
};

export const STATIC_TOOLS = {
    weatherTool,
    timeTool,
    saveMemoryTool,
    readMemoryTool,
    deleteMemoryTool,
    replaceMemoryTool,
    listSessionsTool,
    readSessionTool,
    renameSessionTool,
    calculatorTool,
    safeCurlTool,
};

// Map of tool IDs to their display names/descriptions for the CLI
export const TOOL_METADATA: Record<string, string> = {
    'get-weather': 'Weather Info',
    'get-time': 'Current Time',
    'save-memory': 'Save to Long-term Memory',
    'read-memory': 'Read Long-term Memory',
    'delete-memory': 'Delete Memory',
    'replace-memory': 'Update Memory',
    'list-sessions': 'List Conversations',
    'read-session': 'Load Conversation',
    'rename-session': 'Rename Conversation',
    'calculator': 'Calculator',
    'safe-curl': 'Secure Web Fetch',
    'search-tool': 'Internet Search (Tavily)',
    'resend-email': 'Send Email (Resend)',
    'schedule_task': 'Schedule Task (Cron)',
    'list_scheduled_tasks': 'List Scheduled Tasks',
    'delete_scheduled_task': 'Delete Scheduled Task',
};
