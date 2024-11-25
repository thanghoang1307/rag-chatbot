import axios from 'axios';
import { createResource } from '@/lib/actions/resources';
import { openai } from '@ai-sdk/openai';
import { generateText, streamText, tool, convertToCoreMessages } from 'ai';
import { z } from 'zod';
import { findRelevantContent } from '@/lib/ai/embedding';
import { constants } from 'buffer';

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
    // const pageId = await req.body.entry[0].id;
    // const customerId = await req.body.entry[0].messaging[0].sender.id;
    // const conversations = await getConversation(pageId, customerId);
    // const messagesFB = conversations.data[0].messages.data;
    
    // let messages = messagesFB.map(msg => {
    //   let role;
      
    //   if (msg.from.id == customerId) {
    //     role = 'user';
    //   } else {
    //     role = 'assistant';
    //   }

    //   const content = msg.message;

    //   return {role, content};
    // });

    // messages = messages.slice(0, 5).reverse();

    // console.log(messages);

    /* Test local*/
    const messages = [
      { role: 'user', content: 'Hãy cho tôi biết thêm thông tin về doanh nghiệp của bạn ?' },
      { role: 'assistant', content: 'Masterise Homes®, trực thuộc tập đoàn Masterise, là nhà phát triển bất động sản quốc tế tiên phong áp dụng các chuẩn mực toàn cầu vào việc phát triển, vận hành và quản lý các sản phẩm, dịch vụ bất động sản tại Việt Nam và thế giới. Công ty cam kết không ngừng kiến tạo những công trình kiến trúc đẳng cấp và trải nghiệm xứng tầm cho khách hàng, tạo nên các giá trị vượt thời gian được công nhận trên toàn thế giới. Hiện tại, Masterise Homes có 10 dự án, trong đó có dự án Masteri Grand View.' },
      { role: 'user', content: 'Còn gì nữa không ?' },
      
    ];
    
    const result = await generateText({
      model: openai('gpt-4o'),
      messages,
      maxSteps: 5,
      system: `Bạn là nhân viên chăm sóc khách hàng của Masterise Homes và bạn sẽ trả lời các câu hỏi của khách hàng về Công ty cũng như các dự án thuộc Công ty. Trong trường hợp khách hàng hỏi những câu hỏi không liên quan đến Công ty và dự án, hãy từ chối trả lời một cách lịch sự.`,
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
          description: `Hãy lấy thông tin từ kiến thức của bạn để trả lời câu hỏi. Nếu như trong lần trả lời này bạn không còn thông tin gì thêm ngoài các thông tin đã trả lời ở những lần trước đó thì hãy phản hồi khách hàng là bạn đã trả lời tất cả các thông tin bạn biết. Nếu khách hàng muốn tìm hiểu thêm thì gọi cho Thắng đẹp trai, số điện thoại 0933 894 980.`,
          parameters: z.object({
            question: z.string().describe('the users question'),
          }),
          execute: async ({ question }) => findRelevantContent(question),
        }),
      },
    });

    // if (text) {
    //   console.log('ok');
    //   return {success: true, message: text};
    // } else {
      // const totalAnswer = toolResults.result.map(toolResult => toolResult.name);
      console.log(result);
      // const remainAnswer = totalAnswer.filter(answer => {
      //   const assistantAnswer = messages.filter(message => message.role == 'assistant').map(message => message.content);
      //   return !assistantAnswer.includes(answer);
    //   })
      return {success: true, message: result};
    
  } catch (error) {
    console.error("Lỗi khi xử lý:", error.message);
    return { success: false, message: error.message };
  }
}

async function sendMessage(pageId, recipientId, message) {
  try {
    const accessToken = getPageAccessToken(pageId);
    const url = `https://graph.facebook.com/v21.0/${pageId}/messages?recipient={id:${recipientId}}&message={text:'${message}'}&messaging_type=RESPONSE&access_token=${accessToken}`;
    console.log(url);
    const response = await axios.post(url, null, { timeout: 10000 });
    return response;
  } catch (error) {
    console.error("Lỗi khi send Message:", error.message);
    throw error;
  }
}

async function getConversation(pageId, customerId) {
  try {
    const accessToken = getPageAccessToken(pageId);
    const url = `https://graph.facebook.com/v21.0/${customerId}/conversations?fields=participants,messages{message,from}&access_token=${accessToken}`;
    const response = await axios.get(url, null, {timeout: 10000 });
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