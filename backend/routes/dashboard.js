// backend/routes/dashboard.js
const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Assuming User model is needed for some stats or joins
const Payment = require('../models/Payment'); // Make sure this path is correct relative to dashboard.js
const auth = require('../middleware/auth'); // Make sure this path is correct relative to dashboard.js
const authorize = require('../middleware/authorize'); // Make sure this path is correct relative to dashboard.js

// Helper function to calculate date ranges for queries
const getDateRange = (timeframe) => {
    const endDate = new Date();
    const startDate = new Date();

    switch (timeframe) {
        case '30days':
        case 'Last 30 Days':
            startDate.setDate(endDate.getDate() - 30);
            break;
        case '90days':
        case 'Last 90 Days':
            startDate.setDate(endDate.getDate() - 90);
            break;
        case '1year':
        case 'Last 1 Year':
            startDate.setFullYear(endDate.getFullYear() - 1);
            break;
        case 'all':
        case 'All Time':
        default:
            return { startDate: new Date(0), endDate }; // Start from epoch for "All Time"
    }
    startDate.setHours(0, 0, 0, 0); // Set start date to beginning of the day
    endDate.setHours(23, 59, 59, 999); // Set end date to end of the day
    return { startDate, endDate };
};

// @route   GET /api/dashboard/stats
// @desc    Get general gym statistics (members, expiring memberships, AND monthly revenue)
// @access  Private (Admin only)
router.get('/stats', auth, authorize(['ADMIN']), async (req, res) => {
    try {
        console.log("\n--- Dashboard Stats API Hit ---");
        console.log("User attempting to access dashboard stats:", req.user); // Log the user from the token

        // Total Members
        const totalMembers = await User.countDocuments({ role: 'MEMBER' });

        // New Members (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const newMembers = await User.countDocuments({
            role: 'MEMBER',
            createdAt: { $gte: thirtyDaysAgo }
        });

        // Monthly Revenue (current month)
        const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        currentMonthStart.setHours(0, 0, 0, 0); // Start of current month
        const currentMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
        currentMonthEnd.setHours(23, 59, 59, 999); // End of current month
        console.log('Monthly Revenue Query Date Range:', currentMonthStart.toISOString(), 'to', currentMonthEnd.toISOString());


        const monthlyRevenueResult = await Payment.aggregate([
            { $match: {
                status: 'completed',
                paymentDate: { $gte: currentMonthStart, $lte: currentMonthEnd }
            }},
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        console.log('DB Query Result: monthlyRevenueResult (aggregation):', monthlyRevenueResult);
        const monthlyRevenue = monthlyRevenueResult.length > 0 ? monthlyRevenueResult[0].total : 0;
        console.log('Calculated monthlyRevenue:', monthlyRevenue);

        // Expiring Memberships (next 30 days) - This requires a 'membershipEndDate' field in your User model
        // Assuming your User model has a `membershipEndDate` field
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);

        const expiringMemberships = await User.countDocuments({
            role: 'MEMBER',
            membershipEndDate: { $gte: today, $lte: thirtyDaysFromNow }
        });

        res.json({
            totalMembers,
            newMembers,
            monthlyRevenue: monthlyRevenue.toFixed(2),
            expiringMemberships
        });
        console.log("--- Dashboard Stats API Response Sent ---");

    } catch (error) {
        console.error('Dashboard general stats error:', error);
        res.status(500).json({ message: 'Server Error: Could not fetch dashboard statistics.' });
    }
});


// @route   GET /api/dashboard/billing/summary
// @desc    Get billing summary statistics (Total Revenue, Pending Payments, Recent Transactions, Failed Payments)
// @access  Private (Admin only)
router.get('/billing/summary', auth, authorize(['ADMIN']), async (req, res) => {
    try {
        console.log("\n--- Billing Summary API Hit ---");

        // Total Revenue (sum of all completed payments)
        const totalRevenueResult = await Payment.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalRevenue = totalRevenueResult.length > 0 ? totalRevenueResult[0].total : 0;

        // Pending Payments (sum of all pending payments)
        const pendingPaymentsResult = await Payment.aggregate([
            { $match: { status: 'pending' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const pendingPayments = pendingPaymentsResult.length > 0 ? pendingPaymentsResult[0].total : 0;

        // Recent Transactions Count (completed payments in last 30 days)
        const { startDate: thirtyDaysAgo, endDate: today } = getDateRange('30days');
        const recentTransactionsCount = await Payment.countDocuments({
            status: 'completed',
            paymentDate: { $gte: thirtyDaysAgo, $lte: today }
        });

        // Failed Payments Count
        const failedPaymentsCount = await Payment.countDocuments({ status: 'failed' });

        res.json({
            totalRevenue: { value: totalRevenue, change: 0 }, // Change is placeholder for now
            pendingPayments: { value: pendingPayments, change: 0 },
            recentTransactions: { value: recentTransactionsCount, change: 0 },
            failedPayments: { value: failedPaymentsCount, change: 0 }
        });
        console.log("--- Billing Summary API Response Sent ---");

    } catch (error) {
        console.error('Billing summary error:', error);
        res.status(500).json({ message: 'Server Error: Could not fetch billing summary.' });
    }
});

// @route   GET /api/dashboard/billing/revenue-overview
// @desc    Get data for revenue overview chart by timeframe
// @access  Private (Admin only)
router.get('/billing/revenue-overview', auth, authorize(['ADMIN']), async (req, res) => {
    try {
        console.log("\n--- Revenue Overview API Hit ---");
        const { timeframe } = req.query;
        const { startDate, endDate } = getDateRange(timeframe || '30days'); // Default to 30 days

        let groupByFormat;
        let sortKey;

        switch (timeframe) {
            case '90days':
            case '30days':
                groupByFormat = { $dateToString: { format: "%Y-%m-%d", date: "$paymentDate" } };
                sortKey = "_id"; // Sort by date string
                break;
            case '1year':
                groupByFormat = { $dateToString: { format: "%Y-%m", date: "$paymentDate" } };
                sortKey = "_id"; // Sort by month string
                break;
            case 'all':
            default:
                groupByFormat = { $dateToString: { format: "%Y", date: "$paymentDate" } };
                sortKey = "_id"; // Sort by year string
                break;
        }

        const revenueData = await Payment.aggregate([
            { $match: {
                status: 'completed',
                paymentDate: { $gte: startDate, $lte: endDate }
            }},
            { $group: {
                _id: groupByFormat,
                totalRevenue: { $sum: '$amount' }
            }},
            { $sort: { [sortKey]: 1 } } // Sort by the grouped date/month/year
        ]);

        // Format data for ECharts
        const labels = revenueData.map(item => item._id);
        const seriesData = revenueData.map(item => item.totalRevenue.toFixed(2));

        res.json({ labels, seriesData });
        console.log("--- Revenue Overview API Response Sent ---");

    } catch (error) {
        console.error('Revenue overview chart error:', error);
        res.status(500).json({ message: 'Server Error: Could not fetch revenue overview.' });
    }
});


// @route   GET /api/dashboard/billing/transactions
// @desc    Get paginated and filterable list of transactions
// @access  Private (Admin only)
router.get('/billing/transactions', auth, authorize(['ADMIN']), async (req, res) => {
    try {
        console.log("\n--- Transactions API Hit ---");
        const { page = 1, limit = 10, status, paymentType, startDate, endDate, minAmount, maxAmount, search } = req.query;

        let query = {};
        if (status && status !== 'All') {
            query.status = status;
        }
        if (paymentType && paymentType !== 'All') {
            query.paymentType = paymentType;
        }

        // Date range filter
        if (startDate || endDate) {
            query.paymentDate = {};
            if (startDate) {
                query.paymentDate.$gte = new Date(startDate);
                query.paymentDate.$gte.setHours(0, 0, 0, 0);
            }
            if (endDate) {
                query.paymentDate.$lte = new Date(endDate);
                query.paymentDate.$lte.setHours(23, 59, 59, 999);
            }
        }

        // Amount range filter
        if (minAmount || maxAmount) {
            query.amount = {};
            if (minAmount) {
                query.amount.$gte = parseFloat(minAmount);
            }
            if (maxAmount) {
                query.amount.$lte = parseFloat(maxAmount);
            }
        }

        // Search by memberName or transactionId
        if (search) {
            query.$or = [
                { memberName: { $regex: search, $options: 'i' } },
                { transactionId: { $regex: search, $options: 'i' } }
            ];
        }

        const options = {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            sort: { paymentDate: -1 } // Most recent first
        };

        const result = await Payment.paginate(query, options); // Assuming Payment model has mongoose-paginate-v2

        res.json({
            transactions: result.docs,
            totalTransactions: result.totalDocs,
            totalPages: result.totalPages,
            currentPage: result.page
        });
        console.log("--- Transactions API Response Sent ---");

    } catch (error) {
        console.error('Transactions list error:', error);
        res.status(500).json({ message: 'Server Error: Could not fetch transactions.' });
    }
});


module.exports = router;