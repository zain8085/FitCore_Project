// middleware/auth.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

module.exports = function (req, res, next) {
    const token = req.header('x-auth-token');

    if (!token) {
        console.log("[AUTH MIDDLEWARE] No token provided."); // Debug log
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user; // This is where req.user is populated

        // ⭐ ADD THESE TWO LINES ⭐
        console.log("[AUTH MIDDLEWARE] Token decoded successfully."); // Debug log
        console.log("[AUTH MIDDLEWARE] req.user after decoding:", req.user); // Debug log: Check the full object
        // ⭐ END ADDITIONS ⭐

        next();
    } catch (err) {
        console.log("[AUTH MIDDLEWARE] Token verification failed:", err.message); // Debug log
        res.status(401).json({ message: 'Token is not valid' });
    }
};