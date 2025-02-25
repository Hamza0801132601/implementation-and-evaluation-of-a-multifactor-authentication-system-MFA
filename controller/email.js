import nodemailer from "nodemailer";

// Create a transporter for sending emails
const transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com", // Gmail's SMTP server
    port: 465, // Port for SSL
    secure: true, // Use SSL/TLS
    auth: {
        user: process.env.EMAIL_USER, // Your Gmail address
        pass: process.env.EMAIL_PASS, // App-specific password
    },
});

// Function to send an OTP email
export const sendOTPEmail = async (email, otp) => {
    const startTime = Date.now(); // Record the start time

    const mailOptions = {
        from: process.env.EMAIL_USER, // Sender address
        to: email, // Recipient address
        subject: "Your OTP for Login", // Email subject
        text: `Your OTP is: ${otp}. It will expire in 5 minutes.`, // Plain text body (full OTP)
        html: `<p>Your OTP is: <strong>${otp}</strong>. It will expire in 5 minutes.</p>`, // HTML body (full OTP)
    };

    console.log("Attempting to send OTP email to:", email);

    try {
        await transporter.sendMail(mailOptions);
        const endTime = Date.now(); // Record the end time
        const deliveryTime = (endTime - startTime) / 1000; // Calculate delivery time in seconds
        console.log(`OTP email sent successfully to: ${email}. Delivery time: ${deliveryTime} seconds.`);
    } catch (error) {
        console.error("Error sending OTP email to:", email, "Error:", error);
    }
};