import { Router } from 'express';
import { askAI } from '../controllers/aiController.js';
import { saveChat, getChatHistory } from '../controllers/chatController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

router.post('/askai', authMiddleware, askAI);             // For Gemini or AI responses
router.post('/chat', authMiddleware, saveChat);           // Save a chat message
router.get('/chathistory', authMiddleware, getChatHistory);
1
export default router;
