const { parentPort } = require('worker_threads');
const Jimp = require('jimp');

// --- Hàm tiện ích xử lý ảnh (chuyển từ app.js) ---

function detectMonochrome(image) {
  let isAllWhite = true;
  let isAllBlack = true;
  let totalPixels = 0;
  let opaquePixels = 0;
  const whiteThreshold = 245; // Ngưỡng trắng
  const blackThreshold = 10;  // Ngưỡng đen
  const alphaThreshold = 10;  // Ngưỡng alpha để coi là không trong suốt

  try {
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
      const red = this.bitmap.data[idx + 0];
      const green = this.bitmap.data[idx + 1];
      const blue = this.bitmap.data[idx + 2];
      const alpha = this.bitmap.data[idx + 3];
      
      totalPixels++;
      
      if (alpha < alphaThreshold) return; // Bỏ qua pixel gần như trong suốt
      
      opaquePixels++;
      
      if (red < whiteThreshold || green < whiteThreshold || blue < whiteThreshold) {
        isAllWhite = false;
      }
      if (red > blackThreshold || green > blackThreshold || blue > blackThreshold) {
        isAllBlack = false;
      }
      // Tối ưu: Dừng sớm nếu không thể là cả trắng và đen nữa
      if (!isAllWhite && !isAllBlack) {
        return false; // Thoát sớm khỏi scan nếu có thể (Jimp có thể không hỗ trợ)
      }
    });
  } catch (scanError) {
    console.error("Error during image scan:", scanError);
    // Nếu lỗi scan, không thể xác định đơn sắc
    return {
      isAllWhite: false,
      isAllBlack: false,
      isMonochrome: false,
      transparencyPercentage: 0 // Hoặc tính dựa trên totalPixels nếu có
    };
  }
  
  // Chỉ coi là đơn sắc nếu có ít nhất 1% pixel không trong suốt
  const hasSignificantContent = opaquePixels > (totalPixels * 0.01);
  const isEffectivelyMonochrome = (isAllWhite || isAllBlack) && hasSignificantContent;

  return {
    isAllWhite: isAllWhite && isEffectivelyMonochrome,
    isAllBlack: isAllBlack && isEffectivelyMonochrome,
    isMonochrome: isEffectivelyMonochrome,
    transparencyPercentage: totalPixels > 0 ? (1 - (opaquePixels / totalPixels)) * 100 : 0
  };
}

async function createInvertedImage(image) {
  const inverted = image.clone();
  const alphaThreshold = 10;
  
  inverted.scan(0, 0, inverted.bitmap.width, inverted.bitmap.height, function(x, y, idx) {
    const alpha = this.bitmap.data[idx + 3];
    if (alpha >= alphaThreshold) { // Chỉ đảo ngược pixel không gần như trong suốt
      this.bitmap.data[idx + 0] = 255 - this.bitmap.data[idx + 0]; // R
      this.bitmap.data[idx + 1] = 255 - this.bitmap.data[idx + 1]; // G
      this.bitmap.data[idx + 2] = 255 - this.bitmap.data[idx + 2]; // B
    }
  });
  
  return inverted;
}

// --- Logic xử lý chính của worker ---

async function processImage(buffer, config) {
  const { RECOMMENDED_WIDTH, MAX_WIDTH } = config;
  let image, originalWidth, originalHeight, wasCropped = false, croppedImage, qualityPercentage, resizedImage, wasResized = false, monochromeResult, invertedImageData = null, processedImageData;

  try {
    // Explicitly create a Buffer from the received data in the worker
    const imageBuffer = Buffer.from(buffer);
    image = await Jimp.read(imageBuffer);
    originalWidth = image.getWidth();
    originalHeight = image.getHeight();
    
    // Auto-crop
    croppedImage = image.clone();
    try {
      const originalSize = { width: croppedImage.getWidth(), height: croppedImage.getHeight() };
      croppedImage.autocrop({ cropOnlyFrames: false }); // Bỏ qua lỗi nếu có
      wasCropped = croppedImage.getWidth() !== originalSize.width || 
                   croppedImage.getHeight() !== originalSize.height;
    } catch (cropError) {
      console.warn('Worker Autocrop failed:', cropError.message);
      croppedImage = image.clone(); // Sử dụng ảnh gốc nếu crop lỗi
      wasCropped = false;
    }

    // Quality calculation
    qualityPercentage = Math.min(100, (croppedImage.getWidth() / RECOMMENDED_WIDTH) * 100);

    // Resize
    resizedImage = croppedImage.clone();
    if (resizedImage.getWidth() > MAX_WIDTH) {
      resizedImage.resize(MAX_WIDTH, Jimp.AUTO);
      wasResized = true;
    }

    // Monochrome check
    monochromeResult = detectMonochrome(resizedImage);

    // Invert if monochrome
    if (monochromeResult.isMonochrome) {
      try {
        const inverted = await createInvertedImage(resizedImage);
        invertedImageData = await inverted.getBase64Async(Jimp.MIME_PNG);
      } catch (invertError) {
        console.error('Worker Invert failed:', invertError);
      }
    }

    // Final processed image data
    processedImageData = await resizedImage.getBase64Async(Jimp.MIME_PNG);

    // Gửi kết quả thành công về luồng chính
    parentPort.postMessage({
      status: 'done',
      result: {
        originalWidth,
        originalHeight,
        processedWidth: resizedImage.getWidth(),
        processedHeight: resizedImage.getHeight(),
        qualityPercentage,
        processedImageData,
        invertedImageData,
        wasCropped,
        wasResized,
        monochromeResult
      }
    });

  } catch (error) {
    // Gửi lỗi về luồng chính
    console.error("Error processing image in worker:", error);
    parentPort.postMessage({ 
        status: 'error', 
        error: { message: error.message, stack: error.stack } 
    });
  }
}

// Lắng nghe tin nhắn từ luồng chính
parentPort.on('message', (message) => {
  if (message.buffer && message.config) {
    processImage(message.buffer, message.config);
  } else {
    parentPort.postMessage({ 
        status: 'error', 
        error: { message: 'Invalid message received by worker' } 
    });
  }
}); 