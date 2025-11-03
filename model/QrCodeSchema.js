import mongoose, { Schema } from 'mongoose';

const qrcode = new mongoose.Schema({
    userId:{
        required:true,
        type:String
    },
    destinationUrl:{
        type:String,
        required:true,
    },
    qrUrl:{
        type:String,
        required:true
    },
    createdAt:{
        type:Date,
        default:Date.now
    }


})

const QRcode = mongoose.model("QRcode",qrcode);
export default QRcode;
