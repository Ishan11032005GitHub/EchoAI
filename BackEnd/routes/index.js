import { Router } from 'express';
// import chatRoutes from './chatRoutes.js';
import { signin, signup, signout } from '../controllers/authController.js';

const router = Router();

// Auth routes
router.post('/signup', signup);
router.post('/signin', signin);
router.post('/signout', signout);

// Chat & AI routes
// router.use('/', chatRoutes);

// Root test route
router.get('/', (req, res) => {
  res.json({ message: 'API is working 🚀' });
});

export default router;
