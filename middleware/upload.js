const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'ride-mate',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
    transformation: [
      {
        width: 1000,
        height: 1000,
        crop: 'limit',
        quality: 'auto'
      }
    ]
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Accept images and PDF files
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and PDF files are allowed.'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({ message: 'File too large. Maximum size is 5MB' });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({ message: 'Too many files uploaded' });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({ message: 'Unexpected file field' });
      default:
        return res.status(400).json({ message: 'File upload error' });
    }
  } else if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
};

module.exports = { upload, handleMulterError };