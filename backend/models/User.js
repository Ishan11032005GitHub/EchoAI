import mongoose from 'mongoose';
const userSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // null for OAuth users
  provider: {
    type: String,
    enum: ['local', 'google', 'facebook'],
    default: 'local'
  },
  providerId: { type: String },
  profilePicture: { type: String }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

export default User;
