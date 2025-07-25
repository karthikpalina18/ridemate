// routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Trip = require('../models/Trip');

// POST /api/bookings — Book a ride
router.post('/', async (req, res) => {
  try {
    const {
      trip: tripId,
      passenger,
      seatsBooked,
      pickupPoint,
      dropPoint,
      passengerDetails,
      paymentMethod,
      specialRequests
    } = req.body;

    // Basic validation
    if (!tripId || !passenger || !seatsBooked || !pickupPoint || !dropPoint || !passengerDetails) {
      return res.status(400).json({ error: 'Missing required booking details' });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Check seat availability
    if (!trip.hasAvailableSeats(seatsBooked)) {
      return res.status(400).json({ error: 'Not enough available seats' });
    }

    const totalAmount = seatsBooked * trip.pricePerSeat;

    // Create booking object
    const booking = new Booking({
      trip: tripId,
      passenger,
      seatsBooked,
      totalAmount,
      pickupPoint,
      dropPoint,
      passengerDetails,
      paymentMethod,
      specialRequests,
      bookingStatus: 'confirmed',
      paymentStatus: paymentMethod === 'cash' ? 'pending' : 'paid'
    });

    // Optional: generate OTP
    const otpCode = booking.generateOTP();

    await booking.save();

    // Update corresponding trip
    trip.bookedSeats += seatsBooked;
    trip.totalEarnings += totalAmount;
    trip.passengers.push({
      user: passenger,
      seatsBooked,
      bookingDate: new Date(),
      status: 'confirmed'
    });
    await trip.save();

    res.status(201).json({
      success: true,
      message: 'Ride booked successfully',
      data: booking,
      otp: otpCode
    });

  } catch (err) {
    console.error('Booking error:', err);
    res.status(500).json({ error: 'Failed to book ride', message: err.message });
  }
});

module.exports = router;
