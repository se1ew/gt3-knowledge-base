import express from 'express';
import bcrypt from 'bcrypt';
import { body, param, validationResult } from 'express-validator';
import db from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

const roleValues = ['user', 'admin'];

function sanitizeUser(user) {
    if (!user) return null;
    const { password_hash: _password, ...rest } = user;
    return rest;
}

function handleValidation(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ message: 'Ошибка валидации', errors: errors.array() });
        return false;
    }
    return true;
}

router.use(authenticate());
router.use(requireAdmin);

router.get('/', (req, res) => {
    const rows = db
        .prepare('SELECT id, email, display_name, role, created_at, updated_at FROM users ORDER BY id ASC')
        .all();
    res.json(rows.map(sanitizeUser));
});

router.get(
    '/:id',
    [param('id').isInt().withMessage('Некорректный идентификатор')],
    (req, res) => {
        if (!handleValidation(req, res)) {
            return;
        }
        const id = Number.parseInt(req.params.id, 10);
        const user = db
            .prepare('SELECT id, email, display_name, role, created_at, updated_at FROM users WHERE id = ?')
            .get(id);
        if (!user) {
            res.status(404).json({ message: 'Пользователь не найден' });
            return;
        }
        res.json(sanitizeUser(user));
    },
);

router.post(
    '/',
    [
        body('email').isEmail().withMessage('Введите корректный email'),
        body('password').isLength({ min: 6 }).withMessage('Пароль должен содержать не менее 6 символов'),
        body('display_name').trim().notEmpty().withMessage('Имя не может быть пустым'),
        body('role').optional().isIn(roleValues).withMessage('Недопустимая роль'),
    ],
    async (req, res) => {
        if (!handleValidation(req, res)) {
            return;
        }
        const { email, password, display_name, role = 'user' } = req.body;
        const normalizedEmail = email.trim().toLowerCase();
        const normalizedDisplayName = display_name.trim();

        const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
        if (existingEmail) {
            res.status(409).json({ message: 'Пользователь с таким email уже существует' });
            return;
        }

        const existingDisplayName = db
            .prepare('SELECT id FROM users WHERE LOWER(display_name) = LOWER(?)')
            .get(normalizedDisplayName);
        if (existingDisplayName) {
            res.status(409).json({ message: 'Пользователь с таким именем уже существует' });
            return;
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const info = db
            .prepare('INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?)')
            .run(normalizedEmail, passwordHash, normalizedDisplayName, role);
        const created = db
            .prepare('SELECT id, email, display_name, role, created_at, updated_at FROM users WHERE id = ?')
            .get(info.lastInsertRowid);
        res.status(201).json(sanitizeUser(created));
    },
);

router.put(
    '/:id',
    [
        param('id').isInt().withMessage('Некорректный идентификатор'),
        body('email').optional().isEmail().withMessage('Введите корректный email'),
        body('display_name').optional().trim().notEmpty().withMessage('Имя не может быть пустым'),
        body('role').optional().isIn(roleValues).withMessage('Недопустимая роль'),
        body('password').optional().isLength({ min: 6 }).withMessage('Пароль должен содержать не менее 6 символов'),
    ],
    async (req, res) => {
        if (!handleValidation(req, res)) {
            return;
        }
        const id = Number.parseInt(req.params.id, 10);
        const current = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        if (!current) {
            res.status(404).json({ message: 'Пользователь не найден' });
            return;
        }

        const updates = {};
        if (req.body.email) {
            const normalized = req.body.email.trim().toLowerCase();
            if (normalized !== current.email) {
                const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(normalized, id);
                if (existing) {
                    res.status(409).json({ message: 'Пользователь с таким email уже существует' });
                    return;
                }
                updates.email = normalized;
            }
        }
        if (req.body.display_name) {
            const normalizedDisplayName = req.body.display_name.trim();
            const isChanged = normalizedDisplayName.toLowerCase() !== current.display_name.trim().toLowerCase();
            if (isChanged) {
                const existingDisplayName = db
                    .prepare('SELECT id FROM users WHERE LOWER(display_name) = LOWER(?) AND id != ?')
                    .get(normalizedDisplayName, id);
                if (existingDisplayName) {
                    res.status(409).json({ message: 'Пользователь с таким именем уже существует' });
                    return;
                }
            }
            updates.display_name = normalizedDisplayName;
        }
        if (req.body.role) {
            updates.role = req.body.role;
        }
        if (req.body.password) {
            updates.password_hash = await bcrypt.hash(req.body.password, 10);
        }

        if (!Object.keys(updates).length) {
            res.status(400).json({ message: 'Нет данных для обновления' });
            return;
        }

        const setClause = Object.keys(updates)
            .map((key) => `${key} = ?`)
            .join(', ');
        const values = Object.values(updates);
        db.prepare(`UPDATE users SET ${setClause} WHERE id = ?`).run(...values, id);
        const updated = db
            .prepare('SELECT id, email, display_name, role, created_at, updated_at FROM users WHERE id = ?')
            .get(id);
        res.json(sanitizeUser(updated));
    },
);

router.delete(
    '/:id',
    [param('id').isInt().withMessage('Некорректный идентификатор')],
    (req, res) => {
        if (!handleValidation(req, res)) {
            return;
        }
        const id = Number.parseInt(req.params.id, 10);
        if (id === req.user.sub) {
            res.status(400).json({ message: 'Нельзя удалить собственную учетную запись' });
            return;
        }
        const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
        if (!result.changes) {
            res.status(404).json({ message: 'Пользователь не найден' });
            return;
        }
        res.json({ success: true });
    },
);

export default router;
