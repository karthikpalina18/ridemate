const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Driver is required']
  },
  from: {
    city: {
      type: String,
      required: [true, 'From city is required'],
      trim: true
    },
    state: {
      type: String,
      required: [true, 'From state is required'],
      trim: true
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  to: {
    city: {
      type: String,
      required: [true, 'To city is required'],
      trim: true
    },
    state: {
      type: String,
      required: [true, 'To state is required'],
      trim: true
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  departureDate: {
    type: Date,
    required: [true, 'Departure date is required']
  },
  departureTime: {
    type: String,
    required: [true, 'Departure time is required'],
    match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter valid time in HH:MM format']
  },
  returnDate: {
    type: Date,
    default: null
  },
  returnTime: {
    type: String,
    default: null,
    match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter valid time in HH:MM format']
  },
  tripType: {
    type: String,
    enum: ['one-way', 'round-trip'],
    required: [true, 'Trip type is required']
  },
  vehicle: {
    type: {
      type: String,
      enum: ['car', 'suv', 'hatchback', 'sedan', 'motorcycle'],
      required: [true, 'Vehicle type is required']
    },
    model: {
      type: String,
      required: [true, 'Vehicle model is required']
    },
    number: {
      type: String,
      required: [true, 'Vehicle number is required'],
      uppercase: true
    },
    color: {
      type: String,
      required: [true, 'Vehicle color is required']
    },
    rc: {
      type: String, // Cloudinary URL
      required: [true, 'RC document is required']
    },
    insurance: {
      type: String, // Cloudinary URL
      required: [true, 'Insurance document is required']
    }
  },
  drivingLicense: {
    number: {
      type: String,
      required: [true, 'Driving license number is required']
    },
    document: {
      type: String, // Cloudinary URL
      required: [true, 'Driving license document is required']
    }
  },
  availableSeats: {
    type: Number,
    required: [true, 'Available seats is required'],
    min: [1, 'At least 1 seat must be available'],
    max: [7, 'Maximum 7 seats allowed']
  },
  pricePerSeat: {
    type: Number,
    required: [true, 'Price per seat is required'],
    min: [1, 'Price must be at least 1']
  },
  pickupPoints: [{
    location: {
      type: String,
      required: true
    },
    time: {
      type: String,
      required: true
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  }],
  dropPoints: [{
    location: {
      type: String,
      required: true
    },
    time: {
      type: String,
      required: true
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  }],
  amenities: [{
    type: String,
    enum: ['ac', 'music', 'charging_port', 'wifi', 'no_smoking', 'pet_friendly']
  }],
  rules: [{
    type: String,
    maxlength: [200, 'Rule cannot exceed 200 characters']
  }],
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'active', 'completed', 'cancelled'],
    default: 'pending'
  },
  adminRemarks: {
    type: String,
    maxlength: [500, 'Admin remarks cannot exceed 500 characters']
  },
  bookedSeats: {
    type: Number,
    default: 0
  },
  passengers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    seatsBooked: Number,
    bookingDate: Date,
    status: {
      type: String,
      enum: ['confirmed', 'cancelled'],
      default: 'confirmed'
    }
  }],
  totalEarnings: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
tripSchema.index({ 'from.city': 1, 'to.city': 1 });
tripSchema.index({ departureDate: 1 });
tripSchema.index({ driver: 1 });
tripSchema.index({ status: 1 });

// Virtual for remaining seats
tripSchema.virtual('remainingSeats').get(function() {
  return this.availableSeats - this.bookedSeats;
});

// Method to check if seats are available
tripSchema.methods.hasAvailableSeats = function(requestedSeats) {
  return this.remainingSeats >= requestedSeats;
};

// Transform output
tripSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
  virtuals: true
});

module.exports = mongoose.model('Trip', tripSchema);