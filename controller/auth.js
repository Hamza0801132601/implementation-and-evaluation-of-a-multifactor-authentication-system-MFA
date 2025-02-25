import pg from "pg";
import bcrypt from "bcrypt";
import { sendOTPEmail } from "./email.js";
/*import { validateEmail } from "./emailValidation.js";*/
import otpGenerator from "otp-generator";
import crypto from "crypto";

// Database configuration
const db = new pg.Client({
    host: process.env.PG_HOST,
    user: process.env.PG_USER,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
});

// Connect to the database
db.connect((err) => {
    if (err) {
        console.error("Database connection error:", err);
    } else {
        console.log("Connected to the database");
    }
});

// Create the users table if it doesn't exist
const createTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(100) NOT NULL,
        otp VARCHAR(6),
        otp_expiry TIMESTAMP,
        failed_otp_attempts INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;

db.query(createTableQuery, (err, result) => {
    if (err) {
        console.error("Error creating table:", err);
    } else {
        console.log("Table 'users' created or already exists");
    }
});

const saltRounds = 10;

// Login function
export async function loginUser(req, res) {
    const loginData = {
        email: req.body.email,
        password: req.body.password,
    };

    console.log("Login Data:", loginData);

    // Validate email format (optional, if you still want basic format validation)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(loginData.email)) {
        return res.status(400).json({ message: "Invalid email format" });
    }

    // Comment out or remove the email validation logic
    /*
    const isEmailValid = await validateEmail(loginData.email);
    if (!isEmailValid) {
        return res.status(400).json({ message: "Email does not exist or is invalid" });
    }
    */

    try {
        // Check if the user exists in the database
        const result = await db.query(`SELECT * FROM users WHERE email = $1;`, [loginData.email]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = result.rows[0];

        // Verify the password
        const isMatch = await bcrypt.compare(loginData.password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid password" });
        }

        // Generate a 6-digit OTP
        const otp = otpGenerator.generate(6, { digits: true, alphabets: false, upperCase: false, specialChars: false });
        console.log("Generated OTP:", otp);

        // Set OTP expiry time (5 minutes from now)
        const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
        console.log("OTP Expiry:", otpExpiry);

        // Store the OTP and its expiry time in the database
        await db.query(`UPDATE users SET otp = $1, otp_expiry = $2 WHERE id = $3;`, [otp, otpExpiry, user.id]);

        // Send the OTP to the user's email
        console.log("Sending OTP to:", user.email);
        await sendOTPEmail(user.email, otp);

        // Respond with a message indicating that OTP has been sent
        return res.status(200).json({ message: "OTP sent to your email. Please verify.", userId: user.id });
    } catch (error) {
        console.error("Error in loginUser:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}
// Signup function
export async function signupUser(req, res) {
    const signupData = {
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
    };

    try {
        // Check if the user already exists
        const checkUserRegistered = await db.query(`SELECT * FROM users WHERE email = $1;`, [signupData.email]);

        if (checkUserRegistered.rows.length > 0) {
            return res.status(400).json({ message: "User already registered. Please log in." });
        }

        // Hash the password
        const hash = await bcrypt.hash(signupData.password, saltRounds);

        // Insert the new user into the database
        const result = await db.query(
            `INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *;`,
            [signupData.name, signupData.email, hash]
        );

        const user = result.rows[0];

        // Respond with success
        return res.redirect(`/user/signup-success?message=User registered successfully. Please log in to enable MFA.`);
    } catch (error) {
        console.error("Error in signupUser:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

// Verify OTP function
export async function verifyOTP(req, res) {
    const { userId, otp } = req.body;

    try {
        // Retrieve the user's OTP, OTP expiry, and failed attempts from the database
        const result = await db.query(
            `SELECT otp, otp_expiry, failed_otp_attempts FROM users WHERE id = $1;`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = result.rows[0];

        // Check if the user is locked out due to too many failed attempts
        if (user.failed_otp_attempts >= 3) {
            return res.status(403).json({ message: "Account locked. Too many failed OTP attempts. Please contact support." });
        }

        // Check if the OTP matches and is not expired
        if (user.otp === otp && new Date(user.otp_expiry) > new Date()) {
            // Invalidate the OTP by clearing it from the database
            await db.query(
                `UPDATE users SET otp = NULL, otp_expiry = NULL, failed_otp_attempts = 0 WHERE id = $1;`,
                [userId]
            );

            // Regenerate the session ID to prevent session fixation
            req.session.regenerate((err) => {
                if (err) {
                    console.error("Error regenerating session:", err);
                    return res.status(500).json({ message: "Internal Server Error" });
                }

                // Store the user ID in the session
                req.session.userId = userId;

                // OTP is valid, log the user in
                return res.status(200).json({ message: "OTP verified successfully." });
            });
        } else {
            // Increment failed attempts counter
            await db.query(
                `UPDATE users SET failed_otp_attempts = failed_otp_attempts + 1 WHERE id = $1;`,
                [userId]
            );

            // Check if the user should be locked out after this attempt
            const updatedUser = await db.query(
                `SELECT failed_otp_attempts FROM users WHERE id = $1;`,
                [userId]
            );

            if (updatedUser.rows[0].failed_otp_attempts >= 3) {
                return res.status(403).json({ message: "Account locked. Too many failed OTP attempts. Please contact support." });
            }

            // OTP is invalid or expired
            return res.status(401).json({ message: "Invalid or expired OTP. Attempts remaining: " + (3 - updatedUser.rows[0].failed_otp_attempts) });
        }
    } catch (error) {
        console.error("Error in verifyOTP:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}
// Resend OTP function
export async function resendOTP(req, res) {
    const { userId } = req.body;

    try {
        // Retrieve the user's email from the database
        const result = await db.query(`SELECT email FROM users WHERE id = $1;`, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = result.rows[0];

        // Generate a new 6-digit OTP
        const otp = otpGenerator.generate(6, { digits: true, alphabets: false, upperCase: false, specialChars: false });
        console.log("New OTP Generated:", otp);

        // Set OTP expiry time (5 minutes from now)
        const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
        console.log("New OTP Expiry:", otpExpiry);

        // Store the new OTP and its expiry time in the database (invalidates the old OTP)
        await db.query(`UPDATE users SET otp = $1, otp_expiry = $2 WHERE id = $3;`, [otp, otpExpiry, userId]);

        // Send the new OTP to the user's email
        console.log("Sending new OTP to:", user.email);
        await sendOTPEmail(user.email, otp);

        // Respond with a success message
        return res.status(200).json({ message: "New OTP sent to your email." });
    } catch (error) {
        console.error("Error in resendOTP:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}
// Function to generate a reset token
function generateResetToken() {
    return crypto.randomBytes(32).toString("hex");
}

// Function to send a password reset email
export const sendPasswordResetEmail = async (email, resetToken) => {
    const resetLink = `https://localhost:3000/user/reset-password?token=${resetToken}`;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Password Reset Request",
        text: `Click the link below to reset your password:\n${resetLink}`,
        html: `<p>Click the link below to reset your password:</p><a href="${resetLink}">Reset Password</a>`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Password reset email sent to: ${email}`);
    } catch (error) {
        console.error("Error sending password reset email:", error);
    }
};

// Function to handle forgot password request
export async function forgotPassword(req, res) {
    const { email } = req.body;

    try {
        // Check if the user exists
        const result = await db.query(`SELECT * FROM users WHERE email = $1;`, [email]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = result.rows[0];

        // Generate a reset token
        const resetToken = generateResetToken();
        const resetExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

        // Store the reset token and expiry in the database
        await db.query(
            `UPDATE users SET password_reset_token = $1, password_reset_expiry = $2 WHERE id = $3;`,
            [resetToken, resetExpiry, user.id]
        );

        // Send the reset email
        await sendPasswordResetEmail(user.email, resetToken);

        return res.status(200).json({ message: "Password reset email sent." });
    } catch (error) {
        console.error("Error in forgotPassword:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

// Function to handle password reset
export async function resetPassword(req, res) {
    const { token, newPassword } = req.body;

    try {
        // Find the user with the matching reset token
        const result = await db.query(
            `SELECT * FROM users WHERE password_reset_token = $1 AND password_reset_expiry > NOW();`,
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ message: "Invalid or expired token" });
        }

        const user = result.rows[0];

        // Hash the new password
        const hash = await bcrypt.hash(newPassword, saltRounds);

        // Update the user's password and clear the reset token
        await db.query(
            `UPDATE users SET password = $1, password_reset_token = NULL, password_reset_expiry = NULL WHERE id = $2;`,
            [hash, user.id]
        );

        return res.status(200).json({ message: "Password reset successful." });
    } catch (error) {
        console.error("Error in resetPassword:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}