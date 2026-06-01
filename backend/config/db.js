const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Added options object to force IPv4 and set a timeout
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      family: 4, 
      serverSelectionTimeoutMS: 5000
    });
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`DB Error: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;