const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const Mail = require("../model/mail");

// POST /api/mail/send
router.post("/send", async (req, res) => {
  const { to, subject, message } = req.body;

  if (!to || !subject || !message) {
    return res.status(400).json({ msg: "All fields are required" });
  }

  try {
    // Save mail in MongoDB
    const mail = new Mail({ to, subject, message });
    await mail.save();

    // Send email using nodemailer
    const transporter = nodemailer.createTransport({
      service: "gmail", // you can use any service
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text: message,
    });

    res.status(200).json({ msg: "Email sent and saved successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
