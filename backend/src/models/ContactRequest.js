const mongoose = require("mongoose");

const contactRequestSchema = new mongoose.Schema(
  {
    athlete: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    message: { type: String, trim: true, maxlength: 500, default: "" },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending"
    }
  },
  { timestamps: true }
);

contactRequestSchema.index({ athlete: 1, coach: 1 }, { unique: true });

module.exports = mongoose.model("ContactRequest", contactRequestSchema);
