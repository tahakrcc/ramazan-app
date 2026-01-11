const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer')) {
        return res.status(401).json({ error: 'Token bulunamadı. Yetkisiz erişim.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check role (Privilege Escalation Protection)
        if (decoded.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Yetkisiz erişim.' });
        }

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Geçersiz token. Giriş yapın.' });
    }
};

module.exports = { protect };
