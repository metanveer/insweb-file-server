require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();

// Enable CORS to allow Next.js frontend to communicate with the backend
app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());

function generateCustomID(length = 8) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let randomPart = "";

  for (let i = 0; i < length; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const timestampPart = Date.now().toString(36);

  return randomPart + timestampPart;
}

// Set up storage engine for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "uploads")); // Store files in the 'uploads' folder
  },
  filename: (req, file, cb) => {
    const fileName = `${generateCustomID()}-${file.originalname}`;
    cb(null, fileName);
  },
});

// Initialize multer
const upload = multer({ storage: storage });

// Create 'uploads' folder if it doesn't exist
if (!fs.existsSync(path.join(__dirname, "uploads"))) {
  fs.mkdirSync(path.join(__dirname, "uploads"));
}

// Route to handle file upload
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .send({ success: false, message: "No file found in the request body" });
  }
  res.status(200).send({
    success: true,
    fileUrl: `/uploads/${req.file.filename}`,
  });
});

// Endpoint to delete a file
app.delete("/delete", (req, res) => {
  const { fileName } = req.body;

  if (!fileName) {
    return res
      .status(400)
      .send({ success: false, message: "File name is required" });
  }

  const filePath = path.join(__dirname, "uploads", fileName);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.log("error at fileserver", err);
      return res
        .status(404)
        .send({ success: false, message: "File not found" });
    }

    fs.unlink(filePath, (err) => {
      if (err) {
        return res
          .status(500)
          .send({ success: false, message: "Error deleting file" });
      }

      res
        .status(200)
        .send({ success: true, message: "File deleted successfully" });
    });
  });
});

// Serve the uploaded files as static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.send("API is running....");
});

const PORT = 8080;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
