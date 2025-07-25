// routes/tripRoutes.js
const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip');
const User = require('../models/User'); // Assuming you have a User model

// GET /api/trips - Search for trips
router.get('/', async (req, res) => {
  try {
    const { from, to, date, seats = 1 } = req.query;

    console.log('Search params:', { from, to, date, seats });

    if (!from || !to) {
      return res.status(400).json({ 
        error: 'Both from and to cities are required' 
      });
    }

    // Build filter object
    const filter = {
      'from.city': new RegExp(`^${from.trim()}$`, 'i'),
      'to.city': new RegExp(`^${to.trim()}$`, 'i'),
      isActive: true,
      status:  { $in: ['active', 'approved'] },
      $expr: { 
        $gte: [
          { $subtract: ["$availableSeats", "$bookedSeats"] }, 
          parseInt(seats)
        ]
      }
    };

    // Add date filter if provided
    if (date) {
      const searchDate = new Date(date);
      searchDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);

      filter.departureDate = {
        $gte: searchDate,
        $lt: nextDay
      };
    } else {
      // Only show future trips if no date specified
      filter.departureDate = { $gte: new Date() };
    }

    const trips = await Trip.find(filter)
      .populate('driver', 'name email phone profilePicture rating')
      .sort({ departureDate: 1, departureTime: 1 })
      .limit(50);

    console.log(`Found ${trips.length} trips`);

    res.json({
      success: true,
      count: trips.length,
      data: trips
    });

  } catch (error) {
    console.error('Search trips error:', error);
    res.status(500).json({ 
      error: 'Failed to search trips',
      message: error.message 
    });
  }
});

// POST /api/trips - Create a new trip
router.post('/', async (req, res) => {
  try {
    const tripData = req.body;
    
    // Validate required fields
    const requiredFields = [
      'driver', 'from.city', 'from.state', 'to.city', 'to.state',
      'departureDate', 'departureTime', 'availableSeats', 'pricePerSeat',
      'vehicle.type', 'vehicle.model', 'vehicle.number', 'vehicle.color'
    ];

    for (const field of requiredFields) {
      const keys = field.split('.');
      let value = tripData;
      for (const key of keys) {
        value = value?.[key];
      }
      if (!value) {
        return res.status(400).json({
          error: `${field} is required`
        });
      }
    }

    // Create new trip
    const trip = new Trip(tripData);
    await trip.save();

    // Populate driver details
    await trip.populate('driver', 'name email phone');

    res.status(201).json({
      success: true,
      message: 'Trip created successfully',
      data: trip
    });

  } catch (error) {
    console.error('Create trip error:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors
      });
    }

    res.status(500).json({
      error: 'Failed to create trip',
      message: error.message
    });
  }
});

// GET /api/trips/popular-routes - Get popular routes (MOVED BEFORE /:id)
router.get('/popular-routes', async (req, res) => {
  try {
    const popularRoutes = await Trip.aggregate([
      {
        $match: {
          status: 'active',
          isActive: true
        }
      },
      {
        $group: {
          _id: {
            from: '$from.city',
            to: '$to.city'
          },
          count: { $sum: 1 },
          avgPrice: { $avg: '$pricePerSeat' },
          minPrice: { $min: '$pricePerSeat' }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 8
      },
      {
        $project: {
          from: '$_id.from',
          to: '$_id.to',
          tripCount: '$count',
          averagePrice: { $round: ['$avgPrice', 0] },
          minPrice: '$minPrice',
          _id: 0
        }
      }
    ]);

    res.json({
      success: true,
      data: popularRoutes
    });

  } catch (error) {
    console.error('Get popular routes error:', error);
    res.status(500).json({
      error: 'Failed to get popular routes',
      message: error.message
    });
  }
});

// GET /api/trips/driver/:driverId - Get trips by driver (MOVED BEFORE /:id)
router.get('/driver/:driverId', async (req, res) => {
  try {
    const trips = await Trip.find({ driver: req.params.driverId })
      .populate('passengers.user', 'name email phone')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: trips.length,
      data: trips
    });

  } catch (error) {
    console.error('Get driver trips error:', error);
    res.status(500).json({
      error: 'Failed to get driver trips',
      message: error.message
    });
  }
});

// GET /api/trips/:id - Get trip by ID (MOVED AFTER SPECIFIC ROUTES)
router.get('/:id', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate('driver', 'name email phone profilePicture rating')
      .populate('passengers.user', 'name email phone');

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    res.json({
      success: true,
      data: trip
    });

  } catch (error) {
    console.error('Get trip error:', error);
    res.status(500).json({ 
      error: 'Failed to get trip',
      message: error.message 
    });
  }
});

// PUT /api/trips/:id - Update trip
router.put('/:id', async (req, res) => {
  try {
    const trip = await Trip.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('driver', 'name email phone');

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    res.json({
      success: true,
      message: 'Trip updated successfully',
      data: trip
    });

  } catch (error) {
    console.error('Update trip error:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors
      });
    }

    res.status(500).json({
      error: 'Failed to update trip',
      message: error.message
    });
  }
});

// DELETE /api/trips/:id - Delete trip
router.delete('/:id', async (req, res) => {
  try {
    const trip = await Trip.findByIdAndDelete(req.params.id);

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    res.json({
      success: true,
      message: 'Trip deleted successfully'
    });

  } catch (error) {
    console.error('Delete trip error:', error);
    res.status(500).json({
      error: 'Failed to delete trip',
      message: error.message
    });
  }
});

// POST /api/trips/:id/book - Book a trip
router.post('/:id/book', async (req, res) => {
  try {
    const { userId, seatsRequested } = req.body;

    if (!userId || !seatsRequested) {
      return res.status(400).json({
        error: 'User ID and seats requested are required'
      });
    }

    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (!trip.hasAvailableSeats(seatsRequested)) {
      return res.status(400).json({
        error: 'Not enough seats available'
      });
    }

    // Check if user already booked this trip
    const existingBooking = trip.passengers.find(
      p => p.user.toString() === userId && p.status === 'confirmed'
    );

    if (existingBooking) {
      return res.status(400).json({
        error: 'You have already booked this trip'
      });
    }

    // Add passenger to trip
    trip.passengers.push({
      user: userId,
      seatsBooked: seatsRequested,
      bookingDate: new Date(),
      status: 'confirmed'
    });

    trip.bookedSeats += seatsRequested;
    trip.totalEarnings += (seatsRequested * trip.pricePerSeat);

    await trip.save();

    // Populate user details
    await trip.populate('passengers.user', 'name email phone');

    res.json({
      success: true,
      message: 'Trip booked successfully',
      data: trip
    });

  } catch (error) {
    console.error('Book trip error:', error);
    res.status(500).json({
      error: 'Failed to book trip',
      message: error.message
    });
  }
});

// POST /api/trips/:id/cancel-booking - Cancel booking
router.post('/:id/cancel-booking', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const bookingIndex = trip.passengers.findIndex(
      p => p.user.toString() === userId && p.status === 'confirmed'
    );

    if (bookingIndex === -1) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = trip.passengers[bookingIndex];
    booking.status = 'cancelled';

    trip.bookedSeats -= booking.seatsBooked;
    trip.totalEarnings -= (booking.seatsBooked * trip.pricePerSeat);

    await trip.save();

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: trip
    });

  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      error: 'Failed to cancel booking',
      message: error.message
    });
  }
});

module.exports = router;