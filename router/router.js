import express from "express";
import rateLimit from "express-rate-limit";
const router = express.Router();

import { loginUser, signupUser, verifyOTP, resendOTP, forgotPassword, resetPassword } from "../controller/auth.js";


// Home route
router.get("/", (req, res) => {
    const message = req.query.message;
    res.render("home.ejs", { title: "Login", message });
});

// Login route
router.post("/", loginUser);

// Signup route
router.get("/signup", (req, res) => {
    res.render("signup.ejs", { title: "Sign Up" });
});

// Signup form submission
router.post("/signup", signupUser);

// Signup success route
router.get("/signup-success", (req, res) => {
    const message = req.query.message || "Registration successful!";
    res.render("signup-success.ejs", { title: "Signup Success", message });
});

// Result route
router.get("/result", (req, res) => {
    const message = req.query.message || "Login Successful!";
    res.render("result.ejs", { title: "Result", message });
});

// OTP verification page
router.get("/verify-otp", (req, res) => {
    const userId = req.query.userId;
    res.render("verify-otp.ejs", { title: "Verify OTP", userId });
});

// Rate limiting for OTP verification (5 attempts per 15 minutes)
const otpRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 OTP verification attempts per windowMs
    message: "Too many OTP verification attempts. Please try again later.",
});

// OTP verification route
router.post("/verify-otp", otpRateLimiter, verifyOTP);

// Resend OTP route
router.post("/resend-otp", resendOTP);

// Forgot Password Page
router.get("/forgot-password", (req, res) => {
    res.render("forgot-password.ejs", { title: "Forgot Password" });
});

// Forgot Password Form Submission
router.post("/forgot-password", forgotPassword);

// Reset Password Page
router.get("/reset-password", (req, res) => {
    const token = req.query.token;
    res.render("reset-password.ejs", { title: "Reset Password", token });
});

// Reset Password Form Submission
router.post("/reset-password", resetPassword);

// Logout route
router.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error destroying session:", err);
            return res.status(500).json({ message: "Internal Server Error" });
        }
        res.redirect("/user"); // Redirect to the login page
    });
});

export default router;