document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const dropArea = document.getElementById('drop-area');
  const fileInput = document.getElementById('file-input');
  const loading = document.getElementById('loading');
  const resultsSection = document.getElementById('results-section');
  const designGrid = document.getElementById('design-grid');
  const emptyMessage = document.getElementById('empty-message');
  const detailView = document.getElementById('detail-view');
  const backBtn = document.getElementById('back-btn');
  const detailImage = document.getElementById('detail-image');
  const detailWidth = document.getElementById('detail-width');
  const detailQuality = document.getElementById('detail-quality');
  const detailQualityBar = document.getElementById('detail-quality-bar');
  const detailFilename = document.getElementById('detail-filename');
  const detailOriginalSize = document.getElementById('detail-original-size');
  const detailFilesize = document.getElementById('detail-filesize');
  const detailRecommendation = document.getElementById('detail-recommendation');
  const monochromeWarning = document.getElementById('monochrome-warning');
  const monochromeMessage = document.getElementById('monochrome-message');
  const invertedContainer = document.getElementById('inverted-container');
  const invertedImage = document.getElementById('inverted-image');
  const downloadInverted = document.getElementById('download-inverted');
  const detailQualityText = document.getElementById('detail-quality-text');
  const errorMessageDiv = document.getElementById('error-message');
  const errorTextSpan = document.getElementById('error-text');
  
  // Store processed designs
  let processedDesigns = [];
  
  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });
  
  // Highlight drop area when dragging over it
  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
  });
  
  // Handle file events
  dropArea.addEventListener('drop', handleDrop, false);
  dropArea.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect, false);
  
  // Detail view events
  backBtn.addEventListener('click', showGrid);
  downloadInverted.addEventListener('click', handleDownloadInverted);
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  function highlight() {
    dropArea.style.backgroundColor = '#f0f7ff';
  }
  
  function unhighlight() {
    dropArea.style.backgroundColor = '';
  }
  
  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
      processMultipleFiles(files);
    } else {
      showError('Vui lòng kéo thả hoặc chọn ít nhất một file PNG.');
    }
  }
  
  function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
      processMultipleFiles(files);
    }
  }
  
  function processMultipleFiles(files) {
    showLoading();
    detailView.classList.add('hidden');
    
    hideError(); // Clear previous errors
    
    const pngFiles = Array.from(files).filter(file => file.type === 'image/png');
    
    if (pngFiles.length === 0) {
      showError('Không tìm thấy file PNG hợp lệ nào trong các file đã chọn.');
      hideLoading();
      return;
    }
    
    processedDesigns = [];
    let completedCount = 0;
    
    pngFiles.forEach(file => {
      const formData = new FormData();
      formData.append('design', file);
      
      fetch('/analyze', {
        method: 'POST',
        body: formData
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(err => { throw new Error(err.error || 'Server error') });
        }
        return response.json();
      })
      .then(data => {
        processedDesigns.push({
          file: file,
          data: data
        });
        
        completedCount++;
        if (completedCount >= pngFiles.length) {
          displayResults();
          hideLoading();
        }
      })
      .catch(error => {
        console.error('Error:', error);
        completedCount++;
        if (completedCount >= pngFiles.length) {
          showError(`Đã xảy ra lỗi khi xử lý một hoặc nhiều file. Chi tiết: ${error.message}`);
          displayResults();
          hideLoading();
        }
      });
    });
  }
  
  function displayResults() {
    if (processedDesigns.length === 0) {
      emptyMessage.classList.remove('hidden');
      designGrid.classList.add('hidden');
      return;
    }
    
    // Sort by quality (highest first)
    processedDesigns.sort((a, b) => b.data.qualityPercentage - a.data.qualityPercentage);
    
    // Clear grid and add designs
    designGrid.innerHTML = '';
    processedDesigns.forEach((item, index) => {
      const card = createDesignCard(item.file, item.data, index);
      designGrid.appendChild(card);
    });
    
    emptyMessage.classList.add('hidden');
    designGrid.classList.remove('hidden');
  }
  
  function createDesignCard(file, data, index) {
    const roundedQuality = Math.round(data.qualityPercentage);
    let qualityClass = roundedQuality >= 80 ? 'perfect' : (roundedQuality >= 50 ? 'good' : 'poor');
    let qualityText = roundedQuality >= 80 ? 'text-green-600' : (roundedQuality >= 50 ? 'text-yellow-600' : 'text-red-600');
    
    const card = document.createElement('div');
    card.className = 'design-card';
    card.dataset.index = index;
    
    // Make filename display shorter if needed
    let displayName = file.name;
    if (displayName.length > 18) {
      const ext = displayName.split('.').pop();
      displayName = displayName.substring(0, 15) + '...' + (ext ? '.' + ext : '');
    }
    
    card.innerHTML = `
      <div class="design-img-container">
        <img src="${data.processedImageData}" class="design-img" alt="${file.name}">
      </div>
      <div class="design-info">
        <div class="text-xs font-medium truncate mb-1" title="${file.name}">${displayName}</div>
        <div class="text-xs ${qualityText} font-bold mb-1">Print Quality: ${roundedQuality}%</div>
        <div class="progress-bar mb-1">
          <div class="progress-fill ${qualityClass}" style="width:${roundedQuality}%"></div>
        </div>
        <div class="text-xs text-gray-500">Design: ${data.originalWidth}×${data.originalHeight}px</div>
      </div>
    `;
    
    card.addEventListener('click', () => showDetail(index));
    
    return card;
  }
  
  function showDetail(index) {
    const item = processedDesigns[index];
    if (!item) return;
    
    const { file, data } = item;
    
    // Set basic info
    detailImage.src = data.processedImageData;
    detailFilename.textContent = file.name;
    detailOriginalSize.textContent = `${data.originalWidth}px × ${data.originalHeight}px`;
    detailFilesize.textContent = formatFileSize(data.fileSize);
    
    // Set quality
    const roundedQuality = Math.round(data.qualityPercentage);
    detailQualityText.textContent = `Print Quality: ${roundedQuality}%`;
    detailQualityBar.style.width = `${roundedQuality}%`;
    
    if (roundedQuality >= 80) {
      detailQualityBar.className = 'progress-fill perfect';
      detailRecommendation.textContent = 'Thiết kế của bạn có chất lượng in xuất sắc!';
      detailRecommendation.className = 'text-sm text-green-600';
    } else if (roundedQuality >= 50) {
      detailQualityBar.className = 'progress-fill good';
      detailRecommendation.textContent = 'Thiết kế của bạn có chất lượng in chấp nhận được, nhưng có thể cải thiện. Tăng chiều rộng gần hơn 4500px sẽ cho kết quả in tốt hơn.';
      detailRecommendation.className = 'text-sm text-yellow-600';
    } else {
      detailQualityBar.className = 'progress-fill poor';
      detailRecommendation.textContent = 'Thiết kế của bạn có chất lượng in thấp. Chúng tôi khuyến nghị tăng chiều rộng lên ít nhất 4500px để có kết quả tốt nhất.';
      detailRecommendation.className = 'text-sm text-red-600';
    }
    
    // Show or hide monochrome warning
    if (data.monochromeResult && data.monochromeResult.isMonochrome) {
      monochromeWarning.classList.remove('hidden');
      
      if (data.monochromeResult.isAllWhite) {
        monochromeMessage.textContent = 'Thiết kế của bạn toàn màu trắng. Chúng tôi đã tạo biến thể màu tối để sử dụng trên nền tối.';
      } else if (data.monochromeResult.isAllBlack) {
        monochromeMessage.textContent = 'Thiết kế của bạn toàn màu đen. Chúng tôi đã tạo biến thể màu sáng để sử dụng trên nền sáng.';
      }
      
      invertedContainer.style.display = 'block';
      invertedImage.src = data.invertedImageData;
    } else {
      monochromeWarning.classList.add('hidden');
      invertedContainer.style.display = 'none';
    }
    
    // Hide grid, show detail
    resultsSection.classList.add('hidden');
    detailView.classList.remove('hidden');
  }
  
  function showGrid() {
    detailView.classList.add('hidden');
    resultsSection.classList.remove('hidden');
  }
  
  function handleDownloadInverted() {
    const link = document.createElement('a');
    link.download = 'inverted-design.png';
    link.href = invertedImage.src;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  function showLoading() {
    loading.classList.remove('hidden');
    designGrid.classList.add('hidden');
    emptyMessage.classList.add('hidden');
  }
  
  function hideLoading() {
    loading.classList.add('hidden');
  }
  
  function formatFileSize(bytes) {
    if (bytes < 1024) {
      return bytes + ' bytes';
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    } else {
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
  }

  function showError(message) {
    errorTextSpan.textContent = message;
    errorMessageDiv.classList.remove('hidden');
  }

  function hideError() {
    errorMessageDiv.classList.add('hidden');
    errorTextSpan.textContent = '';
  }
}); 