const UserService = require("../services/UserService");

module.exports = {
  register: async (req, res) => {
    try {
      const result = await UserService.register(req, res);
      if (!result) {
        return res.status(400).json({
          status: false,
          data: {},
          message: "Something went wrong",
        });
      }

      return res.status(200).json({
        status: false,
        data: result,
        message: "Data fetched",
      });
    } catch (error) {
      console.log("error message:", error);
      return res.status(500).json({
        status: false,
        result: {},
        message: "Internal Server Error",
      });
    }
  },

  login: async (req, res) => {
    try {
      const result = await UserService.login(req, res);
      if (!result) {
        return res.status(400).json({
          status: false,
          data: {},
          message: "Something went wrong",
        });
      }

      return res.status(200).json({
        status: false,
        data: result,
        message: "Data fetched",
      });
    } catch (error) {
      console.log("error message:", error);
      return res.status(500).json({
        status: false,
        result: {},
        message: "Internal Server Error",
      });
    }
  },

  myProfile: async (req, res) => {
    try {
      const result = await UserService.myProfile(req, res);
      if (!result) {
        return res.status(400).json({
          status: false,
          data: {},
          message: "Something went wrong",
        });
      }

      return res.status(200).json({
        status: false,
        data: result,
        message: "Data fetched",
      });
    } catch (error) {
      console.log("error message:", error);
      return res.status(500).json({
        status: false,
        result: {},
        message: "Internal Server Error",
      });
    }
  },

  usersList: async (req, res) => {
    try {
      const result = await UserService.usersList(req, res);
      if (!result) {
        return res.status(400).json({
          status: false,
          data: {},
          message: "Something went wrong",
        });
      }

      return res.status(200).json({
        status: false,
        data: result,
        message: "Data fetched",
      });
    } catch (error) {
      console.log("error message:", error);
      return res.status(500).json({
        status: false,
        result: {},
        message: "Internal Server Error",
      });
    }
  },
};
