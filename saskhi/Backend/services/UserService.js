const User = require("../models/UserModel");
const bcrypt = require("bcrypt");

const { generateToken } = require("../utils/helper");

module.exports = {
  register: async (req, res) => {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) {
        return res.status(200).json({
          status: false,
          result: {},
          message: "All fields are required.",
        });
      }

      const hashPassword = bcrypt.hash(password, 10);

      await User.create({
        name,
        email,
        password: hashPassword,
      });

      return res.status(200).json({
        status: true,
        result: {},
        message: "Registered successfully",
      });
    } catch (error) {
      console.log("error message:", error);
      return res.status(400).json({
        status: true,
        result: {},
        message: error.message,
      });
    }
  },

  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(200).json({
          status: false,
          result: {},
          message: "All fields are required.",
        });
      }

      const existingUser = await User.findOne({ email });

      if (!existingUser) {
        return res.status(404).json({
          status: false,
          result: {},
          message: "User not found",
        });
      }

      const validPassword = bcrypt.compare(password, existingUser.password);

      if (!validPassword) {
        return res.status(404).json({
          status: false,
          result: {},
          message: "Invalid credentials",
        });
      }

      const userData = existingUser.toObject();
      delete userData.password;

      const accessToken = generateToken(userData);

      return res.status(200).json({
        status: true,
        result: { ...existingUser, accessToken },
        message: "Registered successfully",
      });
    } catch (error) {
      console.log("error message:", error);
      return res.status(400).json({
        status: true,
        result: {},
        message: error.message,
      });
    }
  },

  myProfile: async (req, res) => {
    try {
      const userId = req.user._id;

      const existingUser = await User.findById(userId).lean();

      if (!existingUser) {
        return res.status(400).json({
          status: false,
          result: {},
          message: "User not found",
        });
      }

      delete existingUser.password;

      return res.status(400).json({
        status: true,
        result: { ...existingUser },
        message: "User details fetched successfully",
      });
    } catch (error) {
      console.log("error message:", error);
      return res.status(400).json({
        status: true,
        result: {},
        message: error.message,
      });
    }
  },

  usersList: async (req, res) => {
    try {
      const users = await User.find({ isDelete: false }).select("name email");

      if (users.length === 0) {
        return res.status(400).json({
          status: true,
          result: {},
          message: "No users found",
        });
      }

      return res.status(400).json({
        status: true,
        result: {users},
        message: 'Users list fetched',
      });
    } catch (error) {
      console.log("error message:", error);
      return res.status(400).json({
        status: true,
        result: {},
        message: error.message,
      });
    }
  },
};
