const mongoose = require("mongoose");

const CalenderDayOffSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["Day Off", "Part time", "Available"], 
      default: "Day Off",
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const CalenderDayOff = mongoose.model("calender_day_offs", CalenderDayOffSchema);
module.exports = CalenderDayOff;
