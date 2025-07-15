const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment'); // Adjust path if your Payment model is elsewhere
const auth = require('../middleware/auth'); // For authentication middleware

// @route   POST /api/payments/record-payment
// @desc    Record a new payment for a membership
// @access  Private (requires token)
router.post('/record-payment', auth, async (req, res) => {
    try {
        const { member, memberId, memberName, amount, paymentType, membershipPlan } = req.body;

        // Basic validation
        if (!member || !memberId || !memberName || !amount || !paymentType || !membershipPlan) {
            return res.status(400).json({ message: 'Missing required payment fields.' });
        }

        // Ensure the authenticated user (from token) matches the member for the payment
        if (req.user.id !== member) {
            return res.status(403).json({ message: 'Unauthorized: Cannot record payment for another user.' });
        }

        const newPayment = new Payment({
            member: member,             // This should be the MongoDB ObjectId (userId)
            memberId: memberId,         // The 6-digit custom member ID
            memberName: memberName,
            amount: amount,
            paymentType: paymentType,   // Should be 'membership' for this flow
            membershipPlan: membershipPlan,
            status: 'completed',        // Assuming payment is successful at this point
            paymentDate: new Date()
        });

        await newPayment.save();
        res.status(201).json({ message: 'Payment recorded successfully!', payment: newPayment });

    } catch (err) {
        console.error('Error recording payment:', err.message);
        res.status(500).json({ message: 'Server Error: Failed to record payment.' });
    }
});

module.exports = router;