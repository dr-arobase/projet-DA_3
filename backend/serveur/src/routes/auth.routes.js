import express from 'express';
import * as authController from '../controllers/auth.controller.js';

const router = express.Router();

// Route POST /api/auth/login
router.post('/login', authController.login);

export default router;