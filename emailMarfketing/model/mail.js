const mongoose = require("mongoose");

const MailSchema = new mongoose.Schema({
  to: { type: String, required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  sentAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Mail", MailSchema);
