
const express = require("express");
const User = require("../models/User");
const AssessmentResult = require("../models/AssessmentResult");
const ContactRequest = require("../models/ContactRequest");
const { protect, allowRoles } = require("../middleware/auth");

const router = express.Router();

router.use(protect, allowRoles("coach"));

// Get the logged-in coach's profile
router.get("/profile", async (req, res, next) => {
  try {
    const coach = await User.findOne({
      _id: req.user._id,
      role: "coach",
    }).select("name email organization specialization bio");

    if (!coach) {
      return res.status(404).json({ message: "Coach profile not found" });
    }

    res.json({ coach });
  } catch (error) {
    next(error);
  }
});

// Update the logged-in coach's own profile
router.patch("/profile", async (req, res, next) => {
  try {
    const allowedFields = ["name", "organization", "specialization", "bio"];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (typeof req.body[field] !== "string") {
          return res.status(400).json({
            message: `${field} must be text`,
          });
        }

        updates[field] = req.body[field].trim();
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "No profile changes provided",
      });
    }

    if (updates.name !== undefined && !updates.name) {
      return res.status(400).json({
        message: "Name cannot be empty",
      });
    }

    if (updates.name && updates.name.length > 80) {
      return res.status(400).json({ message: "Name is too long" });
    }

    if (updates.organization && updates.organization.length > 120) {
      return res.status(400).json({ message: "Organization is too long" });
    }

    if (updates.specialization && updates.specialization.length > 120) {
      return res.status(400).json({ message: "Specialization is too long" });
    }

    if (updates.bio && updates.bio.length > 500) {
      return res.status(400).json({ message: "Bio cannot exceed 500 characters" });
    }

    const coach = await User.findOneAndUpdate(
      { _id: req.user._id, role: "coach" },
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    ).select("name email organization specialization bio");

    if (!coach) {
      return res.status(404).json({ message: "Coach profile not found" });
    }

    res.json({
      message: "Coach profile updated successfully",
      coach,
    });
  } catch (error) {
    next(error);
  }
});

// Get discoverable athletes and their assessment results
router.get("/athletes", async (req, res, next) => {
  try {
    const filter = { role: "athlete", discoverable: true };

    if (req.query.search) {
      const escaped = String(req.query.search).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );
      filter.name = { $regex: escaped, $options: "i" };
    }

    const athletes = await User.find(filter)
      .select("name age gender weight createdAt")
      .sort({ createdAt: -1 })
      .limit(100);

    const ids = athletes.map((athlete) => athlete._id);

    const results = await AssessmentResult.find({
      athlete: { $in: ids },
    }).sort({ date: -1 });

    const byAthlete = new Map();

    for (const result of results) {
      const key = result.athlete.toString();

      if (!byAthlete.has(key)) {
        byAthlete.set(key, []);
      }

      byAthlete.get(key).push(result);
    }

    res.json({
      athletes: athletes.map((athlete) => ({
        ...athlete.toObject(),
        results: byAthlete.get(athlete._id.toString()) || [],
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Get one discoverable athlete's profile and results
router.get("/athletes/:id", async (req, res, next) => {
  try {
    const athlete = await User.findOne({
      _id: req.params.id,
      role: "athlete",
      discoverable: true,
    }).select("name age gender weight createdAt");

    if (!athlete) {
      return res.status(404).json({
        message: "Athlete not found or profile is private",
      });
    }

    const results = await AssessmentResult.find({
      athlete: athlete._id,
    }).sort({ date: -1 });

    res.json({ athlete, results });
  } catch (error) {
    next(error);
  }
});

// Send a contact request to an athlete
router.post("/contact-requests", async (req, res, next) => {
  try {
    const { athleteId, message = "" } = req.body;

    if (!athleteId) {
      return res.status(400).json({ message: "athleteId is required" });
    }

    if (String(message).length > 500) {
      return res.status(400).json({ message: "Message is too long" });
    }

    const athlete = await User.findOne({
      _id: athleteId,
      role: "athlete",
      discoverable: true,
    });

    if (!athlete) {
      return res.status(404).json({
        message: "Athlete not found or profile is private",
      });
    }

    const request = await ContactRequest.findOneAndUpdate(
      { athlete: athlete._id, coach: req.user._id },
      {
        $set: {
          message: String(message).trim(),
          status: "pending",
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({
      message: "Contact request sent",
      request,
    });
  } catch (error) {
    next(error);
  }
});

// Get this coach's contact requests
router.get("/contact-requests", async (req, res, next) => {
  try {
    const requests = await ContactRequest.find({
      coach: req.user._id,
    })
      .populate("athlete", "name age gender")
      .sort({ createdAt: -1 });

    res.json({ requests });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
