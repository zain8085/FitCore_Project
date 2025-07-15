// routes/admin.js
const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Assuming members are stored in the User model
const auth = require('../middleware/auth'); // For authentication (you should already have this)
const authorize = require('../middleware/authorize'); // For role-based authorization
const bcrypt = require('bcryptjs'); // Needed if you allow password reset from admin panel (good to have)
const Payment = require('../models/Payment');

// @route   GET /api/admin/members
// @desc    Get all members (users with role 'MEMBER') with pagination, search, and filters
// @access  Private (Admin only)
router.get('/members', auth, authorize(['ADMIN']), async (req, res) => {
    try {
        // Pagination parameters
        const page = parseInt(req.query.page) || 1; // Default to page 1
        const limit = parseInt(req.query.limit) || 10; // Default to 10 members per page
        const skip = (page - 1) * limit;

        // Filter parameters from query string
        const { membershipPlan, membershipStatus, joinDateStart, joinDateEnd, search } = req.query;

        // Base query for members (role 'MEMBER')
        let query = { role: 'MEMBER' };

        // Apply filters if provided
        if (membershipPlan && membershipPlan !== 'All') { // Assuming 'All' is the option for no filter
            query.membershipPlan = membershipPlan;
        }
        if (membershipStatus && membershipStatus !== 'All') { // Assuming 'All' is the option for no filter
            query.membershipStatus = membershipStatus;
        }

        // Filter by join date range (createdAt)
        if (joinDateStart || joinDateEnd) {
            query.createdAt = {};
            if (joinDateStart) {
                query.createdAt.$gte = new Date(joinDateStart); // Greater than or equal to start date
            }
            if (joinDateEnd) {
                // To include the entire end day, set to the beginning of the next day
                let endDate = new Date(joinDateEnd);
                endDate.setDate(endDate.getDate() + 1); // Go to the next day
                query.createdAt.$lt = endDate; // Less than the beginning of the next day
            }
        }

        // Apply search functionality (already in place in frontend, but backend needs to handle it)
        if (search) {
            const searchRegex = new RegExp(search, 'i'); // Case-insensitive search
            query.$or = [
                { fullName: searchRegex },
                { email: searchRegex },
                { memberId: searchRegex }
            ];
        }


        // Fetch paginated and filtered members
        const members = await User.find(query)
            .select('fullName email phone address membershipPlan membershipStatus membershipExpiresAt memberId createdAt lastLogin role') // Select all necessary fields
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 }); // Sort by creation date, newest first

        // Get total count of members matching the query (for pagination info)
        const totalMembers = await User.countDocuments(query);

        res.json({
            members,
            currentPage: page,
            totalPages: Math.ceil(totalMembers / limit),
            totalMembers
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

//Zain edited.

// ⭐ START NEW ROUTES FOR INDIVIDUAL MEMBER MANAGEMENT ⭐

// @route   GET /api/admin/members/:id
// @desc    Get a single member by ID
// @access  Private (Admin only)
router.get('/members/:id', auth, authorize(['ADMIN']), async (req, res) => {
    try {
        const member = await User.findById(req.params.id).select('-password'); // Exclude password
        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }
        res.json(member);
    } catch (err) {
        console.error(err.message);
        // Handle invalid ID format (e.g., if req.params.id is not a valid ObjectId)
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid Member ID format' });
        }
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/admin/members/:id
// @desc    Update a member by ID (Admin can update any field except password directly)
// @access  Private (Admin only)
router.put('/members/:id', auth, authorize(['ADMIN']), async (req, res) => {
    // Destructure allowed fields from the request body
    const { fullName, email, phone, address, membershipPlan, membershipStatus, membershipExpiresAt, role } = req.body;

    const memberFields = {};
    if (fullName !== undefined) memberFields.fullName = fullName;
    if (email !== undefined) memberFields.email = email;
    if (phone !== undefined) memberFields.phone = phone;
    if (address !== undefined) memberFields.address = address;
    if (membershipPlan !== undefined) memberFields.membershipPlan = membershipPlan;
    if (membershipStatus !== undefined) memberFields.membershipStatus = membershipStatus;
    if (membershipExpiresAt !== undefined) memberFields.membershipExpiresAt = membershipExpiresAt;

    // Admin can change roles, but be cautious. Prevent admin from changing their own role via this panel.
    // This check ensures an admin cannot accidentally (or maliciously) downgrade their own role via this route.
    if (role !== undefined && req.user.id !== req.params.id) {
        memberFields.role = role;
    }

    try {
        let member = await User.findById(req.params.id);

        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }

        // Handle email uniqueness if changed
        if (email && email !== member.email) {
            const existingUserWithEmail = await User.findOne({ email });
            // Ensure the found user is not the current user being updated
            if (existingUserWithEmail && existingUserWithEmail.id !== req.params.id) {
                return res.status(400).json({ message: 'Email already in use by another user' });
            }
        }
        // Handle phone uniqueness if changed
        if (phone && phone !== member.phone) {
            const existingUserWithPhone = await User.findOne({ phone });
            // Ensure the found user is not the current user being updated
            if (existingUserWithPhone && existingUserWithPhone.id !== req.params.id) {
                return res.status(400).json({ message: 'Phone number already in use by another user' });
            }
        }

        // Find and update the member
        member = await User.findByIdAndUpdate(
            req.params.id,
            { $set: memberFields }, // Use $set to update specific fields
            { new: true, runValidators: true } // Return the updated document and run schema validators
        ).select('-password'); // Exclude password from response

        res.json({ message: 'Member updated successfully', member });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid Member ID format' });
        }
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: err.message });
        }
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/admin/members/:id
// @desc    Delete a member by ID
// @access  Private (Admin only)
router.delete('/members/:id', auth, authorize(['ADMIN']), async (req, res) => {
    try {
        // Prevent admin from deleting their own account via this route
        if (req.user.id === req.params.id) {
            return res.status(403).json({ message: 'Admins cannot delete their own account via this panel. Use your profile settings.' });
        }

        const member = await User.findById(req.params.id);

        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }

        await User.findOneAndDelete({ _id: req.params.id });
        // <--- ADD THIS LINE: Delete associated payments
        await Payment.deleteMany({ member: req.params.id });

        res.json({ message: 'Member deleted successfully' });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid Member ID format' });
        }
        res.status(500).send('Server Error');
    }
});

// ⭐ END NEW ROUTES FOR INDIVIDUAL MEMBER MANAGEMENT ⭐


// ⭐ NEW ROUTE: Bulk Delete Members ⭐
// @route   DELETE /api/admin/members/bulk-delete
// @desc    Delete multiple members by their IDs
// @access  Private (Admin only)
router.post('/members/bulk-delete', auth, authorize(['ADMIN']), async (req, res) => {
    try {
        const { memberIds } = req.body; // Expects an array of member _ids

        if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
            return res.status(400).json({ message: 'No member IDs provided for bulk deletion.' });
        }

        // Prevent admin from deleting their own account via bulk delete
        const adminId = req.user.id;
        const filteredMemberIds = memberIds.filter(id => id !== adminId);

        if (filteredMemberIds.length === 0 && memberIds.includes(adminId)) {
            return res.status(403).json({ message: 'Admins cannot delete their own account via bulk actions.' });
        }

        // Use deleteMany to remove all specified members
        const result = await User.deleteMany({ _id: { $in: filteredMemberIds }, role: 'MEMBER' }); // Only delete members

        // <--- ADD THIS BLOCK: Delete associated payments for bulk deletion
        if (filteredMemberIds.length > 0) {
            await Payment.deleteMany({ member: { $in: filteredMemberIds } });
        }
        // --- END ADDED BLOCK ---
        
        // Check if any documents were actually deleted
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'No members found or deleted with the provided IDs.' });
        }

        res.json({ message: `${result.deletedCount} members deleted successfully!` });

    } catch (err) {
        console.error('Bulk delete error:', err.message);
        // Handle invalid ID format if any ID in the array is malformed
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'One or more provided IDs have an invalid format.' });
        }
        res.status(500).send('Server Error');
    }
});

//zain edited.

// Helper function to generate a unique 7-character member ID (M + 6 digits)
async function generateUniqueMemberId() {
    let isUnique = false;
    let newMemberId;
    while (!isUnique) {
        newMemberId = 'M' + Math.floor(100000 + Math.random() * 900000).toString();
        const existingUser = await User.findOne({ memberId: newMemberId });
        if (!existingUser) {
            isUnique = true;
        }
    }
    return newMemberId;
}

// @route   POST /api/admin/members
// @desc    Admin creates a new member
// @access  Private (Admin only)
router.post('/members', auth, authorize(['ADMIN']), async (req, res) => {
    const { fullName, phone, email, password, role = 'MEMBER', address, dateOfBirth, gender, membershipPlan, membershipStartDate, membershipExpiresAt } = req.body;

    try {
        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // Generate unique memberId
        const memberId = await generateUniqueMemberId();

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user instance
        const newMember = new User({
            fullName,
            phone,
            email,
            password: hashedPassword,
            role, // Allow admin to set role, but default to MEMBER for this route's intent
            memberId,
            address,
            dateOfBirth,
            gender,
            membershipPlan,
            membershipStartDate,
            membershipExpiresAt
        });

        await newMember.save();

        res.status(201).json({ message: 'Member created successfully', member: newMember.toObject({ getters: true, virtuals: false, transform: (doc, ret) => { delete ret.password; return ret; } }) }); // Exclude password from response

    } catch (err) {
        console.error('Admin create member error:', err.message);
        if (err.code === 11000) { // Duplicate key error
            let field = Object.keys(err.keyValue)[0];
            return res.status(400).json({ message: `A user with this ${field} already exists.` });
        }
        res.status(500).json({ message: 'Server error: Could not create member.' });
    }
});

module.exports = router;