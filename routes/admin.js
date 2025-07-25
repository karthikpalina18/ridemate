const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Trip = require('../models/Trip');
const Booking = require('../models/Booking');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { body, validationResult } = require('express-validator');

// Dashboard statistics
router.get('/dashboard', auth, adminAuth, async (req, res) => {
  try {
    const [
      totalUsers,
      totalTrips,
      totalBookings,
      pendingTrips,
      activeTrips,
      completedTrips,
      totalRevenue,
      recentUsers
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Trip.countDocuments(),
      Booking.countDocuments(),
      Trip.countDocuments({ status: 'pending' }),
      Trip.countDocuments({ status: 'active' }),
      Trip.countDocuments({ status: 'completed' }),
      Booking.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      User.find({ role: 'user' })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('firstName lastName email createdAt')
    ]);

    const stats = {
      totalUsers,
      totalTrips,
      totalBookings,
      pendingTrips,
      activeTrips,
      completedTrips,
      totalRevenue: totalRevenue[0]?.total || 0,
      recentUsers
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all users
router.get('/users', auth, adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, verified, active } = req.query;
    
    const query = { role: 'user' };
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (verified !== undefined) {
      query.isVerified = verified === 'true';
    }
    
    if (active !== undefined) {
      query.isActive = active === 'true';
    }

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user details
router.get('/users/:id', auth, adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's trip and booking statistics
    const [userTrips, userBookings] = await Promise.all([
      Trip.find({ driver: req.params.id }).sort({ createdAt: -1 }),
      Booking.find({ passenger: req.params.id })
        .populate('trip', 'from to departureDate')
        .sort({ createdAt: -1 })
    ]);

    res.json({
      user,
      trips: userTrips,
      bookings: userBookings
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Verify user
router.patch('/users/:id/verify', auth, adminAuth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isVerified: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User verified successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Deactivate user
router.patch('/users/:id/deactivate', auth, adminAuth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Cancel all active trips for this user
    await Trip.updateMany(
      { driver: req.params.id, status: { $in: ['pending', 'active'] } },
      { status: 'cancelled' }
    );

    res.json({ message: 'User deactivated successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all trips
router.get('/trips', auth, adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { 'from.city': { $regex: search, $options: 'i' } },
        { 'to.city': { $regex: search, $options: 'i' } }
      ];
    }

    const trips = await Trip.find(query)
      .populate('driver', 'firstName lastName email phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Trip.countDocuments(query);

    res.json({
      trips,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get trip details
router.get('/trips/:id', auth, adminAuth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate('driver', 'firstName lastName email phone profileImage')
      .populate('passengers.user', 'firstName lastName email phone');

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Get bookings for this trip
    const bookings = await Booking.find({ trip: req.params.id })
      .populate('passenger', 'firstName lastName email phone');

    res.json({
      trip,
      bookings
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Approve trip
router.patch('/trips/:id/approve', auth, adminAuth, [
  body('adminRemarks').optional().isLength({ max: 500 }).withMessage('Admin remarks cannot exceed 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { adminRemarks } = req.body;

    const trip = await Trip.findById(req.params.id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (trip.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending trips can be approved' });
    }

    trip.status = 'active';
    trip.adminRemarks = adminRemarks;
    await trip.save();

    res.json({ message: 'Trip approved successfully', trip });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Reject trip
router.patch('/trips/:id/reject', auth, adminAuth, [
  body('adminRemarks').isLength({ min: 1, max: 500 }).withMessage('Admin remarks are required and cannot exceed 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { adminRemarks } = req.body;

    const trip = await Trip.findById(req.params.id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (trip.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending trips can be rejected' });
    }

    trip.status = 'rejected';
    trip.adminRemarks = adminRemarks;
    await trip.save();

    res.json({ message: 'Trip rejected successfully', trip });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all bookings
router.get('/bookings', auth, adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, paymentStatus } = req.query;
    
    const query = {};
    
    if (status) {
      query.bookingStatus = status;
    }
    
    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    const bookings = await Booking.find(query)
      .populate('trip', 'from to departureDate departureTime')
      .populate('passenger', 'firstName lastName email phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Booking.countDocuments(query);

    res.json({
      bookings,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get booking details
router.get('/bookings/:id', auth, adminAuth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('trip')
      .populate('passenger', 'firstName lastName email phone profileImage')
      .populate('trip.driver', 'firstName lastName email phone profileImage');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Analytics endpoints
router.get('/analytics/revenue', auth, adminAuth, async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;
    
    let groupBy;
    switch (period) {
      case 'daily':
        groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
        break;
      case 'weekly':
        groupBy = { $dateToString: { format: '%Y-%U', date: '$createdAt' } };
        break;
      case 'monthly':
        groupBy = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
        break;
      default:
        groupBy = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
    }

    const revenue = await Booking.aggregate([
      { $match: { paymentStatus: 'paid' } },
      {
        $group: {
          _id: groupBy,
          totalRevenue: { $sum: '$totalAmount' },
          totalBookings: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json(revenue);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/analytics/popular-routes', auth, adminAuth, async (req, res) => {
  try {
    const routes = await Trip.aggregate([
      { $match: { status: { $in: ['active', 'completed'] } } },
      {
        $group: {
          _id: {
            from: '$from.city',
            to: '$to.city',
            fromState: '$from.state',
            toState: '$to.state'
          },
          totalTrips: { $sum: 1 },
          totalBookings: { $sum: '$bookedSeats' },
          avgPrice: { $avg: '$pricePerSeat' }
        }
      },
      { $sort: { totalBookings: -1 } },
      { $limit: 10 }
    ]);

    res.json(routes);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;