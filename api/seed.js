import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');

function readJson(relativePath) {
    const fullPath = path.join(projectRoot, relativePath);
    if (!fs.existsSync(fullPath)) {
        return [];
    }
    const raw = fs.readFileSync(fullPath, 'utf-8');
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn(`[seed] Не удалось распарсить ${relativePath}:`, error);
        return [];
    }
}

async function seedUsers() {
    const { count } = db.prepare('SELECT COUNT(*) AS count FROM users').get();
    if (count > 0) {
        return;
    }
    const passwordHash = await bcrypt.hash('admin123', 10);
    db.prepare(
        'INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?)',
    ).run('admin@example.com', passwordHash, 'Администратор', 'admin');
}

function seedCars() {
    const { count } = db.prepare('SELECT COUNT(*) AS count FROM cars').get();
    if (count > 0) {
        return;
    }
    const cars = readJson('data/cars.json');
    const insert = db.prepare(`
        INSERT INTO cars (
            brand, model, generation, year, engine, power, torque, weight, top_speed, image_url, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((list) => {
        list.forEach((car) => {
            insert.run(
                car.brand ?? null,
                car.model ?? null,
                car.generation ?? null,
                car.year ?? null,
                car.engine ?? null,
                car.power ?? null,
                car.torque ?? null,
                car.weight ?? null,
                car.topSpeed ?? null,
                car.image ? `images/cars/${car.image}` : null,
                car.description ?? null,
            );
        });
    });

    insertMany(cars);
}

function seedTracks() {
    const { count } = db.prepare('SELECT COUNT(*) AS count FROM tracks').get();
    if (count > 0) {
        return;
    }
    const tracks = readJson('data/tracks.json');
    const insert = db.prepare(`
        INSERT INTO tracks (
            name, country, length_km, type, location, turns, established,
            image_url, card_image_url, detail_image_url, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const ensureImage = (value, type) => {
        if (!value) {
            return null;
        }
        const raw = String(value).trim();
        if (!raw) {
            return null;
        }
        if (raw.startsWith('http')) {
            return raw;
        }
        let cleaned = raw.replace(/\\/g, '/').replace(/^images\//, '').replace(/^\/+/, '');
        if (!cleaned) {
            return null;
        }
        if (cleaned.startsWith('tracks/')) {
            return `images/${cleaned}`;
        }
        if (cleaned.startsWith('layout/')) {
            cleaned = cleaned.replace(/^layout\//, '');
        } else if (cleaned.startsWith('detail/')) {
            cleaned = cleaned.replace(/^detail\//, '');
        }
        const folder = type === 'detail' ? 'tracks/detail' : 'tracks/layout';
        return `images/${folder}/${cleaned}`;
    };

    const insertMany = db.transaction((list) => {
        list.forEach((track) => {
            const cardImage = ensureImage(track.cardImage || track.card_image || track.image, 'card');
            const detailImage = ensureImage(track.detailImage || track.detail_image, 'detail') || cardImage;

            insert.run(
                track.name ?? null,
                track.country ?? null,
                track.length ?? track.length_km ?? null,
                track.type ?? null,
                track.location ?? null,
                track.turns ?? null,
                track.established ?? null,
                detailImage || cardImage || null,
                cardImage || null,
                detailImage || null,
                track.description ?? null,
            );
        });
    });

    insertMany(tracks);
}

function seedTeams() {
    const { count } = db.prepare('SELECT COUNT(*) AS count FROM teams').get();
    if (count > 0) {
        return;
    }
    const teams = readJson('data/teams.json');
    const insert = db.prepare(`
        INSERT INTO teams (
            name, country, founded, series, cars, logo, image_url, description, stats, achievements
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMany = db.transaction((list) => {
        list.forEach((team) => {
            insert.run(
                team.name ?? null,
                team.country ?? null,
                team.founded ?? null,
                team.series ? JSON.stringify(team.series) : null,
                team.cars ? JSON.stringify(team.cars) : null,
                team.logo ?? null,
                team.image_url
                    ? team.image_url.startsWith('images/')
                        ? team.image_url
                        : `images/${team.image_url}`
                    : null,
                team.description ?? null,
                team.stats ? JSON.stringify(team.stats) : null,
                team.achievements ? JSON.stringify(team.achievements) : null,
            );
        });
    });

    insertMany(teams);
}

function seedPilots() {
    const { count } = db.prepare('SELECT COUNT(*) AS count FROM pilots').get();
    if (count > 0) {
        return;
    }
    const pilots = readJson('data/pilots.json');
    const insert = db.prepare(`
        INSERT INTO pilots (
            name, nationality, flag, team, car, championships, stats, series, tags, image_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMany = db.transaction((list) => {
        list.forEach((pilot) => {
            insert.run(
                pilot.name ?? null,
                pilot.nationality ?? null,
                pilot.flag ?? null,
                pilot.team ?? null,
                pilot.car ?? null,
                pilot.championships ? JSON.stringify(pilot.championships) : null,
                pilot.stats ? JSON.stringify(pilot.stats) : null,
                pilot.series ? JSON.stringify(pilot.series) : null,
                pilot.tags ? JSON.stringify(pilot.tags) : null,
                pilot.image_url
                    ? pilot.image_url.startsWith('images/')
                        ? pilot.image_url
                        : `images/${pilot.image_url}`
                    : null,
            );
        });
    });

    insertMany(pilots);
}

function seedChampions() {
    const { count } = db.prepare('SELECT COUNT(*) AS count FROM champions').get();
    if (count > 0) {
        return;
    }
    const champions = readJson('data/champions.json');
    if (!champions.length) {
        return;
    }
    const insert = db.prepare(`
        INSERT INTO champions (
            year, series, team_name, drivers, car, image_url, stats, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((list) => {
        list.forEach((champion) => {
            insert.run(
                champion.year ?? null,
                champion.series ?? null,
                champion.team_name ?? null,
                champion.drivers ? JSON.stringify(champion.drivers) : null,
                champion.car ?? null,
                champion.image_url
                    ? champion.image_url.startsWith('images/')
                        ? champion.image_url
                        : `images/${champion.image_url}`
                    : null,
                champion.stats ? JSON.stringify(champion.stats) : null,
                champion.description ?? null,
            );
        });
    });

    insertMany(champions);
}

export default async function runSeed() {
    await seedUsers();
    seedCars();
    seedTracks();
    seedTeams();
    seedPilots();
    seedChampions();
}
