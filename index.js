import express, { json } from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import cookieParser from "cookie-parser";
import authenticator from "./middleware/authMiddleware.js";
import appRoutes from "./routes/appRoutes.js";
import cors from "cors"
import { redirectProtectPages, redirectUrl } from "./controllers/appControllers.js";
dotenv.config();
connectDB();


const PORT = process.env.PORT_NUMBER;
const app = express();
app.use(express.json());
app.use(cors({ origin: "http://localhost:5173", credentials: true }))
app.use(cookieParser());
app.use("/auth", authRoutes);
app.post("/auth/logout",(req,res)=>{
    res.clearCookie("token").json({ message: "Logged out" });
})
app.post("/protected-url",redirectProtectPages)
app.use("/",authenticator,appRoutes);
app.get("/hello", authenticator, (req, res) => {
    res.send(`hello user id ${req.user.userId}`);
});
app.get("/:slugName",redirectUrl);
app.listen(PORT, (err) => {
    if (err) {
        console.log(err);

    } else {
        console.log(`Server is running on Port : ${PORT}`);
    }
});