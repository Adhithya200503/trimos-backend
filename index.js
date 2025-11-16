import express, { json } from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import cookieParser from "cookie-parser";
import authenticator from "./middleware/authMiddleware.js";
import appRoutes from "./routes/appRoutes.js";
import cors from "cors"
import { createShortUrl, redirectProtectPages, redirectUrl } from "./controllers/appControllers.js";
import User from "./model/User.js";
dotenv.config();
connectDB();


const PORT = process.env.PORT_NUMBER;
const app = express();
app.use(express.json());
const allowedOrigins = [
  "http://localhost:5173",
  "https://url-shortner-mkoi.onrender.com",
  "https://www.trimurl.site",
  "https://trimurl.site"
];


app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(cookieParser());
app.use(async (req, res, next) => {
    const host = req.headers.host; // e.g., johnslink.com

    const user = await User.findOne({ "customDomain.name": host });

    if (user) {
        // Mark as verified if needed
        const domain = user.customDomain.find(d => d.name === host);
        if (!domain.verified) {
            domain.verified = true;
            await user.save();
        }

        // Serve the user's link page
        return handleUserLinkPage(user, req, res);
    }

    next();
});

app.use("/auth", authRoutes);

app.post("/protected-url", redirectProtectPages)

app.use("/api/v1", authenticator, appRoutes);
app.get("/:slugName", redirectUrl);
app.post("/create-short-url/userId",createShortUrl);
app.listen(PORT, (err) => {
  if (err) {
    console.log(err);

  } else {
    console.log(`Server is running on Port : ${PORT}`);
  }
});
