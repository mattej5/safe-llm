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
