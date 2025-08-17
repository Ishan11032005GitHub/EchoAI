import Chat from '../models/Chat.js';

export const saveChat = async (req, res) => {
  try {
    const { prompt, response } = req.body;
    const userId = req.userId;

    if (!prompt || !response) {
      return res.status(400).json({ message: "Prompt and response are required." });
    }

    const newChat = new Chat({ userId, prompt, response });
    await newChat.save();
    res.status(201).json({ message: "Chat saved successfully" });
  } catch (error) {
    console.error("Error saving chat:", error);
    res.status(500).json({ message: "Failed to save chat" });
  }
};

export const getChatHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const chats = await Chat.find({ userId }).sort({ timestamp: 1 });
    res.status(200).json({ chats });
  } catch (error) {
    console.error("Error fetching chat history:", error);
    res.status(500).json({ message: "Failed to fetch chat history" });
  }
};
