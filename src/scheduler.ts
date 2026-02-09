import cron from 'node-cron';
import { Agent } from '@mastra/core';
import { AgentConfig, ScheduledTask, saveConfig } from './config-wizard';
import chalk from 'chalk';

export class Scheduler {
    public agent?: Agent;
    private config: AgentConfig;
    private tasks: Map<string, cron.ScheduledTask> = new Map();

    constructor(config: AgentConfig) {
        this.config = config;
    }

    setAgent(agent: Agent) {
        this.agent = agent;
    }

    async startAll() {
        if (!this.config.scheduledTasks) return;

        console.log(chalk.blue(`\n📅 Initializing ${this.config.scheduledTasks.length} scheduled tasks...`));
        
        for (const task of this.config.scheduledTasks) {
            this.scheduleJob(task);
        }
    }

    private scheduleJob(taskResult: ScheduledTask) {
        // Validate cron
        if (!cron.validate(taskResult.cronExpression)) {
            console.error(chalk.red(`❌ Invalid cron expression for task ${taskResult.id}: ${taskResult.cronExpression}`));
            return;
        }

        const job = cron.schedule(taskResult.cronExpression, () => {
            this.executeTask(taskResult);
        });

        this.tasks.set(taskResult.id, job);
    }

    async addTask(cronExpression: string, prompt: string, action: 'log' | 'email', emailRecipient?: string): Promise<ScheduledTask> {
        const id = Math.random().toString(36).substring(7);
        
        const newTask: ScheduledTask = {
            id,
            cronExpression,
            prompt,
            action,
            emailRecipient
        };

        if (!this.config.scheduledTasks) {
            this.config.scheduledTasks = [];
        }
        this.config.scheduledTasks.push(newTask);
        
        // Persist config
        await saveConfig(this.config);

        // Schedule
        this.scheduleJob(newTask);
        console.log(chalk.green(`✅ Scheduled task ${id}: "${prompt}" (${cronExpression})`));
        
        return newTask;
    }

    async removeTask(id: string): Promise<boolean> {
        const job = this.tasks.get(id);
        if (job) {
            job.stop();
            this.tasks.delete(id);
        }

         if (this.config.scheduledTasks) {
            const initialLength = this.config.scheduledTasks.length;
            this.config.scheduledTasks = this.config.scheduledTasks.filter(t => t.id !== id);
            if (this.config.scheduledTasks.length !== initialLength) {
                await saveConfig(this.config);
                console.log(chalk.yellow(`🗑️ Removed task ${id}`));
                return true;
            }
        }
        return false;
    }

    getTasks(): ScheduledTask[] {
         return this.config.scheduledTasks || [];
    }

    private async executeTask(task: ScheduledTask) {
        if (!this.agent) {
             console.error(chalk.red(`❌ Cannot execute task ${task.id}: Agent not initialized.`));
             return;
        }

        console.log(chalk.blue(`\n⏰ Running scheduled task [${task.id}]: "${task.prompt}"`));
        
        try {
            // Generate response
            const result = await this.agent.generate([{ role: 'user', content: task.prompt }]);
            const text = result.text;
            
            console.log(chalk.dim('─'.repeat(40)));
            console.log(chalk.bold(`Result for task [${task.id}]:`));
            console.log(text);
            console.log(chalk.dim('─'.repeat(40)));

            if (task.action === 'email') {
                await this.handleEmailAction(task, text);
            }

        } catch (error) {
            console.error(chalk.red(`❌ Error running task ${task.id}:`), error);
        }
    }

    private async handleEmailAction(task: ScheduledTask, content: string) {
        if (!this.config.resendApiKey) {
            console.error(chalk.red(`❌ Cannot email task result: Resend API Key not configured.`));
            return;
        }

        const recipient = task.emailRecipient || this.config.primaryEmail;
        if (!recipient) {
             console.error(chalk.red(`❌ Cannot email task result: No recipient specified and no primary email configured.`));
             return;
        }

        console.log(chalk.dim(`Sending email to ${recipient}...`));

        // Use fetch directly to avoid circular dependency with tools.ts
        try {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.resendApiKey}`,
                },
                body: JSON.stringify({
                    from: this.config.resendFromEmail || 'onboarding@resend.dev',
                    to: recipient,
                    subject: `Scheduled Task: ${task.prompt.substring(0, 50)}...`,
                    html: `<h2>Scheduled Task Result</h2>
                           <p><strong>Prompt:</strong> ${task.prompt}</p>
                           <hr/>
                           <div style="white-space: pre-wrap;">${content}</div>`,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(chalk.red(`❌ Email failed: ${response.statusText}`), errorText);
            } else {
                console.log(chalk.green(`✅ Email sent successfully!`));
            }
        } catch (error) {
             console.error(chalk.red(`❌ Email failed:`), error);
        }
    }
}
