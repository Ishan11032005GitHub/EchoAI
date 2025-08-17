import mongoose from 'mongoose';
import { set } from 'mongoose';

const connectDB = async () => {
  // 1. Environment Validation
  const uri = process.env.MONGODB_URI?.trim();
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (!uri) {
    console.error('❌ MONGODB_URI is not defined in environment variables');
    console.log('💡 Solution: Add MONGODB_URI to Railway variables');
    process.exit(1);
  }

  // 2. Connection Configuration
  const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: nodeEnv === 'production' ? 10000 : 5000,
    socketTimeoutMS: 45000,
    retryWrites: true,
    w: 'majority',
    appName: 'echoai-backend',
    maxPoolSize: nodeEnv === 'production' ? 50 : 10,
    minPoolSize: 5,
    connectTimeoutMS: 30000
  };

  // 3. Debugging Setup
  if (nodeEnv === 'development') {
    set('debug', (collectionName, method, query, doc) => {
      console.log(`🐛 MongoDB: ${collectionName}.${method}`, {
        query,
        doc
      });
    });
  }

  // 4. Connection Handler
  try {
    console.log('🔌 Attempting MongoDB connection...');
    console.log(`   Environment: ${nodeEnv.toUpperCase()}`);
    console.log(`   Cluster: ${uri.split('@')[1]?.split('/')[0] || 'unknown'}`);

    const conn = await mongoose.connect(uri, options);

    console.log(`✅ Connected to: ${conn.connection.host}`);
    console.log(`📁 Database: ${conn.connection.name}`);
    console.log(`👥 Connections: ${conn.connections.length}`);

    // 5. Event Listeners
    mongoose.connection.on('connected', () => {
      console.log('🟢 Mongoose default connection open');
    });

    mongoose.connection.on('error', (err) => {
      console.error('🔴 Mongoose connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('🟡 Mongoose connection disconnected');
    });

    // 6. Graceful Shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('⏏️ Mongoose connection disconnected through app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error('\n❌ FATAL: MongoDB connection failed');
    console.error(`Error: ${error.message}`);
    console.log('\n🔧 Troubleshooting Guide:');
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('1. Check if your Atlas cluster is paused → Resume in dashboard');
      console.log('2. Whitelist all IPs temporarily: 0.0.0.0/0');
    } else if (error.message.includes('auth failed')) {
      console.log('1. Verify username/password are URL encoded (replace @ with %40)');
      console.log('2. Check if user exists in Atlas → Security → Database Access');
    } else if (error.message.includes('invalid schema')) {
      console.log('1. Ensure URI starts with mongodb+srv://');
      console.log('2. Check for typos in connection string');
    }

    console.log('\n📌 Railway Specific Checks:');
    console.log('- Run `railway variables list` to verify MONGODB_URI exists');
    console.log('- Check build logs with `railway logs --build`');
    
    process.exit(1);
  }
};

export default connectDB;