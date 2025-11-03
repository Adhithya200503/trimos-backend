import mongoose from "mongoose";

const connectDB = async()=>{
  try {
    await mongoose.connect(process.env.MONGO_URI,{
        dbName:"trimo"
    });
    console.log("Data base connected");
  } catch (error) {
    console.log(`Unable to connect Data base\nError:${error}`);
  }
}

export default connectDB;