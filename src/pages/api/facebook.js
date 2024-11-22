import axios from 'axios';

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
    res.status(200).json({message: 'success'});
  } catch (error) {
    return { success: false, message: error.message };
  }
}

