import mongoose from 'mongoose';

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  try {
    console.log('Attempting to connect to MongoDB Atlas...');
    
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 60000, // 5 second timeout
      socketTimeoutMS: 45000, // 45 second socket timeout
      maxPoolSize: 10 // Connection pool size
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📁 Database: ${conn.connection.name}`);
    
    // Test the connection
    await conn.connection.db.admin().ping();
    console.log('🗸 Connection verified');
    
    return conn;
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    
    // Specific error diagnostics
    if (error.name === 'MongoServerSelectionError') {
      console.log('\nPossible solutions:');
      console.log('1. Check your Atlas IP whitelist: https://cloud.mongodb.com/v2#/security/network/accessList');
      console.log('2. Verify your password (try resetting in Atlas)');
      console.log('3. Ensure cluster is not paused');
    }
    
    process.exit(1); // Exit with failure
  }
};

// Connection event handlers
mongoose.connection.on('connected', () => {
  console.log('Mongoose default connection open');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose default connection disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('Mongoose connection closed through app termination');
  process.exit(0);
});

// Execute the connection
export default connectDB;
