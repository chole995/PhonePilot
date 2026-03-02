import { useEffect, useRef, useState, useCallback } from 'react';
import { createWorker, Worker, PSM } from 'tesseract.js';
import { validateMnemonic } from '@scure/bip39';
import { wordlist as bip39English } from '@scure/bip39/wordlists/english.js';
import './CameraPanel.css';

interface VideoDevice {
  deviceId: string;
  label: string;
}

interface OcrResult {
  text: string;
  confidence: number;
  timestamp: Date;
}

/** A single recognized mnemonic word with metadata */
interface MnemonicWord {
  index: number;
  word: string;
  original?: string;
  wordConfidence: number;
}

/** Stored mnemonic words from previous recognition */
interface StoredMnemonic {
  words: string[];
  timestamp: Date;
}

/**
 * Computes the Levenshtein (edit) distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

/**
 * Corrects an OCR word against the BIP39 English wordlist.
 * Returns the original word if it's already valid, or the closest BIP39 word.
 */
function correctToBip39(ocrWord: string): { word: string; corrected: boolean } {
  if (bip39English.includes(ocrWord)) {
    return { word: ocrWord, corrected: false };
  }
  let bestWord = ocrWord;
  let bestDist = Infinity;
  for (const w of bip39English) {
    const dist = levenshteinDistance(ocrWord, w);
    if (dist < bestDist) {
      bestDist = dist;
      bestWord = w;
    }
    if (dist === 0) break; // exact match shortcut
  }
  return { word: bestWord, corrected: bestDist > 0 && bestDist <= 3 };
}

/**
 * Returns the top-N BIP39 candidate words for an OCR word, sorted by Levenshtein distance.
 * Used for BIP39-guided auto-correction when checksum validation fails.
 */
function getBip39Candidates(ocrWord: string, topN: number = 5): { word: string; distance: number }[] {
  const candidates: { word: string; distance: number }[] = [];
  for (const w of bip39English) {
    const dist = levenshteinDistance(ocrWord, w);
    if (dist <= 3) {
      candidates.push({ word: w, distance: dist });
    }
  }
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates.slice(0, topN);
}

/**
 * Attempts BIP39 checksum-guided auto-correction on mnemonic words.
 * Sorts words by confidence (lowest first), then tries top BIP39 candidates
 * for each suspicious word until a valid mnemonic is found.
 * Mutates the mnemonicWords array in-place if correction succeeds.
 * Returns true if a valid mnemonic was found.
 */
function tryBip39AutoCorrect(mnemonicWords: MnemonicWord[]): boolean {
  if (mnemonicWords.length < 12) return false;

  const words = mnemonicWords.map(w => w.word);
  const phrase = words.join(' ');

  // Already valid
  try {
    if (validateMnemonic(phrase, bip39English)) return true;
  } catch { /* ignore */ }

  // Sort indices by confidence (lowest first) to prioritize suspicious words
  const sortedIndices = mnemonicWords
    .map((w, i) => ({ i, conf: w.wordConfidence }))
    .sort((a, b) => a.conf - b.conf)
    .map(e => e.i);

  // Try single-word substitution first (most common case: only 1 word is wrong)
  for (const idx of sortedIndices) {
    const originalWord = mnemonicWords[idx].original || mnemonicWords[idx].word;
    const candidates = getBip39Candidates(originalWord);

    for (const candidate of candidates) {
      if (candidate.word === mnemonicWords[idx].word) continue; // skip current

      const testWords = [...words];
      testWords[idx] = candidate.word;
      const testPhrase = testWords.join(' ');

      try {
        if (validateMnemonic(testPhrase, bip39English)) {
          console.log(`[BIP39 AutoCorrect] Fixed word #${mnemonicWords[idx].index}: "${mnemonicWords[idx].word}" -> "${candidate.word}" (conf: ${mnemonicWords[idx].wordConfidence.toFixed(0)}%)`);
          mnemonicWords[idx].original = mnemonicWords[idx].original || mnemonicWords[idx].word;
          mnemonicWords[idx].word = candidate.word;
          return true;
        }
      } catch { /* ignore */ }
    }
  }

  // Try two-word substitution for the 3 lowest-confidence words
  const suspectIndices = sortedIndices.slice(0, 3);
  for (let a = 0; a < suspectIndices.length; a++) {
    const idxA = suspectIndices[a];
    const candidatesA = getBip39Candidates(mnemonicWords[idxA].original || mnemonicWords[idxA].word);

    for (let b = a + 1; b < suspectIndices.length; b++) {
      const idxB = suspectIndices[b];
      const candidatesB = getBip39Candidates(mnemonicWords[idxB].original || mnemonicWords[idxB].word);

      for (const cA of candidatesA) {
        for (const cB of candidatesB) {
          const testWords = [...words];
          testWords[idxA] = cA.word;
          testWords[idxB] = cB.word;
          const testPhrase = testWords.join(' ');

          try {
            if (validateMnemonic(testPhrase, bip39English)) {
              console.log(`[BIP39 AutoCorrect] Fixed 2 words: #${mnemonicWords[idxA].index} "${mnemonicWords[idxA].word}"->"${cA.word}", #${mnemonicWords[idxB].index} "${mnemonicWords[idxB].word}"->"${cB.word}"`);
              mnemonicWords[idxA].original = mnemonicWords[idxA].original || mnemonicWords[idxA].word;
              mnemonicWords[idxA].word = cA.word;
              mnemonicWords[idxB].original = mnemonicWords[idxB].original || mnemonicWords[idxB].word;
              mnemonicWords[idxB].word = cB.word;
              return true;
            }
          } catch { /* ignore */ }
        }
      }
    }
  }

  console.log('[BIP39 AutoCorrect] Could not find valid mnemonic combination');
  return false;
}

/**
 * Calculates Otsu's threshold for optimal binarization.
 * Finds the threshold that minimizes intra-class variance.
 */
function calculateOtsuThreshold(histogram: number[], total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let maxVariance = 0;
  let threshold = 0;

  for (let i = 0; i < 256; i++) {
    wB += histogram[i];
    if (wB === 0) continue;

    wF = total - wB;
    if (wF === 0) break;

    sumB += i * histogram[i];

    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;

    const variance = wB * wF * (mB - mF) * (mB - mF);

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = i;
    }
  }

  return threshold;
}

/**
 * Applies adaptive local thresholding for better text extraction.
 * Uses a sliding window to calculate local thresholds.
 */
function applyAdaptiveThreshold(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  blockSize: number = 15,
  c: number = 10
): void {
  // Create integral image for fast local mean calculation
  const integral = new Float64Array((width + 1) * (height + 1));
  
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      rowSum += data[idx];
      integral[(y + 1) * (width + 1) + (x + 1)] = 
        rowSum + integral[y * (width + 1) + (x + 1)];
    }
  }

  // Apply adaptive threshold
  const halfBlock = Math.floor(blockSize / 2);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - halfBlock);
      const y1 = Math.max(0, y - halfBlock);
      const x2 = Math.min(width - 1, x + halfBlock);
      const y2 = Math.min(height - 1, y + halfBlock);
      
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      
      // Calculate local mean using integral image
      const sum = integral[(y2 + 1) * (width + 1) + (x2 + 1)]
                - integral[(y2 + 1) * (width + 1) + x1]
                - integral[y1 * (width + 1) + (x2 + 1)]
                + integral[y1 * (width + 1) + x1];
      
      const mean = sum / count;
      const threshold = mean - c;
      
      const idx = (y * width + x) * 4;
      const value = data[idx] > threshold ? 255 : 0;
      
      data[idx] = value;
      data[idx + 1] = value;
      data[idx + 2] = value;
    }
  }
}

/**
 * Applies morphological operations to clean up the image.
 * Removes small noise and fills small gaps in text.
 */
function applyMorphology(
  data: Uint8ClampedArray,
  width: number,
  height: number
): void {
  const temp = new Uint8ClampedArray(data.length);
  
  // Erosion followed by dilation (opening) - removes small white noise
  // Using a 3x3 kernel
  
  // Erosion
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let min = 255;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          min = Math.min(min, data[idx]);
        }
      }
      const idx = (y * width + x) * 4;
      temp[idx] = temp[idx + 1] = temp[idx + 2] = min;
      temp[idx + 3] = 255;
    }
  }
  
  // Dilation
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let max = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          max = Math.max(max, temp[idx]);
        }
      }
      const idx = (y * width + x) * 4;
      data[idx] = data[idx + 1] = data[idx + 2] = max;
    }
  }
}

/**
 * Preprocesses an image for better OCR accuracy.
 * Uses advanced techniques: Otsu thresholding, adaptive binarization, and morphology.
 */
function preprocessImageForOcr(
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement
): void {
  const sourceCtx = sourceCanvas.getContext('2d');
  const targetCtx = targetCanvas.getContext('2d');
  if (!sourceCtx || !targetCtx) return;

  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  
  targetCanvas.width = width;
  targetCanvas.height = height;

  // Get image data
  const imageData = sourceCtx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Step 1: Convert to grayscale and build histogram
  const histogram = new Array(256).fill(0);
  let totalBrightness = 0;
  
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    data[i] = data[i + 1] = data[i + 2] = gray;
    histogram[gray]++;
    totalBrightness += gray;
  }
  
  const pixelCount = data.length / 4;
  const avgBrightness = totalBrightness / pixelCount;
  const isDarkMode = avgBrightness < 128;
  
  console.log('Preprocessing - brightness:', avgBrightness.toFixed(1), 'darkMode:', isDarkMode);

  // Step 2: Invert if dark mode
  if (isDarkMode) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
    // Rebuild histogram after inversion
    histogram.fill(0);
    for (let i = 0; i < data.length; i += 4) {
      histogram[data[i]]++;
    }
  }

  // Step 3: Calculate Otsu threshold
  const otsuThreshold = calculateOtsuThreshold(histogram, pixelCount);
  console.log('Otsu threshold:', otsuThreshold);

  // Step 4: Apply contrast enhancement
  const contrast = 2.0;
  for (let i = 0; i < data.length; i += 4) {
    let gray = data[i];
    // Normalize around Otsu threshold for better separation
    const factor = (259 * (contrast * 100 + 255)) / (255 * (259 - contrast * 100));
    gray = Math.max(0, Math.min(255, factor * (gray - otsuThreshold) + 128));
    data[i] = data[i + 1] = data[i + 2] = gray;
  }

  // Step 5: Apply adaptive thresholding for final binarization
  applyAdaptiveThreshold(data, width, height, 25, 15);
  
  // Step 6: Apply morphological cleaning
  applyMorphology(data, width, height);

  targetCtx.putImageData(imageData, 0, 0);
}

/** Fixed OCR region of interest (ROI) for mnemonic recognition at X85Y0 position */
const OCR_ROI = { x: 230, y: 440, width: 680, height: 1110 } as const;

/** Verification page ROI: focused region for "#N" number detection (tight crop around number area) */
const VERIFY_NUMBER_ROI = { x: 230, y: 480, width: 400, height: 130 } as const;

/** Verification page ROI: bottom region for 3 option words */
const VERIFY_OPTIONS_ROI = { x: 230, y: 1100, width: 680, height: 450 } as const;

function CameraPanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ocrCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<VideoDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [showCrosshair, setShowCrosshair] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [storedMnemonic, setStoredMnemonic] = useState<StoredMnemonic | null>(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [numberImageUrl, setNumberImageUrl] = useState<string | null>(null);
  const ocrWorkerRef = useRef<Worker | null>(null);

  /**
   * Captures the current video frame as a base64-encoded JPEG image.
   * Rotates the frame 90 degrees clockwise to match the UI display (9:16 portrait).
   * Used by MCP Server via IPC to get camera frames.
   */
  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < 2) {
      console.warn('Video not ready for capture');
      return null;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('Failed to get canvas context');
      return null;
    }

    // Rotate 90 degrees clockwise: swap width and height for 9:16 portrait output
    canvas.width = video.videoHeight;
    canvas.height = video.videoWidth;

    // Save context state
    ctx.save();

    // Translate to center, rotate 90 degrees clockwise, then draw
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(
      video,
      -video.videoWidth / 2,
      -video.videoHeight / 2,
      video.videoWidth,
      video.videoHeight
    );

    // Restore context state
    ctx.restore();

    // Convert to base64 JPEG (without the data:image/jpeg;base64, prefix)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

    return base64;
  }, []);

  /** Expected number of mnemonic words */
  const EXPECTED_MNEMONIC_COUNT = 12;
  /** Maximum retry attempts for OCR */
  const MAX_OCR_RETRIES = 3;
  /** Delay between retries in milliseconds */
  const OCR_RETRY_DELAY = 500;

  /**
   * Initializes the Tesseract OCR worker if not already done.
   */
  const ensureOcrWorker = useCallback(async () => {
    if (!ocrWorkerRef.current) {
      console.log('Initializing Tesseract.js worker...');
      ocrWorkerRef.current = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR progress: ${(m.progress * 100).toFixed(0)}%`);
          }
        },
      });

      await ocrWorkerRef.current.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.# ',
      });

      console.log('Tesseract.js worker initialized');
    }
    return ocrWorkerRef.current;
  }, []);

  /**
   * Captures a frame, crops to the given region, preprocesses, and runs OCR.
   * Returns raw text, confidence, and the cropped image data URL.
   */
  const runOcrOnRegion = useCallback(async (
    roi: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  ): Promise<{ rawText: string; confidence: number; imageDataUrl: string; words: { text: string; confidence: number }[] } | null> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ocrCanvas = ocrCanvasRef.current;

    if (!video || !canvas || !ocrCanvas || video.readyState < 2) {
      return null;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Rotate 90 degrees clockwise: swap width and height for portrait output
    canvas.width = video.videoHeight;
    canvas.height = video.videoWidth;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(
      video,
      -video.videoWidth / 2,
      -video.videoHeight / 2,
      video.videoWidth,
      video.videoHeight
    );
    ctx.restore();

    // Crop to specified ROI region
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = roi.width;
    cropCanvas.height = roi.height;
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) return null;
    cropCtx.drawImage(
      canvas,
      roi.x, roi.y, roi.width, roi.height,
      0, 0, roi.width, roi.height
    );

    // Capture the cropped image as a data URL for display (original resolution)
    const imageDataUrl = cropCanvas.toDataURL('image/jpeg', 0.85);

    // Upscale 3x for better OCR accuracy on small text
    const scale = 3;
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = roi.width * scale;
    scaledCanvas.height = roi.height * scale;
    const scaledCtx = scaledCanvas.getContext('2d');
    if (!scaledCtx) return null;
    scaledCtx.imageSmoothingEnabled = true;
    scaledCtx.imageSmoothingQuality = 'high';
    scaledCtx.drawImage(cropCanvas, 0, 0, scaledCanvas.width, scaledCanvas.height);

    // Preprocess upscaled image for better OCR
    preprocessImageForOcr(scaledCanvas, ocrCanvas);

    const worker = await ensureOcrWorker();
    const result = await worker.recognize(ocrCanvas);

    // Extract word-level data from Tesseract's nested structure
    const ocrWords: { text: string; confidence: number }[] = [];
    if (result.data.blocks) {
      for (const block of result.data.blocks) {
        for (const para of block.paragraphs) {
          for (const line of para.lines) {
            for (const word of line.words) {
              ocrWords.push({ text: word.text, confidence: word.confidence });
            }
          }
        }
      }
    }

    return {
      rawText: result.data.text,
      confidence: result.data.confidence,
      imageDataUrl,
      words: ocrWords,
    };
  }, [ensureOcrWorker]);

  /**
   * Captures a frame, crops to the number region, and runs OCR optimized for detecting
   * a single number 1-12 (used for verification page "#N" detection).
   * Uses 4x upscaling and digits-only whitelist for maximum accuracy.
   */
  const runNumberOcr = useCallback(async (): Promise<{ number: number; rawText: string; confidence: number; imageDataUrl: string } | null> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ocrCanvas = ocrCanvasRef.current;

    if (!video || !canvas || !ocrCanvas || video.readyState < 2) {
      return null;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Rotate 90 degrees clockwise
    canvas.width = video.videoHeight;
    canvas.height = video.videoWidth;
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(video, -video.videoWidth / 2, -video.videoHeight / 2, video.videoWidth, video.videoHeight);
    ctx.restore();

    // Crop to tight number region
    const roi = VERIFY_NUMBER_ROI;
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = roi.width;
    cropCanvas.height = roi.height;
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) return null;
    cropCtx.drawImage(canvas, roi.x, roi.y, roi.width, roi.height, 0, 0, roi.width, roi.height);

    // Capture the cropped image for display
    const imageDataUrl = cropCanvas.toDataURL('image/jpeg', 0.85);

    // Upscale 4x for small number detection
    const scale = 4;
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = roi.width * scale;
    scaledCanvas.height = roi.height * scale;
    const scaledCtx = scaledCanvas.getContext('2d');
    if (!scaledCtx) return null;
    scaledCtx.imageSmoothingEnabled = true;
    scaledCtx.imageSmoothingQuality = 'high';
    scaledCtx.drawImage(cropCanvas, 0, 0, scaledCanvas.width, scaledCanvas.height);

    // Preprocess
    preprocessImageForOcr(scaledCanvas, ocrCanvas);

    // Use digits-only whitelist for number detection
    const worker = await ensureOcrWorker();
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789# ',
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    });

    const result = await worker.recognize(ocrCanvas);

    // Restore full whitelist for subsequent OCR calls
    await worker.setParameters({
      tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.# ',
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    });

    const rawText = result.data.text;
    const confidence = result.data.confidence;

    console.log(`[CameraPanel] Number OCR raw: "${rawText.trim()}", confidence: ${confidence.toFixed(0)}%`);

    // Extract all digit sequences and find the first valid 1-12
    const digitMatches = rawText.match(/\d+/g) || [];
    let detectedNumber = -1;
    for (const digits of digitMatches) {
      const num = parseInt(digits, 10);
      if (num >= 1 && num <= 12) {
        detectedNumber = num;
        break;
      }
    }

    if (detectedNumber === -1) return null;

    return { number: detectedNumber, rawText, confidence, imageDataUrl };
  }, [ensureOcrWorker]);

  /**
   * Captures current frame and runs OCR recognition on the standard mnemonic ROI.
   * Applies BIP39 wordlist correction to fix misrecognized words.
   * Returns the recognized mnemonic words or null if failed.
   */
  const runSingleOcr = useCallback(async (): Promise<{
    mnemonicWords: MnemonicWord[];
    rawText: string;
    confidence: number;
    imageDataUrl: string;
    bip39Valid: boolean;
  } | null> => {
    const result = await runOcrOnRegion(OCR_ROI);
    if (!result) return null;

    // Build a lookup: lowercase OCR word text -> Tesseract confidence
    const wordConfidenceMap = new Map<string, number>();
    for (const w of result.words) {
      const clean = w.text.replace(/[^a-zA-Z]/g, '').toLowerCase();
      if (clean.length >= 2) {
        wordConfidenceMap.set(clean, w.confidence);
      }
    }

    // Extract numbered mnemonic words
    const mnemonicPattern = /(\d+)\.\s*([a-zA-Z]{3,12})/g;
    const mnemonicWords: MnemonicWord[] = [];
    let match;

    while ((match = mnemonicPattern.exec(result.rawText)) !== null) {
      const index = parseInt(match[1], 10);
      const ocrWord = match[2].toLowerCase();

      // Auto-correct against BIP39 wordlist
      const correction = correctToBip39(ocrWord);
      const wordConf = wordConfidenceMap.get(ocrWord) ?? result.confidence;

      mnemonicWords.push({
        index,
        word: correction.word,
        original: correction.corrected ? ocrWord : undefined,
        wordConfidence: wordConf,
      });
    }

    // Sort by original index number
    mnemonicWords.sort((a, b) => a.index - b.index);

    // Validate the full mnemonic against BIP39 checksum
    let bip39Valid = false;
    if (mnemonicWords.length >= 12) {
      const phrase = mnemonicWords.map(w => w.word).join(' ');
      try {
        bip39Valid = validateMnemonic(phrase, bip39English);
      } catch {
        bip39Valid = false;
      }
      console.log(`BIP39 validation: ${bip39Valid ? 'VALID' : 'INVALID'} - "${phrase}"`);

      // If BIP39 invalid, attempt smart auto-correction on low-confidence words
      if (!bip39Valid) {
        const corrected = tryBip39AutoCorrect(mnemonicWords);
        if (corrected) {
          bip39Valid = true;
          console.log(`BIP39 auto-correction succeeded!`);
        }
      }
    }

    return { mnemonicWords, bip39Valid, ...result };
  }, [runOcrOnRegion]);

  /**
   * Performs OCR recognition on the current camera frame.
   * Automatically retries if the result doesn't meet expectations.
   */
  const performOcr = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < 2) {
      console.warn('Video not ready for OCR');
      return;
    }

    setIsOcrProcessing(true);
    setOcrResult(null);
    setCapturedImageUrl(null);

    try {
      let bestResult: {
        mnemonicWords: MnemonicWord[];
        rawText: string;
        confidence: number;
        imageDataUrl: string;
        bip39Valid: boolean;
      } | null = null;

      // Try OCR with retries
      for (let attempt = 1; attempt <= MAX_OCR_RETRIES; attempt++) {
        console.log(`OCR attempt ${attempt}/${MAX_OCR_RETRIES}...`);
        
        const result = await runSingleOcr();
        
        if (!result) {
          console.warn('OCR attempt failed');
          continue;
        }

        console.log(`Attempt ${attempt}: Found ${result.mnemonicWords.length} words, confidence: ${result.confidence.toFixed(0)}%`);

        // Keep track of best result
        if (!bestResult || result.mnemonicWords.length > bestResult.mnemonicWords.length) {
          bestResult = result;
        }

        // Check if result meets expectations
        if (result.mnemonicWords.length >= EXPECTED_MNEMONIC_COUNT) {
          console.log(`Success! Found ${result.mnemonicWords.length} mnemonic words.`);
          bestResult = result;
          break;
        }

        // Wait before retry
        if (attempt < MAX_OCR_RETRIES) {
          console.log(`Retrying in ${OCR_RETRY_DELAY}ms...`);
          await new Promise(resolve => setTimeout(resolve, OCR_RETRY_DELAY));
        }
      }

      // Analyze the result to determine page type
      const rawText = bestResult?.rawText || '';
      
      // Check if this is a mnemonic display page (has numbered words like "1. bike")
      const hasNumberedWords = bestResult && bestResult.mnemonicWords.length >= 3;
      
      // Check if this is a verification page:
      // 1. Has stored mnemonic
      // 2. No numbered words (or very few)
      // 3. Has some word options
      const isVerificationPage = storedMnemonic && 
        storedMnemonic.words.length > 0 && 
        (!hasNumberedWords || (bestResult && bestResult.mnemonicWords.length < 3));
      
      // Try to extract word index from various patterns: "#1", "#4", "1", etc.
      let wordIndex = 1;
      const indexPatterns = [
        /#(\d+)/,           // #1, #4
        /[#＃]\s*(\d+)/,    // # 1, ＃4
        /\b([1-9]|1[0-2])\b(?!\s*\.)/,  // standalone 1-12 not followed by .
      ];
      
      for (const pattern of indexPatterns) {
        const match = rawText.match(pattern);
        if (match) {
          const idx = parseInt(match[1], 10);
          if (idx >= 1 && idx <= 12) {
            wordIndex = idx;
            break;
          }
        }
      }
      
      if (isVerificationPage) {
        // Verification page detected
        const expectedWord = storedMnemonic.words[wordIndex - 1];
        
        // Extract option words (words without numbers, 3-12 chars)
        const optionWords = rawText
          .split(/[\s\n]+/)
          .map(w => w.toLowerCase().replace(/[^a-z]/g, ''))
          .filter(w => w.length >= 3 && w.length <= 12)
          // Remove common noise words
          .filter(w => !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'one', 'sen', 'aen', 'wrt', 'kis', 'linea', 'echsn', 'pre', 'twn', 'koz', 'linn', 'iabechon', 'onekey'].includes(w));
        
        // Find unique options (dedupe)
        const uniqueOptions = [...new Set(optionWords)];
        
        // Try to match with stored mnemonic words to filter noise
        const validOptions = uniqueOptions.filter(opt => 
          storedMnemonic.words.includes(opt) || 
          storedMnemonic.words.some(w => w.startsWith(opt) || opt.startsWith(w))
        );
        
        const displayOptions = validOptions.length > 0 ? validOptions : uniqueOptions;
        
        console.log('Verification page detected - Word #', wordIndex);
        console.log('Expected word:', expectedWord);
        console.log('Options found:', displayOptions);
        
        // Check if expected word is in options
        const correctOption = displayOptions.find(opt => opt === expectedWord);
        
        let resultText = `验证单词 #${wordIndex}\n`;
        resultText += `正确答案: ${expectedWord?.toUpperCase() || '未知'}\n\n`;
        resultText += `识别到的选项: ${displayOptions.join(', ')}\n`;
        
        if (correctOption) {
          resultText += `\n✓ 请选择: ${correctOption.toUpperCase()}`;
        } else if (expectedWord) {
          // Try fuzzy match
          const fuzzyMatch = displayOptions.find(opt => 
            expectedWord.includes(opt) || opt.includes(expectedWord)
          );
          if (fuzzyMatch) {
            resultText += `\n✓ 请选择: ${fuzzyMatch.toUpperCase()} (模糊匹配)`;
          } else {
            resultText += `\n⚠ 未在选项中找到 "${expectedWord}"`;
          }
        }
        
        setOcrResult({
          text: resultText,
          confidence: bestResult?.confidence || 0,
          timestamp: new Date(),
        });
      } else if (bestResult && bestResult.mnemonicWords.length > 0) {
        // Mnemonic display page - save the words and captured image
        if (bestResult.mnemonicWords.length >= EXPECTED_MNEMONIC_COUNT) {
          const words = bestResult.mnemonicWords.map(item => item.word);
          setStoredMnemonic({
            words,
            timestamp: new Date(),
          });
          console.log('Saved mnemonic words:', words);
        }

        // Display the captured image
        setCapturedImageUrl(bestResult.imageDataUrl);

        const hasFull = bestResult.mnemonicWords.length >= EXPECTED_MNEMONIC_COUNT;
        const hasCorrections = bestResult.mnemonicWords.some(item => item.original);
        const statusText = hasFull
          ? `✓ 已保存 ${bestResult.mnemonicWords.length} 个助记词:`
          : `识别到 ${bestResult.mnemonicWords.length} 个助记词 (预期 ${EXPECTED_MNEMONIC_COUNT} 个):`;

        const wordLines = bestResult.mnemonicWords.map((item) => {
          const confTag = `[${item.wordConfidence.toFixed(0)}%]`;
          if (item.original) {
            return `${item.index}. ${item.original} -> ${item.word} (corrected) ${confTag}`;
          }
          return `${item.index}. ${item.word} ${confTag}`;
        }).join('\n');

        const validationLine = hasFull
          ? `\nBIP39 checksum: ${bestResult.bip39Valid ? 'valid' : 'INVALID'}${hasCorrections ? ' (有自动修正)' : ''}`
          : '';
        
        setOcrResult({
          text: `${statusText}\n${wordLines}${validationLine}`,
          confidence: bestResult.confidence,
          timestamp: new Date(),
        });
      } else {
        // Fallback - unknown page type
        const words = rawText
          .split(/[\s\n]+/)
          .map(w => w.toLowerCase().replace(/[^a-z]/g, ''))
          .filter(w => w.length >= 3 && w.length <= 12);
        
        setOcrResult({
          text: words.length > 0 
            ? `识别到 ${words.length} 个单词:\n${words.join(', ')}`
            : '(No text detected)',
          confidence: bestResult?.confidence || 0,
          timestamp: new Date(),
        });
      }
    } catch (err) {
      console.error('OCR failed:', err);
      setOcrResult({
        text: `OCR Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        confidence: 0,
        timestamp: new Date(),
      });
    } finally {
      setIsOcrProcessing(false);
    }
  }, [runSingleOcr, storedMnemonic]);

  // Get list of video devices
  const getVideoDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices
        .filter((device) => device.kind === 'videoinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
        }));
      setDevices(videoDevices);
      return videoDevices;
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
      return [];
    }
  }, []);

  /**
   * Applies manual focus mode to disable autofocus and prevent camera shake.
   * Falls back gracefully if the camera doesn't support manual focus.
   */
  const applyManualFocus = async (videoTrack: MediaStreamTrack) => {
    try {
      const capabilities = videoTrack.getCapabilities() as MediaTrackCapabilities & {
        focusMode?: string[];
        focusDistance?: { min: number; max: number };
      };

      if (capabilities.focusMode?.includes('manual')) {
        await videoTrack.applyConstraints({
          // @ts-expect-error focusMode is not in standard TypeScript types
          focusMode: 'manual',
        });
        console.log('Manual focus mode enabled');
      } else if (capabilities.focusMode?.includes('continuous')) {
        await videoTrack.applyConstraints({
          // @ts-expect-error focusMode is not in standard TypeScript types
          focusMode: 'continuous',
        });
        console.log('Continuous focus mode enabled (manual not supported)');
      } else {
        console.log('Focus mode control not supported by this camera');
      }
    } catch (err) {
      console.warn('Failed to set focus mode:', err);
    }
  };

  /**
   * Starts the camera with optional device ID.
   * Configures manual focus to prevent autofocus hunting during movement.
   */
  const startCamera = useCallback(async (deviceId?: string) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        if (settings.deviceId) {
          setSelectedDeviceId(settings.deviceId);
        }

        await applyManualFocus(videoTrack);
      }

      setError(null);
    } catch (err) {
      console.error('Failed to access camera:', err);
      setError('Failed to access camera. Please ensure camera permissions are granted.');
    }
  }, []);

  // Initialize camera on mount and set up IPC listener for frame capture
  useEffect(() => {
    const initCamera = async () => {
      // First, get camera permission with any camera
      await startCamera();

      // Get device list (labels available after permission)
      const videoDevices = await getVideoDevices();

      // Find DECXIN camera
      const decxinDevice = videoDevices.find((device) =>
        device.label.toUpperCase().includes('DECXIN')
      );

      // If DECXIN found, switch to it
      if (decxinDevice) {
        await startCamera(decxinDevice.deviceId);
      }
    };

    initCamera();

    // Set up IPC listener for frame capture requests from MCP Server
    const unsubscribe = window.electronAPI?.onCaptureFrameRequest?.(() => {
      const frame = captureFrame();
      window.electronAPI?.sendCaptureFrameResponse?.(frame);
    });

    // Cleanup on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (ocrWorkerRef.current) {
        ocrWorkerRef.current.terminate();
        ocrWorkerRef.current = null;
      }
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureFrame]);

  // Listen for external OCR trigger events (from ControlPanel sequence executor)
  useEffect(() => {
    const handleTriggerOcr = async () => {
      console.log('[CameraPanel] External OCR trigger received');
      setIsOcrProcessing(true);
      setCapturedImageUrl(null);

      let bestWords: MnemonicWord[] = [];
      let bestConfidence = 0;
      let bestImageDataUrl = '';
      let bestBip39Valid = false;

      try {
        for (let attempt = 1; attempt <= MAX_OCR_RETRIES; attempt++) {
          console.log(`[CameraPanel] OCR attempt ${attempt}/${MAX_OCR_RETRIES}...`);
          const result = await runSingleOcr();
          if (!result) continue;

          if (result.mnemonicWords.length > bestWords.length) {
            bestWords = result.mnemonicWords;
            bestConfidence = result.confidence;
            bestImageDataUrl = result.imageDataUrl;
            bestBip39Valid = result.bip39Valid;
          }

          // If we found all words and BIP39 is valid, we're done
          if (result.mnemonicWords.length >= EXPECTED_MNEMONIC_COUNT && result.bip39Valid) {
            console.log(`[CameraPanel] Found ${result.mnemonicWords.length} words, BIP39 valid, done.`);
            break;
          }

          if (result.mnemonicWords.length >= EXPECTED_MNEMONIC_COUNT) {
            console.log(`[CameraPanel] Found ${result.mnemonicWords.length} words (BIP39 ${result.bip39Valid ? 'valid' : 'invalid'}), done.`);
            break;
          }

          if (attempt < MAX_OCR_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, OCR_RETRY_DELAY));
          }
        }

        const words = bestWords.map((w) => w.word);

        // Update local CameraPanel display
        if (bestWords.length > 0) {
          // Display the captured image
          setCapturedImageUrl(bestImageDataUrl);

          const hasCorrections = bestWords.some(w => w.original);
          const hasFull = bestWords.length >= EXPECTED_MNEMONIC_COUNT;

          const wordLines = bestWords.map((w) => {
            const confTag = `[${w.wordConfidence.toFixed(0)}%]`;
            if (w.original) {
              return `${w.index}. ${w.original} -> ${w.word} (corrected) ${confTag}`;
            }
            return `${w.index}. ${w.word} ${confTag}`;
          }).join('\n');

          const validationLine = hasFull
            ? `\nBIP39 checksum: ${bestBip39Valid ? 'valid' : 'INVALID'}${hasCorrections ? ' (有自动修正)' : ''}`
            : '';

          setOcrResult({
            text: `✓ 自动识别到 ${bestWords.length} 个助记词:\n${wordLines}${validationLine}`,
            confidence: bestConfidence,
            timestamp: new Date(),
          });

          if (words.length >= EXPECTED_MNEMONIC_COUNT) {
            setStoredMnemonic({ words, timestamp: new Date() });
          }
        }

        // Dispatch result back to sequence executor
        window.dispatchEvent(
          new CustomEvent('phonepilot:ocr-result', {
            detail: { words, confidence: bestConfidence },
          })
        );
      } catch (err) {
        console.error('[CameraPanel] Triggered OCR failed:', err);
        window.dispatchEvent(
          new CustomEvent('phonepilot:ocr-result', {
            detail: { words: [], confidence: 0 },
          })
        );
      } finally {
        setIsOcrProcessing(false);
      }
    };

    window.addEventListener('phonepilot:trigger-ocr', handleTriggerOcr);
    return () => window.removeEventListener('phonepilot:trigger-ocr', handleTriggerOcr);
  }, [runSingleOcr]);

  // Listen for verification OCR trigger events (from ControlPanel verification steps)
  useEffect(() => {
    /**
     * Fuzzy match an OCR word against stored mnemonic words.
     * Returns the best matching mnemonic word if similarity is high enough.
     */
    const fuzzyMatchMnemonic = (ocrWord: string, mnemonicWords: string[]): string | null => {
      // Exact match
      if (mnemonicWords.includes(ocrWord)) return ocrWord;
      // Prefix/substring match
      for (const w of mnemonicWords) {
        if (w.startsWith(ocrWord) || ocrWord.startsWith(w)) return w;
      }
      // Character overlap: at least 60% of characters match in order
      for (const w of mnemonicWords) {
        const shorter = Math.min(ocrWord.length, w.length);
        if (shorter < 2) continue;
        let matches = 0;
        let j = 0;
        for (let i = 0; i < ocrWord.length && j < w.length; i++) {
          if (ocrWord[i] === w[j]) { matches++; j++; }
        }
        if (matches >= shorter * 0.6 && matches >= 2) return w;
      }
      return null;
    };

    const handleTriggerVerifyOcr = async () => {
      console.log('[CameraPanel] Verification OCR trigger received');
      setIsOcrProcessing(true);
      setCapturedImageUrl(null);
      setNumberImageUrl(null);

      try {
        // --- Pass 1: Focused number OCR to detect "#N" (digits-only, 4x upscale) ---
        let wordIndex = -1;
        let numberImageUrl = '';
        let numberRawText = '';
        let numberConfidence = 0;
        for (let attempt = 1; attempt <= MAX_OCR_RETRIES; attempt++) {
          console.log(`[CameraPanel] Verify number OCR attempt ${attempt}/${MAX_OCR_RETRIES}...`);
          const numberResult = await runNumberOcr();

          if (numberResult) {
            wordIndex = numberResult.number;
            numberImageUrl = numberResult.imageDataUrl;
            numberRawText = numberResult.rawText.trim();
            numberConfidence = numberResult.confidence;
            console.log(`[CameraPanel] Detected #${wordIndex} (confidence: ${numberResult.confidence.toFixed(0)}%)`);
            break;
          }

          // Even if number detection failed, keep the last image for debugging
          if (!numberImageUrl) {
            // Re-capture a frame just for the image (use runOcrOnRegion which returns imageDataUrl)
            const fallbackResult = await runOcrOnRegion(VERIFY_NUMBER_ROI);
            if (fallbackResult) {
              numberImageUrl = fallbackResult.imageDataUrl;
              numberRawText = fallbackResult.rawText.trim();
              numberConfidence = fallbackResult.confidence;
            }
          }

          if (attempt < MAX_OCR_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, OCR_RETRY_DELAY));
          }
        }

        // Show the number region image for debugging
        if (numberImageUrl) {
          setNumberImageUrl(numberImageUrl);
        }

        console.log(`[CameraPanel] Final detected word index: #${wordIndex}`);

        // --- Pass 2: OCR on options region (bottom of screen) to detect 3 words ---
        let optionsText = '';
        let optionsConfidence = 0;
        let optionsImageDataUrl = '';

        for (let attempt = 1; attempt <= MAX_OCR_RETRIES; attempt++) {
          console.log(`[CameraPanel] Verify options OCR attempt ${attempt}/${MAX_OCR_RETRIES}...`);
          const optionsResult = await runOcrOnRegion(VERIFY_OPTIONS_ROI);
          if (!optionsResult) continue;

          console.log(`[CameraPanel] Options region text: "${optionsResult.rawText.trim()}", confidence: ${optionsResult.confidence.toFixed(0)}%`);

          if (optionsResult.confidence > optionsConfidence) {
            optionsText = optionsResult.rawText;
            optionsConfidence = optionsResult.confidence;
            optionsImageDataUrl = optionsResult.imageDataUrl;
          }

          if (optionsResult.confidence >= 50) break;

          if (attempt < MAX_OCR_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, OCR_RETRY_DELAY));
          }
        }

        // Display the options region image
        setCapturedImageUrl(optionsImageDataUrl);

        // Look up the correct word from stored mnemonic
        const correctWord = storedMnemonic && wordIndex >= 1
          ? storedMnemonic.words[wordIndex - 1]
          : null;

        // Extract and fuzzy-match option words against stored mnemonic
        const allWords = optionsText
          .split(/[\s\n]+/)
          .map(w => w.toLowerCase().replace(/[^a-z]/g, ''))
          .filter(w => w.length >= 2);

        // Match each OCR word against stored mnemonic with fuzzy logic
        const matchedOptions: string[] = [];
        if (storedMnemonic) {
          for (const ocrWord of allWords) {
            const matched = fuzzyMatchMnemonic(ocrWord, storedMnemonic.words);
            if (matched && !matchedOptions.includes(matched)) {
              matchedOptions.push(matched);
            }
          }
        }

        // Find which option index matches the correct word
        let optionIndex = -1;
        if (correctWord && matchedOptions.length > 0) {
          optionIndex = matchedOptions.indexOf(correctWord);
        }

        console.log(`[CameraPanel] Verify: word #${wordIndex}, correct="${correctWord}", options=[${matchedOptions.join(', ')}], optionIndex=${optionIndex}`);

        // Update display
        let resultText = `验证单词 #${wordIndex}`;
        resultText += ` (数字OCR: "${numberRawText}", 置信度: ${numberConfidence.toFixed(0)}%)\n`;
        resultText += `正确答案: ${correctWord?.toUpperCase() || '未知'}\n`;
        resultText += `识别选项: ${matchedOptions.join(', ')}\n`;
        if (optionIndex >= 0) {
          resultText += `\n-> 点击选项 ${optionIndex + 1}: ${matchedOptions[optionIndex].toUpperCase()}`;
        } else {
          resultText += '\n-> 未找到匹配选项';
        }

        setOcrResult({
          text: resultText,
          confidence: optionsConfidence,
          timestamp: new Date(),
        });

        // Dispatch result back to sequence executor
        window.dispatchEvent(
          new CustomEvent('phonepilot:verify-ocr-result', {
            detail: { optionIndex, wordIndex, correctWord: correctWord || '' },
          })
        );
      } catch (err) {
        console.error('[CameraPanel] Verification OCR failed:', err);
        window.dispatchEvent(
          new CustomEvent('phonepilot:verify-ocr-result', {
            detail: { optionIndex: -1, wordIndex: -1, correctWord: '' },
          })
        );
      } finally {
        setIsOcrProcessing(false);
      }
    };

    window.addEventListener('phonepilot:trigger-verify-ocr', handleTriggerVerifyOcr);
    return () => window.removeEventListener('phonepilot:trigger-verify-ocr', handleTriggerVerifyOcr);
  }, [runOcrOnRegion, runNumberOcr, storedMnemonic]);

  // Handle device selection change
  const handleDeviceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = event.target.value;
    startCamera(deviceId);
  };

  return (
    <div className="camera-panel">
      {/* Hidden canvases for frame capture and OCR preprocessing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <canvas ref={ocrCanvasRef} style={{ display: 'none' }} />

      {devices.length > 1 && (
        <div className="camera-controls">
          <select
            value={selectedDeviceId}
            onChange={handleDeviceChange}
            className="device-select"
          >
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="camera-container">
        <div className="camera-viewport">
          {error ? (
            <div className="camera-error">
              <span className="error-icon">📷</span>
              <p>{error}</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              className="camera-video"
              autoPlay
              playsInline
              muted
            />
          )}
          {showCrosshair && <div className="overlay-crosshair" />}
          {showGrid && <div className="overlay-grid" />}
        </div>
      </div>

      <div className="overlay-controls">
        <button
          className={`overlay-btn ${showCrosshair ? 'active' : ''}`}
          onClick={() => setShowCrosshair(!showCrosshair)}
        >
          十字线
        </button>
        <button
          className={`overlay-btn ${showGrid ? 'active' : ''}`}
          onClick={() => setShowGrid(!showGrid)}
        >
          网格
        </button>
        <button
          className={`overlay-btn ocr-btn ${isOcrProcessing ? 'processing' : ''}`}
          onClick={performOcr}
          disabled={isOcrProcessing}
        >
          {isOcrProcessing ? 'OCR...' : 'OCR 识别'}
        </button>
        {storedMnemonic && (
          <span className="mnemonic-indicator" title={`已保存 ${storedMnemonic.words.length} 个助记词`}>
            ✓ {storedMnemonic.words.length}词
          </span>
        )}
      </div>

      {ocrResult && (
        <div className="ocr-result">
          <div className="ocr-result-header">
            <span className="ocr-result-title">OCR 结果</span>
            <span className="ocr-result-confidence">
              置信度: {ocrResult.confidence.toFixed(0)}%
            </span>
            <span className="ocr-result-time">
              {ocrResult.timestamp.toLocaleTimeString()}
            </span>
            <button
              className="ocr-result-close"
              onClick={() => { setOcrResult(null); setCapturedImageUrl(null); setNumberImageUrl(null); }}
              title="关闭"
            >
              ×
            </button>
          </div>
          {numberImageUrl && (
            <div className="ocr-result-image-wrapper">
              <div className="ocr-result-image-label">数字区域截图</div>
              <img
                src={numberImageUrl}
                alt="数字区域截图"
                className="ocr-result-image"
              />
              <button
                className="ocr-result-save-btn"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = numberImageUrl;
                  link.download = `ocr-number-${Date.now()}.jpg`;
                  link.click();
                }}
                title="保存数字截图到本地"
              >
                保存数字截图
              </button>
            </div>
          )}
          {capturedImageUrl && (
            <div className="ocr-result-image-wrapper">
              {numberImageUrl && <div className="ocr-result-image-label">选项区域截图</div>}
              <img
                src={capturedImageUrl}
                alt="OCR 识别截图"
                className="ocr-result-image"
              />
              <button
                className="ocr-result-save-btn"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = capturedImageUrl;
                  link.download = `ocr-capture-${Date.now()}.jpg`;
                  link.click();
                }}
                title="保存截图到本地"
              >
                保存截图
              </button>
            </div>
          )}
          <div className="ocr-result-content">{ocrResult.text}</div>
        </div>
      )}
    </div>
  );
}

export default CameraPanel;
