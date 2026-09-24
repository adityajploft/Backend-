const dotenv = require('dotenv');
dotenv.config();
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async (options) => {
  const message = {
    from: process.env.EMAIL_FROM,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.message,
  };
  try {
    await sgMail.send(message);
    return null; // No error
  } catch (err) {
    console.log('SendGrid error ===>', err?.response?.body?.errors);
    return err?.response?.body?.errors || [{ message: 'Unknown email error' }];
  }
};

module.exports = sendEmail;
