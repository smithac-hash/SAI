require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const authRoutes = require("./src/routes/authRoutes");
const athleteRoutes = require("./src/routes/athleteRoutes");
const coachRoutes = require("./src/routes/coachRoutes");
const messageRoutes = require("./src/routes/messageRoutes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.json({ message: "SAI API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/athletes", athleteRoutes);
app.use("/api/coaches", coachRoutes);
app.use("/api/messages", messageRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

const PORT = process.env.PORT || 8082;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;

if (!MONGODB_URI || !JWT_SECRET) {
  console.error("Missing MONGODB_URI or JWT_SECRET in .env");
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`SAI API listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
