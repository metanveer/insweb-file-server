require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const winston = require("winston");
const helmet = require("helmet");

// Initialize Express
const app = express();

// Load environment variables from .env file
const FRONTEND_URL = process.env.FRONTEND_URL; // Production frontend URL from environment variable
const PORT = process.env.PORT || 8080; // Backend API Port

// Security Middleware - Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],
        "frame-ancestors": ["'self'", FRONTEND_URL], // Allow embedding from the frontend URL
      },
    },
  })
);

// CORS configuration to allow frontend domain in production
const corsOptions = {
  origin: FRONTEND_URL, // Allow requests from the production frontend
  methods: ["GET", "POST", "DELETE"], // Allowed methods
  credentials: true, // Allow cookies if needed
};

app.use(cors(corsOptions)); // Apply CORS middleware
app.use(express.json()); // Parse JSON bodies

// Logger Setup using Winston
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.File({ filename: "server.log" })],
});

// Ensure 'uploads' directory exists
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Function to generate a unique file ID
const generateCustomID = (length = 8) => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let randomPart = "";
  for (let i = 0; i < length; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return randomPart + Date.now().toString(36);
};

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, `${generateCustomID()}-${sanitizedFileName}`);
  },
});

// File Upload Validation (Restricting file types)
const upload = multer({
  storage,
  limits: { fileSize: 40 * 1024 * 1024 }, // 40MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
      "application/msword", // .doc
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Unsupported file type"), false);
    }

    cb(null, true);
  },
});

// File Upload Route with Improved Error Handling
app.post(
  "/upload",
  upload.single("file"),
  (req, res) => {
    if (!req.file) {
      logger.warn("No file uploaded");
      return res
        .status(400)
        .json({ success: false, message: "No file found in the request body" });
    }
    logger.info(`File uploaded: ${req.file.filename}`);
    console.log(`File uploaded: ${req.file.filename}`);
    res
      .status(200)
      .json({ success: true, fileUrl: `/uploads/${req.file.filename}` });
  },
  (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
      logger.error(`Multer Error: ${error.message}`);
      return res.status(400).json({ success: false, message: error.message });
    } else if (error) {
      logger.error(`Unknown Error: ${error.message}`);
      return res.status(400).json({ success: false, message: error.message });
    }
    next();
  }
);

// File Deletion Route
app.delete("/delete", (req, res) => {
  const { fileName } = req.body;

  if (!fileName) {
    logger.warn("Attempt to delete file without filename");
    return res
      .status(400)
      .json({ success: false, message: "File name is required" });
  }

  const filePath = path.join(UPLOADS_DIR, fileName);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      logger.error(`File not found: ${fileName}`);
      return res
        .status(404)
        .json({ success: false, message: "File not found" });
    }

    fs.unlink(filePath, (err) => {
      if (err) {
        logger.error(`Error deleting file: ${fileName}`, err);
        return res
          .status(500)
          .json({ success: false, message: "Error deleting file" });
      }
      logger.info(`File deleted: ${fileName}`);
      res
        .status(200)
        .json({ success: true, message: "File deleted successfully" });
    });
  });
});

// Serve Uploaded Files
app.use("/uploads", express.static(UPLOADS_DIR));

// Root Route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  logger.info(`Server running on http://localhost:${PORT}`);
});
