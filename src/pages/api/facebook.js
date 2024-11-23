import axios from 'axios';
import { createResource } from '@/lib/actions/resources';
import { openai } from '@ai-sdk/openai';
import { generateText, streamText, tool } from 'ai';
import { z } from 'zod';
import { findRelevantContent } from '@/lib/ai/embedding';

export default async function handler(req, res) {
  try {
    if (req.method == 'GET') {
      handlerGetMethod(req, res);
    } else {
      const result = await handlerPostMethod(req, res)
      if (result.success) {
        res.status(200).json({message: result.message});
    } else {
        res.status(500).json({message: result.message});
    }
    }
  } catch (error) {
    res.status(500).json({message: error.message});
  }
}

const handlerGetMethod = (req, res) => {
  var token = process.env.NEXT_PUBLIC_TOKEN || 'vungoimora';
  if (
    req.query['hub.mode'] == 'subscribe' &&
    req.query['hub.verify_token'] == token
  ) {
    res.status(200).send(req.query['hub.challenge']);
  } else {
    res.status(400).send('error');
  }
}

const handlerPostMethod = async (req, res) => {
    const body = req.body;
    if (body.object === "page") {
      try {
        const message = await req.body.entry[0].messaging[0].message.text;
        console.log({message: message});
        return {success: true, message: 'ok'};
      } catch(e) {
        return { success: false, message: e.message };
      }
    } else {
      return { success: false, message: 'not page' };
    }
    

  try {
    const message = await req.body.entry[0].messaging.text;
    const result = generateText({
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
    return {success: true, message: result.text};
  } catch (error) {
    return { success: false, message: error.message };
  }
}

