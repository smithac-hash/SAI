const express = require("express");
const mongoose = require("mongoose");
const Message = require("../models/Message");
const ContactRequest = require("../models/ContactRequest");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);

async function hasAcceptedConnection(userA, userB) {
  return ContactRequest.exists({
    status: "accepted",
    $or: [
      { coach: userA, athlete: userB },
      { coach: userB, athlete: userA }
    ]
  });
}

// List accepted connections and the most recent message in each conversation.
router.get("/conversations", async (req, res, next) => {
  try {
    const connections = await ContactRequest.find({
      status: "accepted",
      $or: [{ coach: req.user._id }, { athlete: req.user._id }]
    })
      .populate("coach", "name email role")
      .populate("athlete", "name email role")
      .sort({ updatedAt: -1 });

    const conversations = await Promise.all(
      connections.map(async (connection) => {
        const coach = connection.coach;
        const athlete = connection.athlete;
        if (!coach || !athlete) return null;

        const otherUser =
          String(coach._id) === String(req.user._id) ? athlete : coach;

        const lastMessage = await Message.findOne({
          $or: [
            { sender: req.user._id, receiver: otherUser._id },
            { sender: otherUser._id, receiver: req.user._id }
          ]
        }).sort({ createdAt: -1 });

        return {
          user: {
            _id: otherUser._id,
            name: otherUser.name,
            email: otherUser.email,
            role: otherUser.role
          },
          lastMessage,
          updatedAt: lastMessage?.createdAt || connection.updatedAt
        };
      })
    );

    res.json({
      conversations: conversations
        .filter(Boolean)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    });
  } catch (error) {
    next(error);
  }
});

// Retrieve the conversation with one accepted connection.
router.get("/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const connected = await hasAcceptedConnection(req.user._id, userId);
    if (!connected) {
      return res.status(403).json({
        message: "Messaging is available only after the connection is accepted."
      });
    }

    const otherUser = await User.findById(userId).select("name email role");
    if (!otherUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: userId },
        { sender: userId, receiver: req.user._id }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("sender", "name role")
      .populate("receiver", "name role");

    res.json({
      user: otherUser,
      messages: messages.reverse()
    });
  } catch (error) {
    next(error);
  }
});

// Send a message to an accepted connection.
router.post("/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;
    const text = typeof req.body.text === "string" ? req.body.text.trim() : "";

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (!text) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    if (text.length > 2000) {
      return res.status(400).json({ message: "Message cannot exceed 2000 characters" });
    }

    const connected = await hasAcceptedConnection(req.user._id, userId);
    if (!connected) {
      return res.status(403).json({
        message: "You can message this user only after the connection is accepted."
      });
    }

    const receiver = await User.findById(userId).select("_id");
    if (!receiver) {
      return res.status(404).json({ message: "User not found" });
    }

    const message = await Message.create({
      sender: req.user._id,
      receiver: userId,
      text
    });

    await message.populate("sender", "name role");
    await message.populate("receiver", "name role");

    res.status(201).json({ message });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
