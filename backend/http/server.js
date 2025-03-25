import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import cors from "cors";

dotenv.config();

const app = express();


//middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());





;(async () => {
    await connectDB();
    app.listen(process.env.API_PORT, () => {
        console.log(`Server is running on port ${process.env.API_PORT}`);
    });
})();


