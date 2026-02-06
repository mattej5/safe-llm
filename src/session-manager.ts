
import * as fs from 'fs/promises';
import * as path from 'path';

const SESSION_DIR = path.join(process.cwd(), '.safellm');

export interface Session {
    id: string;
    filename: string;
    createdAt: string;
    messages: any[];
}

export class SessionManager {
    private currentSessionId: string | null = null;

    public get currentId(): string | null {
        return this.currentSessionId;
    }


    constructor() {
        this.ensureSessionDir();
    }

    private async ensureSessionDir() {
        try {
            await fs.access(SESSION_DIR);
        } catch {
            await fs.mkdir(SESSION_DIR, { recursive: true });
        }
    }

    async createSession(): Promise<string> {
        await this.ensureSessionDir();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const id = `session-${timestamp}`;
        const filename = `${id}.json`;

        const session: Session = {
            id,
            filename,
            createdAt: new Date().toISOString(),
            messages: []
        };

        await fs.writeFile(path.join(SESSION_DIR, filename), JSON.stringify(session, null, 2));
        this.currentSessionId = id;
        return id;
    }

    async logInteraction(messages: any[]): Promise<void> {
        if (!this.currentSessionId) return;

        const filepath = path.join(SESSION_DIR, `${this.currentSessionId}.json`);
        try {
            const data = await fs.readFile(filepath, 'utf-8');
            const session: Session = JSON.parse(data);
            session.messages = messages;
            await fs.writeFile(filepath, JSON.stringify(session, null, 2));
        } catch (error) {
            console.error('Failed to log interaction:', error);
        }
    }

    async listSessions(): Promise<Session[]> {
        await this.ensureSessionDir();
        const files = await fs.readdir(SESSION_DIR);
        const sessions: Session[] = [];

        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const data = await fs.readFile(path.join(SESSION_DIR, file), 'utf-8');
                    sessions.push(JSON.parse(data));
                } catch {
                    // Ignore corrupted files
                }
            }
        }

        return sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    async loadSession(filenameOrId: string): Promise<Session | null> {
        let filename = filenameOrId;
        if (!filename.endsWith('.json')) {
            filename = `${filename}.json`;
        }

        // Handle cases where user passes just the ID but the file might be renamed
        // Actually, renaming via renameSession updates the filename property but what about the actual file?
        // Let's assume renameSession renames the actual file too.

        // If exact filename doesn't exist, search by ID
        try {
            const filepath = path.join(SESSION_DIR, filename);
            const data = await fs.readFile(filepath, 'utf-8');
            const session = JSON.parse(data);
            this.currentSessionId = session.id; // Switch active session
            return session;
        } catch {
            // Try finding by ID if filename failed
            const sessions = await this.listSessions();
            const session = sessions.find(s => s.id === filenameOrId || s.filename === filenameOrId || s.filename === filename);
            if (session) {
                this.currentSessionId = session.id;
                return session;
            }
        }
        return null;
    }

    async renameSession(oldIdOrFilename: string, newName: string): Promise<boolean> {
        const session = await this.loadSession(oldIdOrFilename);
        if (!session) return false;

        const oldPath = path.join(SESSION_DIR, session.filename);

        // Sanitize new name
        const sanitized = newName.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-');
        const newFilename = `${sanitized}.json`;
        const newPath = path.join(SESSION_DIR, newFilename);

        try {
            session.filename = newFilename;
            // We keep the internal ID same, just change filename

            // First write the updated content to the old file to ensure consistency
            await fs.writeFile(oldPath, JSON.stringify(session, null, 2));

            // Then rename the file
            await fs.rename(oldPath, newPath);

            // Update current session ID if we just renamed the active one
            // (ID stays same, but next logInteraction relies on ID to find file... wait)
            // logInteraction uses currentSessionId to construct filename?
            // checking logInteraction: `path.join(SESSION_DIR, \`${this.currentSessionId}.json\`)`
            // usage of ID as filename in logInteraction is a bug if we rename files!

            // FIX: We need to update logInteraction to find file by ID or update the tracked filename.
            // Simpler: Update internal ID to match new filename if we rely on that, OR separate ID from Filename lookup.
            // Let's change the ID to match the new filename for simplicity, so logInteraction works content-agnostically.

            const newId = sanitized;
            session.id = newId;
            await fs.writeFile(newPath, JSON.stringify(session, null, 2)); // Save with new ID

            if (this.currentSessionId === oldIdOrFilename || this.currentSessionId === session.id) {
                this.currentSessionId = newId;
            }

            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    // Fix logInteraction to use listSessions or map if we allowed ID != Filename.
    // Given the logic above, I updated renameSession to update the ID as well.
    // So ID always equals Filename (minus .json).
}
