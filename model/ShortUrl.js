import mongoose from "mongoose";
import { v4 as uuid } from "uuid";

const shortUrlSchema = new mongoose.Schema({
  destinationUrl: {
    type: String,
    required: true,
  },
  domain:{
    type:String,
    default:"trim-url-gpxt.onrender.com"

    },
  shortUrl: { type: String, required: true, unique: true },
  slugName: {
    type: String,
    unique: true,
    default: () => uuid().slice(0, 8),
    shortUrl: String,
  },

  protected: {
    type: Boolean,
    default: false,
  },
  password: {
    type: String,
    default: "",
  },

  tags: [String],
  
  isActive:{
    type:Boolean,
    default:true
  },
  

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },


  clicks: {
    type: Number,
    default: 0,
  },
  stats: {

    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  deviceStats: {

    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  browserStats: {

    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  osStats: {

    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  lastClickedAt: {
    type: Date,
    default: null,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
})

const ShortUrl = mongoose.model("ShortUrl", shortUrlSchema);

export default ShortUrl;
