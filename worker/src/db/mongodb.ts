import mongoose from 'mongoose';

export async function connectDB(uri: string = 'mongodb://localhost:27017/blueprint-ai') {
  try {
    if (mongoose.connection.readyState === 1) {
      return;
    }
    await mongoose.connect(uri);
    console.log('📦 Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}
