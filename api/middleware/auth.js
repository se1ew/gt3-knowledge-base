import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';

export function authenticate(required = true) {
    return (req, res, next) => {
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            if (required) {
                return res.status(401).json({ message: 'Требуется авторизация' });
            }
            return next();
        }

        const [scheme, token] = authHeader.split(' ');
        if (scheme !== 'Bearer' || !token) {
            if (required) {
                return res.status(401).json({ message: 'Некорректный заголовок авторизации' });
            }
            return next();
        }

        try {
            const payload = jwt.verify(token, JWT_SECRET);
            req.user = payload;
            next();
        } catch (error) {
            if (required) {
                return res.status(401).json({ message: 'Недействительный или просроченный токен' });
            }
            next();
        }
    };
}

export function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Доступ разрешён только администраторам' });
    }
    next();
}
