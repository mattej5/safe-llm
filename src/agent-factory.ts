import { Agent } from '@mastra/core';
import { createOpenAI } from '@ai-sdk/openai';
import { AgentConfig } from './config-wizard';
import { getEnabledTools, createSchedulerTools } from './tools';
import { Scheduler } from './scheduler';

export async function createAgent(config: AgentConfig, scheduler?: Scheduler) {
    const activeTools = getEnabledTools(config);

    // Initialize Scheduler if not provided, but mostly we might want to pass it or create it here?
    // In index.ts it was created before agent.
    // "scheduler.setAgent(agent)" was called after agent creation.
    // The tools "createSchedulerTools(scheduler)" were added to activeTools.

    // Let's allow passing an existing scheduler, or create one if needed, 
    // BUT the scheduler needs the agent, and the agent needs the scheduler tools... circular dependency if not careful.
    // In index.ts:
    // 1. activeTools = getEnabledTools
    // 2. scheduler = new Scheduler
    // 3. schedulerTools = createSchedulerTools(scheduler)
    // 4. Object.assign(activeTools, schedulerTools)
    // 5. Filter disabled tools again for scheduler tools
    // 6. Create Agent with activeTools
    // 7. scheduler.setAgent(agent)

    // We should replicate this logic.

    const localScheduler = scheduler || new Scheduler(config);
    const schedulerTools = createSchedulerTools(localScheduler);

    Object.assign(activeTools, schedulerTools);

    // Filter disabled tools again for scheduler tools
    if (config.disabledTools) {
        for (const disabledId of config.disabledTools) {
            const key = Object.keys(activeTools).find(k => activeTools[k].id === disabledId);
            if (key) delete activeTools[key];
        }
    }

    let openai = createOpenAI({
        baseURL: config.baseUrl,
        apiKey: config.apiKey || 'not-needed',
        // @ts-expect-error - feature is available in runtime but missing in types
        compatibility: 'strict',
    });

    const agent = new Agent({
        id: 'local-agent',
        name: 'Local Agent',
        instructions: 'You are a helpful AI assistant. You can think before answering using <think> tags. Always show your thinking steps. Connect to the user. Do not indent your responses with 4 spaces unless writing code blocks. You have access to a long-term memory. Use the read-memory tool to check for past information and the save-memory tool to store important details. When reading memory, treat the file as a chronological log. If you find conflicting information (e.g. user preferences changing), always prioritize the most recent entry based on the timestamp.',
        model: openai.chat(config.modelId),
        tools: activeTools,
    });

    localScheduler.setAgent(agent);

    return { agent, scheduler: localScheduler, activeTools };
}
