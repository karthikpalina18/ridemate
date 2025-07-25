// controllers/tripController.js
const Trip = require('../models/Trip');

// Add a new trip
const addTrip = async (req, res) => {
    try {
        const newTrip = new Trip(req.body);
        await newTrip.save();
        res.status(201).json({ message: 'Trip added successfully', trip: newTrip });
    } catch (error) {
        res.status(500).json({ message: 'Failed to add trip', error: error.message });
    }
};

module.exports = {
    addTrip
};
