import express from 'express'
import mongoose from 'mongoose';
const app = express();

const mongo_uri = 'mongodb://localhost:27017/';


const connectDB = async () => {
  try {
    await mongoose.connect(mongo_uri);
    console.log('MongoDB connected')
  } catch (error) {
     console.log('MongoDB connection error', error.message)
  }
};

connectDB()

const PORT = 5000;
app.listen(PORT, ()=> {
    console.log(`App is running on PORT ${PORT}`)
})
