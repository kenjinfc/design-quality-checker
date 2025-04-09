// app.js
const express = require('express');
const multer = require('multer');
// const Jimp = require('jimp'); // No longer needed directly here
const path = require('path');
const fs = require('fs');
const { Worker } = require('worker_threads'); // Import Worker

const app = express();
const port = process.env.PORT || 3000; // Use environment variable for port
const RECOMMENDED_WIDTH = parseInt(process.env.RECOMMENDED_WIDTH || '4500', 10); // Configurable via env
const MAX_WIDTH = parseInt(process.env.MAX_WIDTH || '6000', 10); // Configurable via env
const FILE_SIZE_LIMIT_MB = parseInt(process.env.FILE_SIZE_LIMIT_MB || '50', 10);

// Worker configuration
const workerPath = path.resolve(__dirname, 'image-worker.js');

// Cấu hình lưu trữ tạm thời cho file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: FILE_SIZE_LIMIT_MB * 1024 * 1024 } // Use config var
});

// Phục vụ file tĩnh từ public - Vercel sẽ xử lý việc này thông qua Output Directory setting
// app.use(express.static(path.join(__dirname, 'public'))); 

// Trang chủ - Vercel sẽ tự động phục vụ index.html từ Output Directory
// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });

// API cung cấp hình ảnh placeholder
app.get('/api/placeholder', (req, res) => {
  const placeholderPath = path.join(__dirname, 'public', 'placeholder-design.png');
  if (fs.existsSync(placeholderPath)) {
    res.sendFile(placeholderPath);
  } else {
    // Placeholder generation might also be moved to a worker if it becomes complex
    // For now, keep it simple. Requires Jimp if kept here.
    const Jimp = require('jimp'); 
    new Jimp(500, 500, 0xffffffff, (err, image) => {
      if (err) {
        console.error('Error creating placeholder:', err);
        return res.status(500).json({ error: 'Không thể tạo hình placeholder' });
      }
      image.getBuffer(Jimp.MIME_PNG, (err, buffer) => {
        if (err) {
          console.error('Error getting placeholder buffer:', err);
          return res.status(500).json({ error: 'Không thể tạo buffer hình placeholder' });
        }
        res.set('Content-Type', Jimp.MIME_PNG);
        res.send(buffer);
      });
    });
  }
});

// API xử lý tải lên thiết kế
app.post('/analyze', upload.single('design'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Không có file nào được tải lên' });
  }

  if (req.file.mimetype !== 'image/png') {
    return res.status(400).json({ error: 'Chỉ chấp nhận file PNG' });
  }

  // Tạo worker mới cho mỗi yêu cầu
  const worker = new Worker(workerPath);

  // Gửi buffer và config cho worker
  const config = { RECOMMENDED_WIDTH, MAX_WIDTH };
  worker.postMessage({ buffer: req.file.buffer, config });

  // Xử lý tin nhắn từ worker
  worker.on('message', (message) => {
    if (message.status === 'done') {
      // Gửi kết quả thành công từ worker về client
      res.json({
        ...message.result, // Spread the result object from worker
        fileSize: req.file.size // Add original file size
      });
    } else if (message.status === 'error') {
      console.error('Worker error processing image:', message.error);
      res.status(500).json({ error: `Lỗi xử lý ảnh trong worker: ${message.error.message || 'Lỗi không xác định'}` });
    }
    // Worker đã hoàn thành công việc, có thể chấm dứt sớm
    worker.terminate().catch(err => console.error("Failed to terminate worker:", err));
  });

  // Xử lý lỗi worker
  worker.on('error', (error) => {
    console.error('Worker encountered an error:', error);
    if (!res.headersSent) { // Chỉ gửi lỗi nếu chưa gửi response
        res.status(500).json({ error: `Worker gặp lỗi: ${error.message || 'Lỗi không xác định'}` });
    }
    worker.terminate().catch(err => console.error("Failed to terminate worker on error:", err));
  });

  // Xử lý khi worker thoát
  worker.on('exit', (code) => {
    if (code !== 0 && !res.headersSent) {
      console.error(`Worker stopped with exit code ${code}`);
        res.status(500).json({ error: `Worker dừng với mã thoát ${code}` });
    }
  });

});

// Khởi động server
app.listen(port, () => {
  console.log(`Design Quality Checker running at http://localhost:${port}`);
  console.log(`Worker Path: ${workerPath}`);
  console.log(`Config: Recommended Width=${RECOMMENDED_WIDTH}, Max Width=${MAX_WIDTH}, File Size Limit=${FILE_SIZE_LIMIT_MB}MB`);
  console.log(`Ready to check designs!`);
});
