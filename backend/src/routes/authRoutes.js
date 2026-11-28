const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { createToken, publicUser } = require("../utils/authResponse");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.post("/register", async (req, res, next) => {
  try {
    const {
      name, email, password, role,
      age, gender, weight,
      organization, specialization, bio
    } = req.body;

    if (!name?.trim() || !email?.trim() || !password || !role) {
      return res.status(400).json({ message: "Name, email, password and role are required" });
    }
    if (!["athlete", "coach"].includes(role)) {
      return res.status(400).json({ message: "Role must be athlete or coach" });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: "Password must contain at least 8 characters" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }

    if (role === "athlete") {
      const ageNumber = Number(age);
      const weightNumber = Number(weight);
      if (!Number.isInteger(ageNumber) || ageNumber < 5 || ageNumber > 100) {
        return res.status(400).json({ message: "Athlete age must be between 5 and 100" });
      }
      if (!Number.isFinite(weightNumber) || weightNumber < 10 || weightNumber > 300) {
        return res.status(400).json({ message: "Athlete weight must be between 10 and 300 kg" });
      }
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(409).json({ message: "An account with this email already exists" });

    const passwordHash = await bcrypt.hash(password, 12);
    const userData = {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role
    };

    if (role === "athlete") {
      userData.age = Number(age);
      userData.gender = String(gender || "").trim();
      userData.weight = Number(weight);
      userData.discoverable = false;
    } else {
      userData.organization = String(organization || "").trim();
      userData.specialization = String(specialization || "").trim();
      userData.bio = String(bio || "").trim();
    }

    const user = await User.create(userData);
    res.status(201).json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password, role } = req.body;
    if (!email?.trim() || !password || !role) {
      return res.status(400).json({ message: "Email, password and role are required" });
    }
    if (!["athlete", "coach"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase(), role }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid email, password or account type" });
    }

    res.json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.get("/me", protect, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = router;
