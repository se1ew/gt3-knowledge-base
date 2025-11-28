import express from 'express';
import { param, validationResult } from 'express-validator';
import db from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

function buildValidators(validators = []) {
    if (Array.isArray(validators)) {
        return validators;
    }
    return [validators];
}

export default function createCrudRouter(config) {
    const {
        table,
        route,
        fields,
        jsonFields = [],
        searchColumns = [],
        createValidators = [],
        updateValidators = [],
        defaultOrder = 'id DESC',
    } = config;

    if (!table || !Array.isArray(fields)) {
        throw new Error(`Invalid CRUD config for route ${route}`);
    }

    const router = express.Router();
    const jsonSet = new Set(jsonFields);

    function parseRow(row) {
        if (!row) return null;
        const parsed = { ...row };
        jsonSet.forEach((key) => {
            if (parsed[key] !== null && parsed[key] !== undefined && parsed[key] !== '') {
                try {
                    parsed[key] = JSON.parse(parsed[key]);
                } catch (error) {
                    // leave as-is if parsing fails
                }
            }
        });
        return parsed;
    }

    function normaliseValue([key, type], value) {
        if (value === undefined) {
            return undefined;
        }
        if (value === null || value === '') {
            return null;
        }
        if (jsonSet.has(key)) {
            return JSON.stringify(value);
        }
        switch (type) {
            case 'int':
                return Number.isNaN(Number(value)) ? null : Number.parseInt(value, 10);
            case 'float':
                return Number.isNaN(Number(value)) ? null : Number.parseFloat(value);
            default:
                return value;
        }
    }

    function pickFields(body) {
        const payload = {};
        fields.forEach(([key, type]) => {
            if (Object.prototype.hasOwnProperty.call(body, key)) {
                const normalised = normaliseValue([key, type], body[key]);
                if (normalised !== undefined) {
                    payload[key] = normalised;
                }
            }
        });
        return payload;
    }

    function handleValidation(req, res) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ message: 'Ошибка валидации', errors: errors.array() });
            return false;
        }
        return true;
    }

    router.get('/', authenticate(false), (req, res) => {
        const { q, limit, offset } = req.query;
        const params = [];
        let sql = `SELECT * FROM ${table}`;

        if (q && searchColumns.length) {
            const tokens = searchColumns.map((column) => `LOWER(${column}) LIKE ?`).join(' OR ');
            sql += ` WHERE ${tokens}`;
            const needle = `%${String(q).toLowerCase()}%`;
            searchColumns.forEach(() => params.push(needle));
        }

        sql += ` ORDER BY ${defaultOrder}`;

        const parsedLimit = limit ? Number.parseInt(limit, 10) : null;
        const parsedOffset = offset ? Number.parseInt(offset, 10) : null;

        if (parsedLimit && parsedLimit > 0) {
            sql += ' LIMIT ?';
            params.push(parsedLimit);
        }
        if (parsedOffset && parsedOffset >= 0) {
            sql += parsedLimit ? ' OFFSET ?' : ' LIMIT -1 OFFSET ?';
            params.push(parsedOffset);
        }

        const stmt = db.prepare(sql);
        const rows = stmt.all(...params).map(parseRow);
        res.json(rows);
    });

    router.get(
        '/:id',
        authenticate(false),
        [param('id').isInt().withMessage('Некорректный идентификатор')],
        (req, res) => {
            if (!handleValidation(req, res)) {
                return;
            }
            const id = Number.parseInt(req.params.id, 10);
            const stmt = db.prepare(`SELECT * FROM ${table} WHERE id = ?`);
            const row = stmt.get(id);
            if (!row) {
                res.status(404).json({ message: 'Запись не найдена' });
                return;
            }
            res.json(parseRow(row));
        },
    );

    router.post(
        '/',
        authenticate(),
        requireAdmin,
        ...buildValidators(createValidators),
        (req, res) => {
            if (!handleValidation(req, res)) {
                return;
            }

            const payload = pickFields(req.body);
            const columns = Object.keys(payload);
            if (!columns.length) {
                res.status(400).json({ message: 'Нет данных для сохранения' });
                return;
            }

            const placeholders = columns.map(() => '?').join(', ');
            const values = columns.map((key) => payload[key]);
            const insertSql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
            const info = db.prepare(insertSql).run(...values);
            const created = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(info.lastInsertRowid);
            res.status(201).json(parseRow(created));
        },
    );

    router.put(
        '/:id',
        authenticate(),
        requireAdmin,
        [param('id').isInt().withMessage('Некорректный идентификатор')],
        ...buildValidators(updateValidators),
        (req, res) => {
            if (!handleValidation(req, res)) {
                return;
            }

            const id = Number.parseInt(req.params.id, 10);
            const current = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
            if (!current) {
                res.status(404).json({ message: 'Запись не найдена' });
                return;
            }

            const payload = pickFields(req.body);
            const entries = Object.entries(payload).filter(([, value]) => value !== undefined);
            if (!entries.length) {
                res.status(400).json({ message: 'Нет данных для обновления' });
                return;
            }

            const setClause = entries.map(([key]) => `${key} = ?`).join(', ');
            const values = entries.map(([, value]) => value);
            db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`).run(...values, id);
            const updated = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
            res.json(parseRow(updated));
        },
    );

    router.delete(
        '/:id',
        authenticate(),
        requireAdmin,
        [param('id').isInt().withMessage('Некорректный идентификатор')],
        (req, res) => {
            if (!handleValidation(req, res)) {
                return;
            }
            const id = Number.parseInt(req.params.id, 10);
            const result = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
            if (!result.changes) {
                res.status(404).json({ message: 'Запись не найдена' });
                return;
            }
            res.json({ success: true });
        },
    );

    return router;
}
