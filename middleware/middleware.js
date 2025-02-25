// Middleware to check if the user is already logged in
export function isLoggedIn(req, res, next) {
    if (req.session.userId) {
        // User is already logged in, redirect to the result page
        return res.redirect("/user/result");
    }
    // User is not logged in, proceed to the next middleware/route
    next();
}
// Middleware to check if the user is authenticated
export function isAuthenticated(req, res, next) {
    if (!req.session.userId) {
        // User is not logged in, redirect to the login page
        return res.redirect("/user");
    }
    // User is authenticated, proceed to the next middleware/route
    next();
}