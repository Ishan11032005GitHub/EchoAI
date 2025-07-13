import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();
import Chat from '../models/Chat.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const askAI = async (req, res) => {
  try {
    const prompt = req.body.prompt;
    const userId = req.userId;
    if (!prompt) return res.status(400).json({ error: "Prompt required" });

    const previousChats = await Chat.find({ userId }).sort({ timestamp: 1 });
    const history = previousChats.flatMap(chat => ([
      { role: "user", parts: [{ text: chat.prompt }] },
      { role: "model", parts: [{ text: chat.response }] }
    ]));

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const chat = await model.startChat({ history });

    const result = await chat.sendMessage(prompt);
    const response = result.response.text();

    const newChat = new Chat({ userId, prompt, response });
    await newChat.save();

    res.status(200).json({ response });
  } catch (error) {
    console.error("Gemini error:", error.message);
    res.status(500).json({ error: "AI response failed" });
  }
};