import jwt from 'jsonwebtoken';

function authenticate(req, res, next) {
    // Check for token in cookies first, then in authorization header
    const token = req.cookies?.jwt || req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            // Clear invalid token cookie
            res.clearCookie('jwt');
            return res.status(403).json({ error: 'Invalid or expired token.' });
        }

        req.user = user;
        next();
    });
}

export default authenticate;