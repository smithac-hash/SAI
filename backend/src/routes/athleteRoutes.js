const express = require("express");
const AssessmentResult = require("../models/AssessmentResult");
const ContactRequest = require("../models/ContactRequest");
const { protect, allowRoles } = require("../middleware/auth");
const { publicUser } = require("../utils/authResponse");

const router = express.Router();

router.use(protect, allowRoles("athlete"));

router.patch("/discoverability", async (req, res, next) => {
  try {
    if (typeof req.body.discoverable !== "boolean") {
      return res.status(400).json({ message: "discoverable must be true or false" });
    }
    req.user.discoverable = req.body.discoverable;
    await req.user.save();
    res.json({ message: "Discoverability updated", discoverable: req.user.discoverable });
  } catch (error) {
    next(error);
  }
});

router.post("/results/sync", async (req, res, next) => {
  try {
    const results = req.body.results;
    if (!Array.isArray(results) || results.length > 200) {
      return res.status(400).json({ message: "Send an array of up to 200 results" });
    }

    const valid = results.filter((item) =>
      item &&
      typeof item.test === "string" &&
      item.test.trim() &&
      Number.isFinite(Number(item.value)) &&
      typeof item.unit === "string"
    );

    const operations = valid.map((item) => ({
      updateOne: {
        filter: { athlete: req.user._id, localId: String(item.id || "") },
        update: {
          $set: {
            test: item.test.trim(),
            value: Number(item.value),
            unit: item.unit.trim(),
            date: item.date ? new Date(item.date) : new Date(),
            details: item.details && typeof item.details === "object" ? item.details : {}
          }
        },
        upsert: true
      }
    })).filter((op) => op.updateOne.filter.localId);

    if (operations.length) await AssessmentResult.bulkWrite(operations);
    res.json({ message: "Assessment results synced", synced: operations.length });
  } catch (error) {
    next(error);
  }
});

router.get("/my-results", async (req, res, next) => {
  try {
    const results = await AssessmentResult.find({ athlete: req.user._id }).sort({ date: -1 });
    res.json({ results });
  } catch (error) {
    next(error);
  }
});

router.get("/contact-requests", async (req, res, next) => {
  try {
    const requests = await ContactRequest.find({ athlete: req.user._id })
      .populate("coach", "name email organization specialization bio")
      .sort({ createdAt: -1 });
    res.json({ requests });
  } catch (error) {
    next(error);
  }
});

router.patch("/contact-requests/:id", async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["accepted", "declined"].includes(status)) {
      return res.status(400).json({ message: "Status must be accepted or declined" });
    }
    const request = await ContactRequest.findOne({
      _id: req.params.id,
      athlete: req.user._id
    });
    if (!request) return res.status(404).json({ message: "Contact request not found" });
    request.status = status;
    await request.save();
    res.json({ message: `Request ${status}`, request });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
