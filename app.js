import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import fs from "fs";
import https from "https";
import router from "./router/router.js";

const app = express();
const port = 3000;

// Load SSL certificate and key
const options = {
    key: fs.readFileSync("localhost-key.pem"),
    cert: fs.readFileSync("localhost.pem"),
};

// Middleware
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set("view engine", "ejs");

// Session configuration
app.use(
    session({
        secret: "c55b9d0a7264cba22b49d64d8b081e240a7c4d9e28e6885fd58e5ebba3700c3d",
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: true, // Set to true for HTTPS
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24, // 1 day
            sameSite: "strict", // Prevent cross-site request forgery (CSRF)
        },
    })
);

// Routes
app.use("/user", router);

// Define routes and middleware
app.get("/", (req, res) => {
    res.send("Hello, Https!");
});

// Create HTTPS server
const server = https.createServer(options, app);

// Start the HTTPS server
server.listen(port, () => {
    console.log(`Server is listening at https://localhost:${port}`);
});