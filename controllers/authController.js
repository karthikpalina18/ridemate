const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.registerUser = async (req, res) => {
    const { firstName, lastName, email, password, phone, dateOfBirth, gender, address, idProof } = req.body;

    try {
        // Check if user already exists
        let user = await User.findOne({ 
            $or: [
                { email: email.toLowerCase() },
                { phone: phone }
            ]
        });
        
        if (user) {
            if (user.email === email.toLowerCase()) {
                return res.status(400).json({ message: 'User with this email already exists' });
            }
            if (user.phone === phone) {
                return res.status(400).json({ message: 'User with this phone number already exists' });
            }
        }

        // Validate required fields
        if (!firstName || !lastName || !email || !password || !phone) {
            return res.status(400).json({ message: 'All required fields must be provided' });
        }

        // Create new user
        user = new User({ 
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.toLowerCase().trim(),
            password,
            phone: phone.trim(),
            dateOfBirth,
            gender,
            address,
            idProof
        });

        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, email: user.email }, 
            process.env.JWT_SECRET, 
            { expiresIn: '7d' }
        );

        // Return user data without password
        const userData = {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
            profileImage: user.profileImage,
            isVerified: user.isVerified,
            role: user.role,
            rating: user.rating,
            tripsCompleted: user.tripsCompleted
        };

        res.status(201).json({ 
            message: 'User registered successfully',
            token, 
            user: userData 
        });

    } catch (err) {
        console.error('Registration error:', err);
        
        // Handle MongoDB validation errors
        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({ message: errors.join(', ') });
        }
        
        // Handle duplicate key errors
        if (err.code === 11000) {
            const field = Object.keys(err.keyValue)[0];
            return res.status(400).json({ message: `${field} already exists` });
        }
        
        res.status(500).json({ message: 'Server error during registration' });
    }
};

exports.loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Find user by email and include password for comparison
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(403).json({ message: 'Account is deactivated. Please contact support.' });
        }

        // Compare password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, email: user.email }, 
            process.env.JWT_SECRET, 
            { expiresIn: '7d' }
        );

        // Return user data without password
        const userData = {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
            profileImage: user.profileImage,
            isVerified: user.isVerified,
            role: user.role,
            rating: user.rating,
            tripsCompleted: user.tripsCompleted,
            lastLogin: user.lastLogin
        };

        res.json({ 
            message: 'Login successful',
            token, 
            user: userData 
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error during login' });
    }
};

// Get user profile
exports.getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ user });
    } catch (err) {
        console.error('Get profile error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update user profile
exports.updateUserProfile = async (req, res) => {
    try {
        const updates = req.body;
        
        // Remove sensitive fields that shouldn't be updated via this endpoint
        delete updates.password;
        delete updates.email;
        delete updates.role;
        delete updates.isVerified;
        delete updates.rating;
        delete updates.tripsCompleted;

        const user = await User.findByIdAndUpdate(
            req.user.id,
            updates,
            { new: true, runValidators: true }
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ 
            message: 'Profile updated successfully',
            user 
        });
    } catch (err) {
        console.error('Update profile error:', err);
        
        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({ message: errors.join(', ') });
        }
        
        res.status(500).json({ message: 'Server error during profile update' });
    }
};

// Change password
exports.changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current password and new password are required' });
        }

        const user = await User.findById(req.user.id).select('+password');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.json({ message: 'Password changed successfully' });
    } catch (err) {
        console.error('Change password error:', err);
        
        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({ message: errors.join(', ') });
        }
        
        res.status(500).json({ message: 'Server error during password change' });
    }
};