import express from 'express';
import db from '../db.js';

const router = express.Router();
const DEFAULT_LIMIT = 5;

function normalizeLimit(value, fallback = DEFAULT_LIMIT) {
    const number = Number.parseInt(value, 10);
    if (Number.isNaN(number) || number <= 0) {
        return fallback;
    }
    return Math.min(number, 10);
}

function buildResponseItem({
    id,
    title,
    subtitle = '',
    href,
    type,
    icon = null,
}) {
    return {
        id,
        title,
        subtitle,
        href,
        type,
        icon,
    };
}

router.get('/', (req, res) => {
    const rawQuery = req.query.q;
    const trimmed = typeof rawQuery === 'string' ? rawQuery.trim() : '';

    if (!trimmed) {
        res.json({ cars: [], tracks: [], teams: [], champions: [], pilots: [] });
        return;
    }

    const limit = normalizeLimit(req.query.limit);
    const needle = `%${trimmed.toLowerCase()}%`;

    const cars = db
        .prepare(
            `SELECT id, brand, model, year, engine
             FROM cars
             WHERE LOWER(brand) LIKE ?
                OR LOWER(model) LIKE ?
                OR LOWER(generation) LIKE ?
                OR LOWER(engine) LIKE ?
             ORDER BY updated_at DESC
             LIMIT ?`,
        )
        .all(needle, needle, needle, needle, limit)
        .map((car) => buildResponseItem({
            id: car.id,
            title: `${car.brand || ''} ${car.model || ''}`.trim(),
            subtitle: [car.year, car.engine].filter(Boolean).join(' • '),
            href: `cars.html?search=${encodeURIComponent(`${car.brand || ''} ${car.model || ''}`.trim())}`,
            type: 'car',
        }));

    const tracks = db
        .prepare(
            `SELECT id, name, country, location, type
             FROM tracks
             WHERE LOWER(name) LIKE ?
                OR LOWER(country) LIKE ?
                OR LOWER(location) LIKE ?
                OR LOWER(type) LIKE ?
             ORDER BY name COLLATE NOCASE ASC
             LIMIT ?`,
        )
        .all(needle, needle, needle, needle, limit)
        .map((track) => buildResponseItem({
            id: track.id,
            title: track.name || 'Без названия',
            subtitle: [track.location, track.country].filter(Boolean).join(' • '),
            href: 'tracks.html',
            type: 'track',
        }));

    const teams = db
        .prepare(
            `SELECT id, name, country, series
             FROM teams
             WHERE LOWER(name) LIKE ?
                OR LOWER(country) LIKE ?
                OR LOWER(series) LIKE ?
             ORDER BY name COLLATE NOCASE ASC
             LIMIT ?`,
        )
        .all(needle, needle, needle, limit)
        .map((team) => {
            let series = team.series;
            if (typeof series === 'string') {
                try {
                    series = JSON.parse(series);
                } catch (error) {
                    // ignore parsing errors
                }
            }
            const seriesLabel = Array.isArray(series) ? series.slice(0, 3).join(', ') : '';
            return buildResponseItem({
                id: team.id,
                title: team.name || 'Без названия',
                subtitle: [team.country, seriesLabel].filter(Boolean).join(' • '),
                href: 'teams.html',
                type: 'team',
            });
        });

    const champions = db
        .prepare(
            `SELECT id, year, series, team_name
             FROM champions
             WHERE LOWER(team_name) LIKE ?
                OR LOWER(series) LIKE ?
             ORDER BY year DESC
             LIMIT ?`,
        )
        .all(needle, needle, limit)
        .map((champion) => buildResponseItem({
            id: champion.id,
            title: champion.team_name || 'Без названия',
            subtitle: [champion.year, champion.series].filter(Boolean).join(' • '),
            href: 'champions.html',
            type: 'champion',
        }));

    const pilots = db
        .prepare(
            `SELECT id, name, nationality, team
             FROM pilots
             WHERE LOWER(name) LIKE ?
                OR LOWER(nationality) LIKE ?
                OR LOWER(team) LIKE ?
             ORDER BY name COLLATE NOCASE ASC
             LIMIT ?`,
        )
        .all(needle, needle, needle, limit)
        .map((pilot) => buildResponseItem({
            id: pilot.id,
            title: pilot.name || 'Без имени',
            subtitle: [pilot.team, pilot.nationality].filter(Boolean).join(' • '),
            href: 'pilots.html',
            type: 'pilot',
        }));

    res.json({ cars, tracks, teams, champions, pilots });
});

export default router;
