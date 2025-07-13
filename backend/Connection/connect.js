import mongoose from 'mongoose';

const connectDB = async () => {
  const uri = 'mongodb+srv://Ishan11032005:Ishan11032005%40ATLAS@users.ru6tdqt.mongodb.net/nexusbot?retryWrites=true&w=majority';

  try {
    console.log('Connecting to MongoDB...');
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 30000
    });
    console.log(`✅ Connected to: ${conn.connection.host}`);
    console.log(`📁 Database: ${conn.connection.name}`);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.log('Troubleshooting:');
    console.log('1. Check Atlas IP whitelist');
    console.log('2. Verify password in connection string');
    console.log('3. Ensure cluster is not paused');
    process.exit(1);
  }
};

export default connectDB;