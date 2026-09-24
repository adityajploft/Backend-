// const User = require("../models/UserModel");
// const jwt = require("jsonwebtoken");

// modulke.exports = {
//   verifyUser: async (req, res, next) => {
//     try {
//       const bearerToken = req.headers.authorization.bearer.split(" ")[1];
//       const secretKey = process.env.SECRET_KEY || "sakshi123";
//       if (!bearerToken) {
//         return res.status(400).json({
//           status: true,
//           result: {},
//           message: "Token not found",
//         });
//       }

//       const decodedUser = jwt.verify(bearerToken, secretKey);

//       if (!decodedUser) {
//         return res.status(400).json({
//           status: true,
//           result: {},
//           message: "Token malformed",
//         });
//       }
//       req.user = decodedUser;

//       const userId = decodedUser._id;

//       const existingUser = await User.findOne({_id: userId, isDelete: false, role: 'user'})
//       if (!existingUser) {
//         return res.status(404).json({
//           status: false,
//           result: {},
//           message: 'User not found',
//         });
//       }

//       next();
//     } catch (error) {
//       console.log("error message:", error);
//       return res.status(400).json({
//         status: true,
//         result: {},
//         message: error.message,
//       });
//     }
//   },

//   verifyAdmin: async (req, res, next) => {
//     try {
//       const bearerToken = req.headers.authorization.bearer.split(" ")[1];
//       const secretKey = process.env.SECRET_KEY || "sakshi123";
//       if (!bearerToken) {
//         return res.status(400).json({
//           status: true,
//           result: {},
//           message: "Token not found",
//         });
//       }

//       const decodedUser = jwt.verify(bearerToken, secretKey);

//       if (!decodedUser) {
//         return res.status(400).json({
//           status: true,
//           result: {},
//           message: "Token malformed",
//         });
//       }
//       req.user = decodedUser;

//       const userId = decodedUser._id;

//       const existingUser = await User.findOne({_id: userId, isDelete: false, role: 'admin'})
//       if (!existingUser) {
//         return res.status(404).json({
//           status: false,
//           result: {},
//           message: 'User not found',
//         });
//       }

//       next();
//     } catch (error) {
//       console.log("error message:", error);
//       return res.status(400).json({
//         status: true,
//         result: {},
//         message: error.message,
//       });
//     }
//   }
// };


const jwt = require("jsonwebtoken");
const User = require("../models/UserModel");

module.exports = {
  verifyUser: async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader)
        return res.status(401).json({ message: "Token missing" });

      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, "sakshi123");

      const user = await User.findOne({
        _id: decoded._id,
        isDelete: false,
        role: "user",
      });

      if (!user) return res.status(401).json({ message: "User not found" });

      req.user = user;
      next();
    } catch (err) {
      res.status(401).json({ message: err.message });
    }
  },

  verifyAdmin: async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader)
        return res.status(401).json({ message: "Token missing" });

      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, "sakshi123");

      const user = await User.findOne({
        _id: decoded._id,
        isDelete: false,
        role: "admin",
      });

      if (!user) return res.status(401).json({ message: "Admin not found" });

      req.user = user;
      next();
    } catch (err) {
      res.status(401).json({ message: err.message });
    }
  },
};
