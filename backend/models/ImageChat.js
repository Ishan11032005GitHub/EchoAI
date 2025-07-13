import mongoose from 'mongoose';

const ImageChatSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  prompt: { type: String, required: true },
  imageBase64: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const ImageChat = mongoose.model('ImageChat', ImageChatSchema);

export default ImageChat;
