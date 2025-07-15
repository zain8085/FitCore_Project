// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config(); // Ensure dotenv is loaded for JWT_SECRET and ADMIN_CODE

// Helper function to generate a unique 6-digit member ID
async function generateUniqueMemberId() {
    let isUnique = false;
    let newMemberId;
    while (!isUnique) {
        // Generate a random 6-digit number
        newMemberId = 'M' + Math.floor(100000 + Math.random() * 900000).toString();
        // Check if it already exists in the database
        const existingUser = await User.findOne({ memberId: newMemberId });
        if (!existingUser) {
            isUnique = true; // If not found, it's unique
        }
    }
    return newMemberId;
}

// @route   POST /api/auth/signup
// @desc    Register a new user (Member or Admin)
// @access  Public
router.post('/signup', async (req, res) => {
    try {
        // Destructure necessary fields from the request body
        const { fullName, phone, email, password, role, adminCode, address } = req.body;

        // Check if user with provided email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }

        // Validate admin code if the role is ADMIN
        if (role === 'ADMIN' && adminCode !== process.env.ADMIN_CODE) {
            return res.status(400).json({ message: 'Invalid Admin Code' });
        }

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Generate a unique member ID
        const memberId = await generateUniqueMemberId();

        // Create a new User instance
        const newUser = new User({
            fullName,
            phone,
            email,
            password: hashedPassword,
            role,
            createdAt: new Date(),
            address: address || 'Not provided',
            memberId: memberId, // Assign the generated unique ID
            membershipPlan: 'Pending Selection', // Default for new signups
            membershipStatus: 'Pending',         // Default for new signups
            membershipExpiresAt: null            // Will be set after package selection
        });

        // Save the new user to the database
        await newUser.save();

        // Prepare payload for JWT
        const payload = {
            user: {
                id: newUser.id, // Mongoose model gives an .id property for _id
                role: newUser.role
            }
        };

        // Sign the JWT token
        jwt.sign(
            payload,
            process.env.JWT_SECRET, // Use the secret key from your .env file
            { expiresIn: '1h' }, // Token valid for 1 hour
            (err, token) => {
                if (err) {
                    console.error('JWT signing error:', err);
                    return res.status(500).json({ message: 'Token generation failed' });
                }
                // Send success response with token and user details
                res.status(201).json({ // Use 201 for successful resource creation
                    message: 'Signup successful',
                    token,
                    user: { // This 'user' object is essential for the frontend
                        userId: newUser.id,
                        role: newUser.role,
                        email: newUser.email,
                        fullName: newUser.fullName,
                        memberId: newUser.memberId
                    }
                });
            }
        );

    } catch (error) {
        console.error('Signup error:', error);
        // Differentiate duplicate key errors from other server errors
        if (error.code === 11000) {
            let field = Object.keys(error.keyValue)[0];
            return res.status(400).json({ message: `A user with this ${field} already exists.` });
        }
        res.status(500).json({ message: 'Server Error during signup' });
    }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
    try {
        const { email, password, role: loginRole, adminCode } = req.body;

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid Credentials' });
        }

        // Compare provided password with hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid Credentials' });
        }

        // Check if the requested role matches the user's actual role
        if (loginRole && loginRole.toLowerCase() !== user.role.toLowerCase()) {
            return res.status(403).json({ message: `Access denied. You are logged in as a ${user.role}.` });
        }

        // Admin code check only for ADMIN role during login
        if (user.role === 'ADMIN' && adminCode !== process.env.ADMIN_CODE) {
            return res.status(400).json({ message: 'Invalid Admin Code for Admin login' });
        }

        // Update last login timestamp
        user.lastLogin = new Date();
        await user.save(); // Save the updated user document

        // Prepare payload for JWT
        const payload = {
            user: {
                id: user.id, // Mongoose model gives an .id property for _id
                role: user.role
            }
        };

        // Sign the JWT token
        jwt.sign(
            payload,
            process.env.JWT_SECRET, // Use the secret key from .env
            { expiresIn: '1h' }, // Token expires in 1 hour
            (err, token) => {
                if (err) {
                    console.error('JWT signing error:', err);
                    return res.status(500).json({ message: 'Token generation failed' });
                }
                // ⭐ CRITICAL CHANGE HERE: Send full user details 28/6/25⭐
                res.status(200).json({
                    message: 'Login successful',
                    token,
                    user: { // Nest user details under a 'user' object
                        userId: user.id, // Mongoose model gives an .id property for _id
                        role: user.role,
                        email: user.email,
                        fullName: user.fullName,
                        memberId: user.memberId
                    }
                });
            }
        );

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server Error during login' });
    }
});

module.exports = router;
