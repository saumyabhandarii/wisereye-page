// index.js
import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();
const app = express();

const allowedOrigins = ['http://localhost:5500', 'http://127.0.0.1:5500'];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`❌ Not allowed by CORS: ${origin}`));
    }
  }
}));

app.use(express.json());

// ✅ Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB connection error:', err.message));

// ✅ User Schema
const userSchema = new mongoose.Schema({
  fname: { type: String, required: true },
  lname: { type: String, required: true },
  email: { type: String, required: true },
  tenant: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

// ✅ OTP Store with timestamp
const OTP_STORE = {}; // { email: { otp, timestamp } }

// ✅ Send OTP
app.post('/send-otp', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000);
  const timestamp = Date.now(); // ⏱️ Save timestamp

  OTP_STORE[email] = { otp, timestamp };

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: `"WiseEye OTP" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your OTP Code',
    text: `Your OTP for WiseEye is: ${otp}. It is valid for 10 minutes.`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 OTP sent to ${email}: ${otp}`);
    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (err) {
    console.error('❌ Failed to send email:', err.message);
    res.status(500).json({ success: false, message: 'Failed to send OTP email' });
  }
});

// ✅ Verify OTP and Register User
app.post('/verify-otp', async (req, res) => {
  const { email, otp, fname, lname, tenant } = req.body;

  if (!email || !otp || !fname || !lname || !tenant) {
    return res.status(400).json({ verified: false, message: 'All fields are required' });
  }

  const entry = OTP_STORE[email];
  if (!entry || entry.otp != otp) {
    return res.status(400).json({ verified: false, message: 'Invalid OTP' });
  }

  const now = Date.now();
  const otpAgeMinutes = (now - entry.timestamp) / (1000 * 60);
  if (otpAgeMinutes > 10) {
    delete OTP_STORE[email];
    return res.status(400).json({ verified: false, message: 'OTP expired. Please request a new one.' });
  }

  try {
    await User.create({ fname, lname, email, tenant });
    delete OTP_STORE[email];
    console.log(`✅ Registered user: ${email}`);
    res.json({ verified: true, message: 'User verified and registered' });
  } catch (err) {
    console.error('❌ Error saving user:', err.message);
    res.status(500).json({ verified: false, message: 'Server error while saving user' });
  }
});

// ✅ Test Route
app.get('/', (req, res) => {
  res.send('🔐 WiseEye OTP API is running');
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
