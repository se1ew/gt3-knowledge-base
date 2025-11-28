import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import db from '../db.js';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

const registerValidators = [
    body('email').isEmail().withMessage('Введите корректный email'),
    body('password').isLength({ min: 6 }).withMessage('Пароль должен содержать не менее 6 символов'),
    body('display_name').trim().notEmpty().withMessage('Имя не может быть пустым'),
];

const loginValidators = [
    body('email').isEmail().withMessage('Введите корректный email'),
    body('password').notEmpty().withMessage('Введите пароль'),
];

function handleValidation(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ message: 'Ошибка валидации', errors: errors.array() });
        return false;
    }
    return true;
}

router.post('/register', registerValidators, async (req, res) => {
    if (!handleValidation(req, res)) {
        return;
    }

    const { email, password, display_name } = req.body;
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedDisplayName = display_name.trim();

    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existingEmail) {
        res.status(409).json({ message: 'Пользователь с таким email уже существует' });
        return;
    }

    const existingDisplayName = db
        .prepare('SELECT id FROM users WHERE LOWER(display_name) = LOWER(?)')
        .get(trimmedDisplayName);
    if (existingDisplayName) {
        res.status(409).json({ message: 'Пользователь с таким именем уже существует' });
        return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const insert = db.prepare(
        'INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?)',
    );
    const info = insert.run(normalizedEmail, passwordHash, trimmedDisplayName, 'user');

    res.status(201).json({
        id: info.lastInsertRowid,
        email: normalizedEmail,
        display_name: trimmedDisplayName,
        role: 'user',
    });
});

router.post('/login', loginValidators, async (req, res) => {
    if (!handleValidation(req, res)) {
        return;
    }

    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (!user) {
        res.status(401).json({ message: 'Неверный email или пароль' });
        return;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
        res.status(401).json({ message: 'Неверный email или пароль' });
        return;
    }

    const token = jwt.sign(
        {
            sub: user.id,
            role: user.role,
            display_name: user.display_name,
            email: user.email,
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN },
    );

    res.json({
        token,
        user: {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            role: user.role,
        },
    });
});

router.get('/profile', authenticate(), (req, res) => {
    const user = db.prepare('SELECT id, email, display_name, role, created_at, updated_at FROM users WHERE id = ?').get(
        req.user.sub,
    );
    if (!user) {
        res.status(404).json({ message: 'Пользователь не найден' });
        return;
    }
    res.json(user);
});

export default router;
