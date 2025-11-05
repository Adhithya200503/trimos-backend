import User from "../model/User.js";
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken";

export const signup = async (req, res) => {
    console.log("Signup controller hit");
    const { username, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.json({ message: "Email already exists" })
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
        username,
        email,
        password: hashedPassword
    })

    try {
        await newUser.save();
        return res.status(200).json({ message: "User account created Successfully" });
    } catch (error) {
        console.log(`this from signup controller ${error}`)
        return res.status(500).json({ message: "Unable to create the account" });
    }

}

export const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(401).json({ message: "enter necessary credentials to login" });
    }

    try {
        const isUserExist = await User.findOne({ email });
        if(!isUserExist){
            return res.status(401).json({ message: "Invalid Credentials" });
        }
        const decryptPassword = await bcrypt.compare(password, isUserExist.password);
        if (isUserExist && decryptPassword) {
            const token = jwt.sign({ userId: isUserExist._id }, process.env.JWT_SECRET, {expiresIn:process.env.JWT_EXPIRE});
            res.cookie("token", token, {
                httpOnly: true,
                secure: true,
                sameSite: "none"
            })
        const userData = isUserExist;
            return res.status(200).json({ message: "Signin successfull" , userData});
        } else {
            return res.status(401).json({ message: "Invalid Credentials" });
        }
    } catch (error) {
        return res.status(500).json({message:"Internal server error"});
    }

}


