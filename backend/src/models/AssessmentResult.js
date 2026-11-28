const mongoose = require("mongoose");

const assessmentResultSchema = new mongoose.Schema(
  {
    athlete: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    localId: { type: String, trim: true },
    test: { type: String, required: true, trim: true, maxlength: 80 },
    value: { type: Number, required: true },
    unit: { type: String, required: true, trim: true, maxlength: 30 },
    date: { type: Date, default: Date.now },
    details: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

assessmentResultSchema.index({ athlete: 1, test: 1, date: -1 });

module.exports = mongoose.model("AssessmentResult", assessmentResultSchema);
