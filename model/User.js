import mongoose from "mongoose";




const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
  },

  password: {
    type: String,
    required: function () { return !this.googleId },

  },
  token: [{
    tokenName: String,
    tokenId: String
  }],
  customDomain: [
    {
      name: {
        type: String,
        required: true,
      },
      cnameTarget: {
        type: String,
      },
      addedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],

  createdAt: {
    type: Date,
    default: Date.now,
  },
});



const User = mongoose.model("User", userSchema);
export default User;