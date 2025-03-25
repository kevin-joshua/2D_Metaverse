import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        avatarId: { type: mongoose.Schema.Types.ObjectId, ref: "Avatar", required: true }, // Stores reference to avatar
        position: {
            x: { type: Number, default: 100 }, // Default spawn position
            y: { type: Number, default: 200 },
        },
    },
    { timestamps: true } // Automatically adds createdAt & updatedAt fields
);

const User = mongoose.model("User", userSchema);
export default User;
