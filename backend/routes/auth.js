const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Signup Route
router.post('/signup', async (req, res) => {
    try {
        const { fullName, phone, email, password, role, adminCode } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }

        if (role === 'ADMIN' && adminCode !== 'FITCORE2025') {
            return res.status(400).json({ message: 'Invalid Admin Code' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            fullName,
            phone,
            email,
            password: hashedPassword,
            role
        });

        await newUser.save();

        res.status(201).json({ message: 'User created successfully!' });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Server Error during signup' });
    }
});

// Updated Login Route
router.post('/login', async (req, res) => {
    try {
        const { email, password, role, adminCode } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid Credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid Credentials' });
        }

        if (role === 'admin' && user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Not an admin account' });
        }

        if (role === 'admin' && adminCode !== 'FITCORE2025') {
            return res.status(400).json({ message: 'Invalid Admin Code' });
        }

        res.status(200).json({
            message: 'Login successful',
            role: user.role
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server Error during login' });
    }
});

module.exports = router;
