const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['MEMBER', 'ADMIN'],
        default: 'MEMBER'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    membershipExpiresAt: {
         type: Date, 
         required: false 
    },
    address: { 
        type: String, 
        default: 'Not provided' 
    }, // Make sure this line exists
    lastLogin: { 
        type: Date, 
        default: null 
    }, // Make sure this line exists

    // ⭐ CRITICAL NEW FIELD: memberId ⭐
    memberId: {
        type: String,
        required: true,  // It must be required to ensure it's always set
        unique: true,    // Ensure each member has a unique ID
        minlength: 7,
        maxlength: 7,
    },
    
    // ⭐ NEW FIELDS BELOW for membership details ⭐
    membershipPlan: { // e.g., 'Basic', 'Premium Annual', 'Trial'
        type: String,
        default: 'None'
    },
    membershipStatus: { // e.g., 'Active', 'Inactive', 'Expired', 'Pending'
        type: String,
        enum: ['Active', 'Inactive', 'Expired', 'Pending'], // Define possible statuses
        default: 'Inactive'
    },
});

module.exports = mongoose.model('User', UserSchema);
