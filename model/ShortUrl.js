import mongoose from "mongoose";
import {v4 as uuid} from "uuid"
const shortUrlSchema = new mongoose.Schema({
  destinationUrl: {
    type: String,
    required: true,
  },
  slugName: String,
  shortUrl: String,

  protected: {
    type: Boolean,
    default: false,
  },
  password: {
    type: String,
    default: "",
  },

  tags: [String],

  utmEnabled: {
    type: Boolean,
    default: false, // ✅ False by default
  },

  utm: {
    source: String,     // utm_source
    medium: String,     // utm_medium
    campaign: String,   // utm_campaign
    term: String,       // utm_term (optional)
    content: String,    // utm_content (optional)
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});





const ShortUrl = mongoose.model("ShortUrl",shortUrlSchema);

export default ShortUrl
