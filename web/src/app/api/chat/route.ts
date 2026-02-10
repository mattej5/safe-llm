
import { createAgent } from '@agent/agent-factory';
import { ensureConfig } from '@agent/config-wizard';
import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export const runtime = 'nodejs'; // Required for fs access in config/tools

export async function POST(req: Request) {
    const { messages } = await req.json();

    const config = await ensureConfig();
    const { agent } = await createAgent(config);

    // Mastra Wrapper vs AI SDK
    // The easiest way to get streaming working with Vercel AI SDK UI is to use streamText directly
    // BUT checking if we can use agent.generate/stream to keep memory/tools logic.
    // Agent.stream returns textStream.
    // If we use streamText, we bypass the Agent's memory/tool logic unless we recreate it or if Agent exposes it comfortably.

    // Mastra Agent implements its own loop.
    // If we want to use the agent as is, we should use agent.stream().
    // However, bridging that stream to Vercel AI SDK 'streamText' response format (Data Stream Protocol) is manually required.
    // Or we can just return the stream if the frontend expects raw text?
    // Vercel AI SDK 'useChat' expects the Data Stream Protocol by default in v3/v4.

    // Let's try to use the Agent's stream directly and wrap it in a Response.
    // But Vercel's useChat might expect specific format.

    // Alternative: Use streamText but pass the tools and system prompt from the agent config?
    // That duplicates logic (memory, etc).

    // Best Approach: Run the agent, get its stream, and pipe it.
    // Mastra's result.textStream is an AsyncIterable<string>.

    const result = await agent.stream(messages);

    // Create a ReadableStream from the async iterable
    const stream = new ReadableStream({
        async start(controller) {
            for await (const chunk of result.textStream) {
                controller.enqueue(chunk);
            }
            controller.close();
        }
    });

    // Return as plain text stream. useChat can handle this if we don't use complex protocol features?
    // Actually, useChat handles simple text streams fine usually.
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
        },
    });
}
