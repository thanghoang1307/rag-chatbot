import axios from 'axios';

export default async function handler(req, res) {
  try {
    if (req.method == 'GET') {
      handlerGetMethod(req, res);
    } else {
      const reqBody = req.body;
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
    const customerMessage = reqBody.entry[0].messaging[0].message.text;
    const customerId = reqBody.entry[0].messaging[0].sender.id;
    let AIMessage = await getAIMessage(customerId, customerMessage);
    const data = await sendMessage(pageId, customerId, AIMessage);
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
    const url = `https://graph.facebook.com/v21.0/${pageId}/messages?access_token=${accessToken}`;
    console.log(url)
    const response = await axios.post(url, {recipient: {id: recipientId}, message: {text: message}, messaging_type: 'RESPONSE'}, {});
    return response;
  } catch (error) {
    console.error("Lỗi khi send Message:", error.message);
    throw error;
  }
}

async function getAIMessage(customerId, customerMessage) {
  try {
    const url = `https://rag-langchain-59555d3f3589.herokuapp.com/chat`;
    const response = await axios.post(url, {"question": customerMessage, "thread_id": customerId}, {
      headers: {
      'Content-Type': 'application/json'
    }});
    console.log(response.data.answer);
    return response.data.answer;
  } catch (error) {
    console.error("Lỗi khi get AI Message:", error.message);
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

