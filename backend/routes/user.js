// routes/user.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// @route   GET /api/user/profile
// @desc    Get current authenticated user's profile
// @access  Private (requires token)
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/user/profile
// @desc    Update current authenticated user's profile
// @access  Private (requires token)
router.put('/profile', auth, async (req, res) => {
    // ⭐ IMPORTANT: Destructure 'address' along with other fields
    const { fullName, phone, email, address } = req.body; 

    // Build user object with fields to update
    const userFields = {};
    if (fullName !== undefined && fullName !== null) userFields.fullName = fullName;
    if (phone !== undefined && phone !== null) userFields.phone = phone;
    // Email is typically not updated via this profile route as it's often a unique identifier
    // We already disabled the email input in the frontend form, so we won't process it here.
    // If you need to enable email updates, you'd add:
    // if (email !== undefined && email !== null) userFields.email = email;
    // ⭐ IMPORTANT: Add address to userFields
    if (address !== undefined && address !== null) userFields.address = address;

    try {
        let user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Handle potential email/phone uniqueness if they were enabled for update
        // (Your existing checks for email and phone uniqueness are good if you allow those to change)
        if (email && email !== user.email) {
            const existingUserWithEmail = await User.findOne({ email });
            if (existingUserWithEmail) {
                return res.status(400).json({ message: 'Email already in use' });
            }
        }
        if (phone && phone !== user.phone) {
            const existingUserWithPhone = await User.findOne({ phone });
            if (existingUserWithPhone) {
                return res.status(400).json({ message: 'Phone number already in use' });
            }
        }
        
        // Find and update the user
        user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: userFields }, // Use $set to update specific fields
            { new: true, runValidators: true } // Return the updated document and run schema validators
        ).select('-password'); // Exclude password from response

        res.json({ message: 'Profile updated successfully', user });

    } catch (err) {
        console.error(err.message);
        // Mongoose validation errors
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: err.message });
        }
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/user/change-password
// @desc    Change current authenticated user's password
// @access  Private (requires token)
router.put('/change-password', auth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Please enter both current and new passwords' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ message: 'Password updated successfully' });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/user/account
// @desc    Delete current authenticated user's account
// @access  Private (requires token)
router.delete('/account', auth, async (req, res) => {
    try {
        await User.findOneAndDelete({ _id: req.user.id });
        res.json({ message: 'User account deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// ⭐ NEW ROUTE: Update User's Membership Details ⭐
// @route   PUT /api/user/update-membership
// @desc    Update current authenticated user's membership plan and status
// @access  Private (requires token)
router.put('/update-membership', auth, async (req, res) => {
    const { membershipPlan, membershipStatus } = req.body;

    // Calculate membershipExpiresAt based on the plan (example logic)
    let membershipExpiresAt = null; // Default to null
    let statusToSet = membershipStatus || 'Active'; // Default to Active if status is not provided

    if (membershipPlan === 'Basic Monthly') {
        membershipExpiresAt = new Date();
        membershipExpiresAt.setMonth(membershipExpiresAt.getMonth() + 1); // 1 month from now
        statusToSet = 'Active';
    } else if (membershipPlan === 'Standard Monthly') { // Assuming you add this option
        membershipExpiresAt = new Date();
        membershipExpiresAt.setMonth(membershipExpiresAt.getMonth() + 1);
        statusToSet = 'Active';
    } else if (membershipPlan === 'Premium Annual') {
        membershipExpiresAt = new Date();
        membershipExpiresAt.setFullYear(membershipExpiresAt.getFullYear() + 1); // 1 year from now
        statusToSet = 'Active';
    } else if (membershipPlan === 'VIP Lifetime') {
        // For lifetime, you might set it to a very distant future date or keep it null
        membershipExpiresAt = null; 
        statusToSet = 'Active';
    } else {
        // If plan is 'None' or invalid, set to Inactive/Pending
        statusToSet = 'Inactive';
        membershipExpiresAt = null;
    }

    const updateFields = {
        membershipPlan: membershipPlan || 'None', // Ensure it's a string
        membershipStatus: statusToSet,
        membershipExpiresAt: membershipExpiresAt
    };

    try {
        let user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: updateFields },
            { new: true, runValidators: true }
        ).select('-password');

        res.json({ message: 'Membership updated successfully', user });

    } catch (err) {
        console.error('Error updating membership:', err.message);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: err.message });
        }
        res.status(500).send('Server Error');
    }
});
module.exports = router;