const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Use secure cross-origin cookie settings whenever deployed to Railway (any environment name)
router.post('/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;
    if (!email || !name || !password)
      return res.status(400).json({ error: 'All fields required' });
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(409).json({ error: 'Email already in use' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email: normalizedEmail, name, password: hashed },
      select: { id: true, email: true, name: true, role: true, mustChangePassword: true },
    });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user, token });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, mustChangePassword: user.mustChangePassword }, token });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.get('/me', require('../middleware/auth').authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true, name: true, role: true },
  });
  res.json(user);
});

router.patch('/change-password', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Both current and new password are required' });
    if (newPassword.length < 6)
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hashed, mustChangePassword: false } });
    res.json({ success: true });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.post('/reset-password/:token', async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: req.params.token },
    });
    if (!resetToken || resetToken.used || new Date() > resetToken.expiresAt)
      return res.status(400).json({ error: 'This reset link is invalid or has expired' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashed },
    });
    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    });
    res.json({ success: true });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
