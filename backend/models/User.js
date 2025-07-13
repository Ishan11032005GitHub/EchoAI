// models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  googleId: String,
  facebookId: String,
  name: String,
  email: String,
  password: String,
  profilePicture: String,
  provider: String,
  providerId: String,
  isVerified: {
    type: Boolean,
    default: false
  }
  // Add other fields if needed
});

const User = mongoose.model('User', userSchema);
export default User;
