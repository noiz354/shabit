/**
 * HabitWealth capture — AUD-CAP-01
 * APIs 1,2,4,5,8,38,47,48,45,94: MediaDevices, getUserMedia, MediaStream, MediaStreamTrack, Canvas, Drag and Drop, File, Blob, OPFS, CanvasRenderingContext2D
 * - Receipt photo pipeline (needs P03/P09/P18 amendment + attachment endpoint + object store)
 * - For MVP, implemented as file input + canvas downscale + OPFS staging + offline queue
 * - Spec amendment flagged: capture screen needs P03 amendment
 */

import { writeFile } from "./storage/opfs.js";
import { enqueue } from "./storage/outbox.js";

let currentStream = null;

export function isCaptureSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export async function startCamera(videoEl, options = {}) {
  const { facingMode = "environment" } = options;
  if (!isCaptureSupported()) return { ok: false, reason: "unsupported" };

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    currentStream = stream;
    if (videoEl) {
      videoEl.srcObject = stream;
      await videoEl.play().catch(() => {});
    }
    return { ok: true, stream };
  } catch (e) {
    console.warn("[capture] startCamera failed", e);
    return { ok: false, error: String(e), name: e.name };
  }
}

export function stopCamera() {
  try {
    if (currentStream) {
      currentStream.getTracks().forEach((t) => t.stop());
      currentStream = null;
    }
    return true;
  } catch {
    return false;
  }
}

export async function capturePhoto(videoEl, options = {}) {
  const { maxWidth = 1600, quality = 0.8 } = options;
  if (!videoEl) return { ok: false, reason: "no-video" };

  try {
    const canvas = document.createElement("canvas");
    const width = videoEl.videoWidth;
    const height = videoEl.videoHeight;
    const scale = Math.min(1, maxWidth / width);
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    // Compress to JPEG q0.8 (spec: downscale ≤1600px + JPEG q0.8)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

    if (!blob) return { ok: false, reason: "canvas-blob-failed" };

    // Size guard: if >2MB, reduce quality
    let finalBlob = blob;
    if (blob.size > 2 * 1024 * 1024) {
      finalBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.6));
    }

    return { ok: true, blob: finalBlob, width: canvas.width, height: canvas.height, size: finalBlob.size };
  } catch (e) {
    console.warn("[capture] capturePhoto failed", e);
    return { ok: false, error: String(e) };
  }
}

export async function handleFileInput(file, options = {}) {
  const { maxWidth = 1600, quality = 0.8 } = options;
  if (!file || !file.type.startsWith("image/")) return { ok: false, reason: "not-image" };

  try {
    // Downscale via canvas
    const img = await loadImageFromFile(file);
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, maxWidth / img.width);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return { ok: true, blob, width: canvas.width, height: canvas.height, size: blob.size };
  } catch (e) {
    console.warn("[capture] file input failed", e);
    return { ok: false, error: String(e) };
  }
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Save to OPFS staging + queue for upload (offline queue)
export async function stageReceiptPhoto(blob, transactionId) {
  const fileName = `receipts/${transactionId || Date.now()}_${Math.random().toString(36).slice(2,6)}.jpg`;
  try {
    const res = await writeFile(fileName, blob);
    // Queue upload via outbox (needs attachment endpoint — spec amendment P18)
    // For MVP, we enqueue to /transactions/:id/attachment (not yet implemented server-side, will be 404 but queued)
    if (transactionId) {
      await enqueue("POST", `/transactions/${transactionId}/attachment`, { fileName, size: blob.size }).catch(() => {});
    }
    return { ok: true, path: fileName, size: blob.size, backend: res.backend };
  } catch (e) {
    console.warn("[capture] stage failed", e);
    return { ok: false, error: String(e) };
  }
}

// Dropzone helper (Drag and Drop API 38)
export function makeDropzone(dropEl, onDrop) {
  if (!dropEl) return () => {};

  function onDragOver(e) {
    e.preventDefault();
    dropEl.classList.add("drag-over");
  }
  function onDragLeave() {
    dropEl.classList.remove("drag-over");
  }
  function onDropHandler(e) {
    e.preventDefault();
    dropEl.classList.remove("drag-over");
    const files = e.dataTransfer?.files;
    if (files && files.length) {
      const file = files[0];
      if (onDrop) onDrop(file);
    }
  }

  dropEl.addEventListener("dragover", onDragOver);
  dropEl.addEventListener("dragleave", onDragLeave);
  dropEl.addEventListener("drop", onDropHandler);

  return () => {
    dropEl.removeEventListener("dragover", onDragOver);
    dropEl.removeEventListener("dragleave", onDragLeave);
    dropEl.removeEventListener("drop", onDropHandler);
  };
}

export const captureHelpers = {
  isCaptureSupported,
  startCamera,
  stopCamera,
  capturePhoto,
  handleFileInput,
  stageReceiptPhoto,
  makeDropzone,
};
