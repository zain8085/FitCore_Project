// backend/models/Payment.js
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2'); // <--- ADD THIS LINE

const PaymentSchema = new mongoose.Schema({
    member: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the User model, as members are stored there
        required: true
    },
    memberId: { // Denormalized memberId for easier querying/display
        type: String,
        required: true
    },
    memberName: { // Denormalized member name for easier display
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0 // Payment amount should be non-negative
    },
    paymentDate: {
        type: Date,
        default: Date.now,
        required: true
    },
    status: {
        type: String,
        enum: ['completed', 'pending', 'failed', 'refunded'], // Common payment statuses
        default: 'completed',
        required: true
    },
    paymentType: {
        type: String,
        enum: ['membership', 'supplement', 'class', 'other'], // Types of payments
        required: true
    },
    // Optional: If you want to store details about the membership plan purchased
    membershipPlan: {
        type: String,
        required: function() { return this.paymentType === 'membership'; } // Required only if paymentType is membership
    },
    transactionId: { // Optional: For external payment gateway transaction IDs
        type: String,
        unique: true,
        sparse: true // Allows null values but enforces uniqueness for non-null values
    },
    description: { // Optional: Any additional notes about the payment
        type: String
    }
}, {
    timestamps: true // Adds createdAt and updatedAt timestamps
});

PaymentSchema.plugin(mongoosePaginate); // Add this line

module.exports = mongoose.model('Payment', PaymentSchema);