// models/Chat.js
import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  prompt: {
    type: String
  },
  response: {
    type: String,
    required: true
  },
  fileUrl: {  // 🔁 Use lowercase 'fileUrl' consistently
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Chat', chatSchema);
