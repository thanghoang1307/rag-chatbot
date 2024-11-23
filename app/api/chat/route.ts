import { createResource } from '@/lib/actions/resources';
import { openai } from '@ai-sdk/openai';
import { generateText, streamText, tool } from 'ai';
import { z } from 'zod';
import { findRelevantContent } from '@/lib/ai/embedding';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();
  console.log(messages);

  const result = streamText({
    model: openai('gpt-4o'),
    messages,
    system: `You are a telesales of a Masterise Homes company. Check Masterise Homes's knowledge base before answering any questions.
    Only respond to questions using information from tool calls.
    if no relevant information is found in the tool calls, respond user that you haven't known and tell them to call 0933 894 980 to know more in Vietnamese`,
    tools: {
      addResource: tool({
        description: `remove "Vừng ơi mở ra" and add a resource to your knowledge base.
          If the user provides sentence that contains "Vừng ơi mở ra", use this tool without asking for confirmation.`,
        parameters: z.object({
          content: z
            .string()
            .describe('the content or resource to add to the knowledge base'),
        }),
        execute: async ({ content }) => createResource({ content }),
      }),
      getInformation: tool({
        description: `get information from your knowledge base to answer questions.`,
        parameters: z.object({
          question: z.string().describe('the users question'),
        }),
        execute: async ({ question }) => findRelevantContent(question),
      }),
    },
  });
  return result.toDataStreamResponse();
}