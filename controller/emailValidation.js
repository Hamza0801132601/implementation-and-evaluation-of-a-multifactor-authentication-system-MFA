/*
import axios from "axios";

const ZEROBOUNCE_API_KEY = "04123a14ff9a46e1ae191c8e05554986"; // Replace with your ZeroBounce API key

export const validateEmail = async (email) => {
    try {
        const response = await axios.get(`https://api.zerobounce.net/v2/validate`, {
            params: {
                api_key: ZEROBOUNCE_API_KEY,
                email: email,
            },
        });

        const { status } = response.data;

        // Check if the email is valid and exists
        if (status === "valid") {
            return true; // Email is valid and exists
        } else {
            return false; // Email is invalid or does not exist
        }
    } catch (error) {
        console.error("Error validating email:", error);
        return false; // Assume email is invalid if there's an error
    }
};
*/