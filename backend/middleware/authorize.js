// middleware/authorize.js
module.exports = (roles = []) => {
    if (typeof roles === 'string') {
        roles = [roles];
    }

    return (req, res, next) => {
        // ⭐ ADD THESE TWO LINES ⭐
        console.log("[AUTHORIZE MIDDLEWARE] Expected roles:", roles); // Debug log: What roles are expected for this route
        console.log("[AUTHORIZE MIDDLEWARE] User role from req.user:", req.user ? req.user.role : "req.user or req.user.role is undefined/null"); // Debug log: What role is actually present
        // ⭐ END ADDITIONS ⭐

        if (!req.user || !req.user.role) {
            console.log("[AUTHORIZE MIDDLEWARE] req.user or req.user.role missing, returning 401."); // Debug log
            return res.status(401).json({ message: 'No authorization token found or user role not defined.' });
        }

        if (roles.length && !roles.includes(req.user.role)) {
            console.log(`[AUTHORIZE MIDDLEWARE] Role '${req.user.role}' not in allowed roles [${roles.join(', ')}], returning 403.`); // Debug log
            return res.status(403).json({ message: 'Access denied: You do not have the required permissions.' });
        }

        console.log("[AUTHORIZE MIDDLEWARE] User authorized. Proceeding."); // Debug log
        next();
    };
};