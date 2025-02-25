import pg from "pg";
import bcrypt from "bcrypt";

const db = new pg.Client({
    host: process.env.PG_HOST,
    user: process.env.PG_USER,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
});
db.connect();

const saltRounds = 10;

// Verify local login
export async function verifyLocalLogin(loginData, req, res) {
    try {
        const result = await db.query(`SELECT * FROM users WHERE email = $1;`, [loginData.email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const isMatch = await bcrypt.compare(loginData.password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid password" });
        }

        // Check if MFA is enabled
        if (user.mfa_secret) {
            return res.status(200).json({ message: "MFA required", userId: user.id });
        } else {
            return res.status(200).json({ message: "Login successful", user });
        }
    } catch (error) {
        console.error("Error in verifyLocalLogin:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

// Register local user
export async function registerLocalUser(signupData, req, res) {
    try {
        const checkUserRegistered = await db.query(`SELECT * FROM users WHERE email = $1;`, [signupData.email]);

        if (checkUserRegistered.rows.length > 0) {
            return res.status(400).json({ message: "User already registered. Please log in." });
        }

        const hash = await bcrypt.hash(signupData.password, saltRounds);

        const result = await db.query(
            `INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *;`,
            [signupData.name, signupData.email, hash]
        );

        const user = result.rows[0];
        return res.status(200).json({ message: "User registered successfully. Please log in to enable MFA." });
    } catch (error) {
        console.error("Error in registerLocalUser:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}