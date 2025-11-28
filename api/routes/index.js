import express from 'express';
import authRouter from './auth.js';
import carsRouter from './cars.js';
import tracksRouter from './tracks.js';
import teamsRouter from './teams.js';
import pilotsRouter from './pilots.js';
import championsRouter from './champions.js';
import usersRouter from './users.js';
import searchRouter from './search.js';

const router = express.Router();

router.use('/auth', authRouter);
router.use('/cars', carsRouter);
router.use('/tracks', tracksRouter);
router.use('/teams', teamsRouter);
router.use('/pilots', pilotsRouter);
router.use('/champions', championsRouter);
router.use('/users', usersRouter);
router.use('/search', searchRouter);

export default router;
