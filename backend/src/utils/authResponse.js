const jwt = require("jsonwebtoken");

function createToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    age: user.age,
    gender: user.gender,
    weight: user.weight,
    discoverable: user.discoverable,
    organization: user.organization,
    specialization: user.specialization,
    bio: user.bio
  };
}

module.exports = { createToken, publicUser };
