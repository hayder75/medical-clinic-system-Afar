const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});

const labImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadsDir, 'lab-images');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
});

const labUpload = multer({ storage: labImageStorage, limits: { fileSize: 10 * 1024 * 1024 } });
module.exports = multer({ storage });
module.exports.labImageUpload = labUpload;