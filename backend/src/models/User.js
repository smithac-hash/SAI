const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 120
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["athlete", "coach"], required: true },
    // Athlete-specific fields
    age: { type: Number, min: 5, max: 100 },
    gender: { type: String, trim: true, maxlength: 30 },
    weight: { type: Number, min: 10, max: 300 },
    discoverable: { type: Boolean, default: false },
    // Coach-specific fields
    organization: { type: String, trim: true, maxlength: 120 },
    specialization: { type: String, trim: true, maxlength: 120 },
    bio: { type: String, trim: true, maxlength: 500 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
