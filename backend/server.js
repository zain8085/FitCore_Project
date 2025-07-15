// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config(); // ✅ Add this line to load environment variables

const app = express();

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Connect MongoDB
const mongoURI = "mongodb+srv://Syed_Zain:00000000@fitcore25.53g19bu.mongodb.net/fitcoreDB?retryWrites=true&w=majority&appName=FitCore25";

mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully!'))
.catch((err) => console.error('❌ MongoDB connection error:', err));

// --- ROUTES ---
// This entire section should appear ONLY ONCE.

const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

const userRoutes = require('./routes/user');
app.use('/api/user', userRoutes); 

const dashboardRoutes = require('./routes/dashboard');
app.use('/api/dashboard', dashboardRoutes);

const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// ⭐ This is the NEW Payment routes addition you needed ⭐
const paymentRoutes = require('./routes/payments'); 
app.use('/api/payments', paymentRoutes); 

// Test route - Keep only one of these, or the one you prefer.
app.get('/', (req, res) => {
    res.send('Hello from Gym Management Backend!'); // Or 'API is running...'
});

// --- END ROUTES ---

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});