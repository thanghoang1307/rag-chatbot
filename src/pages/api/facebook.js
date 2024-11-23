import axios from 'axios';
import { createResource } from '@/lib/actions/resources';
import { openai } from '@ai-sdk/openai';
import { generateText, streamText, tool, convertToCoreMessages } from 'ai';
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
  try {
    const prompt = await req.body.entry[0].messaging[0].message.text;
    // messages.push(message);
    const pageId = await req.body.entry[0].id;
    const customerId = await req.body.entry[0].messaging[0].sender.id;
    const conversations = await getConversation(pageId, customerId);
    const messages = conversations.data[0].messages.data;
    messages.map(msg => {
      let role;
      
      if (msg.from.id == customerId) {
        role = 'user';
      } else {
        role = 'assistant';
      }

      const content = msg.message;

      return {role, content};
    });

    console.log(messages);

    const result = generateText({
      model: openai('gpt-4o-mini'),
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
    const data = await sendMessage(pageId, customerId, result.text);
    return {success: true, message: data};
  } catch (error) {
    console.error("Lỗi:", error.message);
    return { success: false, message: error.message };
  }
}

async function sendMessage(pageId, recipientId, message) {
  try {
    const accessToken = getPageAccessToken(pageId);
    const url = `https://graph.facebook.com/v21.0/${pageId}?recipient={id:${recipientId}}&message={text:${message}}&messaging_type=RESPONSE&access_token=${accessToken}`;
    const response = await axios.post(url, null, { timeout: 10000 });
    return response;
  } catch (error) {
    console.error("Lỗi khi gọi API:", error);
    throw error;
  }
}

async function getConversation(pageId, customerId) {
  try {
    const accessToken = getPageAccessToken(pageId);
    const url = `https://graph.facebook.com/v21.0/${customerId}/conversations?fields=participants,messages{message,from}?access_token=${accessToken}`;
    const response = await axios.get(url, null, {timeout: 10000 });
    return response;
  } catch (error) {
    throw error;
  }
}

function getPageAccessToken(pageId) {
  const config = JSON.parse(process.env.NEXT_PUBLIC_CONFIG || {});
    const page = config.data.find((page) => {
      return page.id == pageId;
    });
  
  return page.access_token;
}

