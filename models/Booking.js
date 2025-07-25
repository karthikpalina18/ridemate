const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  trip: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: [true, 'Trip is required']
  },
  passenger: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Passenger is required']
  },
  seatsBooked: {
    type: Number,
    required: [true, 'Number of seats is required'],
    min: [1, 'At least 1 seat must be booked']
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  pickupPoint: {
    location: {
      type: String,
      required: [true, 'Pickup location is required']
    },
    time: {
      type: String,
      required: [true, 'Pickup time is required']
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  dropPoint: {
    location: {
      type: String,
      required: [true, 'Drop location is required']
    },
    time: {
      type: String,
      required: [true, 'Drop time is required']
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  passengerDetails: [{
    name: {
      type: String,
      required: [true, 'Passenger name is required']
    },
    age: {
      type: Number,
      required: [true, 'Passenger age is required'],
      min: [1, 'Age must be at least 1'],
      max: [120, 'Age cannot exceed 120']
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: [true, 'Gender is required']
    },
    phone: {
      type: String,
      match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
    }
  }],
  bookingStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'online', 'upi', 'card'],
    default: 'online'
  },
  transactionId: {
    type: String,
    sparse: true
  },
  specialRequests: {
    type: String,
    maxlength: [300, 'Special requests cannot exceed 300 characters']
  },
  cancellationReason: {
    type: String,
    maxlength: [500, 'Cancellation reason cannot exceed 500 characters']
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancelledAt: {
    type: Date
  },
  refundAmount: {
    type: Number,
    default: 0
  },
  rating: {
    forDriver: {
      rating: { type: Number, min: 1, max: 5 },
      review: { type: String, maxlength: 500 }
    },
    forPassenger: {
      rating: { type: Number, min: 1, max: 5 },
      review: { type: String, maxlength: 500 }
    }
  },
  driverContact: {
    name: String,
    phone: String,
    sharedAt: Date
  },
  passengerContact: {
    name: String,
    phone: String,
    sharedAt: Date
  },
  otp: {
    code: String,
    generatedAt: Date,
    verified: { type: Boolean, default: false }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
bookingSchema.index({ trip: 1, passenger: 1 });
bookingSchema.index({ passenger: 1 });
bookingSchema.index({ bookingStatus: 1 });
bookingSchema.index({ paymentStatus: 1 });

// Method to calculate refund amount based on cancellation policy
bookingSchema.methods.calculateRefund = function() {
  const now = new Date();
  const tripDate = new Date(this.trip.departureDate);
  const timeDiff = tripDate - now;
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  
  if (hoursDiff >= 24) {
    return this.totalAmount * 0.9; // 90% refund if cancelled 24+ hours before
  } else if (hoursDiff >= 12) {
    return this.totalAmount * 0.7; // 70% refund if cancelled 12-24 hours before
  } else if (hoursDiff >= 6) {
    return this.totalAmount * 0.5; // 50% refund if cancelled 6-12 hours before
  } else {
    return 0; // No refund if cancelled within 6 hours
  }
};

// Method to generate OTP
bookingSchema.methods.generateOTP = function() {
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  this.otp = {
    code: otp,
    generatedAt: new Date(),
    verified: false
  };
  return otp;
};

// Transform output
bookingSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Booking', bookingSchema);