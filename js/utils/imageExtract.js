import { store } from '../store.js';
import { Toast } from './toast.js';

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB — mirrors backend/routers/imageExtract.router.js
const ALLOWED_TYPES = ['image/png', 'image/jpeg'];

let selectedFile = null;
let objectUrl = null;

function setStatus(el, message, tone = 'info') {
  if (!el) return;
  if (!message) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.classList.remove('hidden');
  el.textContent = message;
  el.dataset.tone = tone;
}

function resetSelection(dom) {
  selectedFile = null;
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
  dom.imageUploadInput.value = '';
  dom.imagePreviewCard.classList.add('hidden');
  dom.imagePreviewThumb.src = '';
  dom.imagePreviewName.textContent = '';
  dom.imageExtractBtn.disabled = true;
  setStatus(dom.imageExtractStatus, '');
  dom.imageOcrPreview.classList.add('hidden');
  dom.imageOcrText.classList.add('hidden');
  dom.imageOcrText.textContent = '';
  dom.imageOcrToggle.textContent = '▸ Show raw OCR text (fallback mode)';
  dom.imageOcrToggle.setAttribute('aria-expanded', 'false');
}

function selectFile(file, dom) {
  if (!file) return;

  if (!ALLOWED_TYPES.includes(file.type)) {
    Toast.show('Please choose a PNG or JPEG image', 'warning');
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    Toast.show('Image is too large (max 8MB)', 'warning');
    return;
  }

  selectedFile = file;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);

  dom.imagePreviewThumb.src = objectUrl;
  dom.imagePreviewName.textContent = `${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
  dom.imagePreviewCard.classList.remove('hidden');
  dom.imageExtractBtn.disabled = false;
  setStatus(dom.imageExtractStatus, '');
}

async function runExtraction(dom) {
  if (!selectedFile) return;

  dom.imageExtractBtn.disabled = true;
  setStatus(dom.imageExtractStatus, 'Reading image and extracting tasks… this can take up to a few seconds.', 'info');
  dom.imageOcrPreview.classList.add('hidden');

  const formData = new FormData();
  formData.append('image', selectedFile);

  try {
    const res = await fetch('/api/extract/image', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStatus(dom.imageExtractStatus, data.error || 'Image extraction failed. Please try again.', 'error');
      Toast.show(`❌ ${data.error || 'Image extraction failed'}`, 'error');
      dom.imageExtractBtn.disabled = false;
      return;
    }

    if (data.fallbackUsed) {
      setStatus(
        dom.imageExtractStatus,
        `⚠ Used OCR fallback instead of AI vision. Reason: ${data.fallbackReason}`,
        'warning'
      );
      Toast.show('⚠ AI vision unavailable — used OCR fallback instead', 'warning');

      if (data.ocrText) {
        dom.imageOcrPreview.classList.remove('hidden');
        dom.imageOcrText.textContent = data.ocrText;
      }
    } else {
      setStatus(dom.imageExtractStatus, `✅ Extracted ${data.tasks.length} task(s) from the image.`, 'success');
    }

    if (!data.tasks || data.tasks.length === 0) {
      Toast.show('No tasks found in this image. Try a clearer photo.', 'warning');
    } else {
      // Reuse the exact same extraction preview/edit/"Add to planner" flow
      // that text-based Smart Paste already uses.
      store.setExtracted(data.tasks);
      document.getElementById('extract-preview')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } catch (e) {
    console.error('Image extraction request failed', e);
    setStatus(dom.imageExtractStatus, 'Network error. Please try again.', 'error');
    Toast.show('❌ Network error while extracting from image', 'error');
  } finally {
    dom.imageExtractBtn.disabled = !selectedFile;
  }
}

export function initImageExtract() {
  const dom = {
    section: document.getElementById('image-extract-section'),
    dropZone: document.getElementById('image-drop-zone'),
    imageUploadInput: document.getElementById('image-upload-input'),
    imageUploadBtn: document.getElementById('image-upload-btn'),
    imagePreviewCard: document.getElementById('image-preview-card'),
    imagePreviewThumb: document.getElementById('image-preview-thumb'),
    imagePreviewName: document.getElementById('image-preview-name'),
    imageRemoveBtn: document.getElementById('image-remove-btn'),
    imageExtractBtn: document.getElementById('image-extract-btn'),
    imageExtractStatus: document.getElementById('image-extract-status'),
    imageOcrPreview: document.getElementById('image-ocr-preview'),
    imageOcrToggle: document.getElementById('image-ocr-toggle'),
    imageOcrText: document.getElementById('image-ocr-text'),
  };

  // Bail out quietly if the markup isn't present (keeps this module safe
  // to import without assuming index.html always has this section).
  if (!dom.section || !dom.dropZone || !dom.imageUploadInput) return;

  dom.imageUploadBtn.addEventListener('click', () => dom.imageUploadInput.click());

  dom.imageUploadInput.addEventListener('change', (e) => {
    selectFile(e.target.files?.[0], dom);
  });

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
    dom.dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    dom.dropZone.addEventListener(eventName, () => {
      dom.dropZone.classList.add('image-drop-zone--dragover');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dom.dropZone.addEventListener(eventName, () => {
      dom.dropZone.classList.remove('image-drop-zone--dragover');
    });
  });

  dom.dropZone.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) selectFile(file, dom);
  });

  dom.imageRemoveBtn.addEventListener('click', () => resetSelection(dom));

  dom.imageExtractBtn.addEventListener('click', () => runExtraction(dom));

  dom.imageOcrToggle.addEventListener('click', () => {
    const isHidden = dom.imageOcrText.classList.contains('hidden');
    dom.imageOcrText.classList.toggle('hidden', !isHidden);
    dom.imageOcrToggle.textContent = isHidden
      ? '▾ Hide raw OCR text'
      : '▸ Show raw OCR text (fallback mode)';
    dom.imageOcrToggle.setAttribute('aria-expanded', String(isHidden));
  });
}
