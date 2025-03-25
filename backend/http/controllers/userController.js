import User from "../models/userModel.js";
import bcrypt from "bcrypt";

// Register New User
export const registerUser = async (req, res) => {
    try {
        const { name, email, password, avatarId } = req.body;

        // Hash the password before saving
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = await User.create({
            name,
            email,
            password: hashedPassword,
            avatarId, // Avatar must exist in the Avatar collection
            position: { x: 100, y: 200 }, // Default spawn position
        });

        res.status(201).json({ success: true, data: newUser });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};
