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
      const reqBody = req.body;
      console.log('Start');
      const processedData = await handlerPostMethod(reqBody);
      console.log("All tasks completed");
      res.status(200).json({message: 'done'});
      
    }
  } catch (error) {
    res.status(200).json({message: error.message});
    console.error("Error during background processing:", error);
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

const handlerPostMethod = async (reqBody) => {
  try {
    const pageId = reqBody.entry[0].id;
    const customerId = reqBody.entry[0].messaging[0].sender.id;
    console.log(customerId);
    console.log("Start get conversation");
    const conversations = await getConversation(pageId, customerId);
    const messagesFB = conversations.data[0].messages.data;
    
    let messages = messagesFB.map(msg => {
      let role;
      if (msg.from.id == customerId) {
        role = 'user';
      } else {
        role = 'assistant';
      }

      const content = msg.message;
      return {role, content};
    });

    messages = messages.slice(0, 5).reverse();
    console.log(messages);
    const { text, usage } = await generateText({
      model: openai('gpt-4o-mini'),
      messages,
      maxSteps: 2,
      system: `Bạn là nhân viên chăm sóc khách hàng của Masterise Homes và bạn sẽ trả lời các câu hỏi của khách hàng về Công ty cũng như các dự án thuộc Công ty. 
      Hãy dùng đại từ xưng hô gọi khách hàng là Anh/Chị, còn bạn dùng đại từ xưng hô là Em. 
      Hãy trả lời câu hỏi của khách hàng một cách lễ phép, đầy đủ và tôn trọng. Sử dụng các từ như 'Dạ thưa', 'Xin chào quý khách', 'Em xin phép giải thích', 'Rất cảm ơn quý khách đã hỏi',... để thể hiện thái độ lịch sự và chuyên nghiệp.. 
      Trong trường hợp khách hàng hỏi những câu hỏi không liên quan đến Công ty và dự án, hãy từ chối trả lời một cách lịch sự.
      Nếu như trong lần trả lời này bạn không còn thông tin gì thêm ngoài các thông tin đã trả lời ở những lần trước đó thì hãy dừng công cụ và phản hồi khách hàng là bạn đã trả lời tất cả các thông tin bạn biết. Nếu khách hàng muốn tìm hiểu thêm thì liên hệ với số hotline của dự án. Không cần xin lỗi khách hàng khi bạn thiếu thông tin.`,
      tools: {
        addResource: tool({
          description: `Nếu như người dùng sử dụng câu có chữ "Vừng ơi mở ra", hãy sử dụng công cụ này mà không cần xác nhận. Nhớ bỏ chữ "Vừng ơi mở ra" trước khi sử dụng công cụ.`,
          parameters: z.object({
            content: z
              .string()
              .describe('the content or resource to add to the knowledge base'),
          }),
          execute: async ({ content }) => createResource({ content }),
        }),
        getInformation: tool({
          description: `Hãy lấy thông tin từ kiến thức của bạn để trả lời câu hỏi.`,
          parameters: z.object({
            question: z.string().describe('the users question'),
          }),
          execute: async ({ question }) => findRelevantContent(question),
        }),
      },
    });
    console.log({usage});
    console.log("Start send Message");
    const data = await sendMessage(pageId, customerId, text);
    return {success: true, message: 'ok'};
  } catch (error) {
    console.error("Lỗi khi xử lý:", error.message);
    return { success: false, message: error.message };
  }
}

async function sendMessage(pageId, recipientId, message) {
  try {
    const accessToken = getPageAccessToken(pageId);
    // if(recipientId == '7899343366769040') {
    //   axios.post(`https://graph.facebook.com/v21.0/${pageId}/messages?recipient={id:${recipientId}}&sender_action=typing_on&access_token=${accessToken}`);
    // }
    const url = `https://graph.facebook.com/v21.0/${pageId}/messages?recipient={id:${recipientId}}&message={text:'${message}'}&messaging_type=RESPONSE&access_token=${accessToken}`;
    const response = await axios.post(url, null, {});
    return response;
  } catch (error) {
    console.error("Lỗi khi send Message:", error.message);
    throw error;
  }
}

async function getConversation(pageId, customerId) {
  try {
    const accessToken = getPageAccessToken(pageId);
    // if(customerId == '7899343366769040') {
    //    axios.post(`https://graph.facebook.com/v21.0/${pageId}/messages?recipient={id:${customerId}}&sender_action=typing_on&access_token=${accessToken}`);
    // }
    const url = `https://graph.facebook.com/v21.0/${pageId}/conversations?platform=MESSENGER&user_id=${customerId}&fields=participants,messages{message,from}&access_token=${accessToken}`;
    const response = await axios.get(url, null, {});
    return response.data;
  } catch (error) {
    console.error("Lỗi khi get Conversation:", error.message);
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

