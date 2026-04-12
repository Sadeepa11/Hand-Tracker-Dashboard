"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export interface CursorPosition {
  x: number;
  y: number;
  rawX: number; // Un-snapped position
  rawY: number;
  isPinching: boolean;
  isScrolling: boolean;
  scrollDelta: number;
  isClearing: boolean;
  isSnapped: boolean;
}

export const useHandTracker = (
  videoElement: HTMLVideoElement | null, 
  overlayCanvas: HTMLCanvasElement | null = null
) => {
  const [cursor, setCursor] = useState<CursorPosition>({
    x: 0,
    y: 0,
    rawX: 0,
    rawY: 0,
    isPinching: false,
    isScrolling: false,
    scrollDelta: 0,
    isClearing: false,
    isSnapped: false,
  });

  const lockedPosRef = useRef<{ x: number; y: number } | null>(null);
  const wasPinchingRef = useRef(false);

  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastScrollY = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const lastTimestampRef = useRef<number>(-1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Connection definitions for skeleton (MediaPipe indices)
  const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4], // thumb
    [0, 5], [5, 6], [6, 7], [7, 8], // index
    [5, 9], [9, 10], [11, 12], // middle (0->9 then 9->10->11->12)
    [0, 9], [9, 10], [10, 11], [11, 12], // middle
    [0, 13], [13, 14], [15, 16], // ring
    [13, 14], [14, 15], [15, 16], // ring
    [0, 17], [17, 18], [19, 20], // pinky
    [17, 18], [18, 19], [19, 20], // pinky
    [5, 9], [9, 13], [13, 17] // palm knuckles
  ];

  const processResults = useCallback((results: any) => {
    if (results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0];
      
      // Index finger tip (Landmark 8) for cursor position
      const indexTip = landmarks[8];
      const thumbTip = landmarks[4];
      const middleTip = landmarks[12];
      const ringTip = landmarks[16];

      // Normalized coordinates (0 to 1)
      const rawX = (1 - indexTip.x) * window.innerWidth;
      const rawY = indexTip.y * window.innerHeight;

      // Pinch detection (Thumb + Index)
      const pinchDist = Math.sqrt(
        Math.pow(thumbTip.x - indexTip.x, 2) +
        Math.pow(thumbTip.y - indexTip.y, 2) +
        Math.pow(thumbTip.z - indexTip.z, 2)
      );
      const isPinching = pinchDist < 0.05;

      // Snapping Logic
      let x = rawX;
      let y = rawY;
      let isSnapped = false;

      if (isPinching) {
        if (!wasPinchingRef.current) {
          // Just started pinching: Find nearest clickable
          const clickables = document.querySelectorAll('button, a, [role="button"]');
          let nearest = null;
          let minDist = 200; // Snap radius

          clickables.forEach((el) => {
            const rect = el.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dist = Math.sqrt(Math.pow(cx - rawX, 2) + Math.pow(cy - rawY, 2));
            if (dist < minDist) {
              minDist = dist;
              nearest = { x: cx, y: cy };
            }
          });

          lockedPosRef.current = nearest || { x: rawX, y: rawY };
        }
        
        // While pinching, use the locked/snapped position
        if (lockedPosRef.current) {
          x = lockedPosRef.current.x;
          y = lockedPosRef.current.y;
          isSnapped = true; // Visually we treats "locked" as snapped focus
        }
      } else {
        lockedPosRef.current = null;
      }
      wasPinchingRef.current = isPinching;

      // Scroll detection (Index + Middle close together)
      const scrollDist = Math.sqrt(
        Math.pow(indexTip.x - middleTip.x, 2) +
        Math.pow(indexTip.y - middleTip.y, 2)
      );
      const isScrolling = scrollDist < 0.05;

      let scrollDelta = 0;
      if (isScrolling) {
        if (lastScrollY.current !== null) {
          scrollDelta = (middleTip.y - lastScrollY.current) * 1000;
        }
        lastScrollY.current = middleTip.y;
      } else {
        lastScrollY.current = null;
      }

      // Five-finger wide-open detection (Clear)
      const fingerTips = [landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
      const fingerMcps = [landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
      
      const thumbMcp = landmarks[2];
      const isThumbOpen = Math.abs(thumbTip.x - thumbMcp.x) > 0.05;

      const isClearing = isThumbOpen && 
                        fingerTips.every((tip, i) => tip.y < fingerMcps[i].y - 0.05) && 
                        !isPinching && !isScrolling;

      setCursor({
        x,
        y,
        rawX,
        rawY,
        isPinching,
        isScrolling,
        scrollDelta,
        isClearing,
        isSnapped,
      });

      // --- SKELETON DRAWING ---
      if (overlayCanvas) {
        const ctx = overlayCanvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
          
          // Settings for Cyberpunk Neon Style
          const ACCENT = "#00f3ff";
          const PINCH_COLOR = "#00ff88";
          const color = isPinching ? PINCH_COLOR : ACCENT;

          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          
          // Draw Connections (Bones)
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.shadowBlur = 15;
          ctx.shadowColor = color;

          HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
            const start = landmarks[startIdx];
            const end = landmarks[endIdx];
            if (start && end) {
              // Use raw X because CSS transform: scaleX(-1) will handle mirroring
              ctx.moveTo(start.x * overlayCanvas.width, start.y * overlayCanvas.height);
              ctx.lineTo(end.x * overlayCanvas.width, end.y * overlayCanvas.height);
            }
          });
          ctx.stroke();

          // Draw Joints (Markers)
          ctx.shadowBlur = 0;
          landmarks.forEach((landmark: any, i: number) => {
            ctx.beginPath();
            ctx.arc(landmark.x * overlayCanvas.width, landmark.y * overlayCanvas.height, 4, 0, 2 * Math.PI);
            ctx.fillStyle = i === 8 || i === 4 ? "#fff" : color; // Highlight Tips
            ctx.fill();
            
            if (i === 8 || i === 4) {
              ctx.strokeStyle = "#fff";
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          });
        }
      }
    } else {
      // Clear canvas if no hand is detected
      if (overlayCanvas) {
        const ctx = overlayCanvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      }
    }
  }, [overlayCanvas]);

  useEffect(() => {
    if (!videoElement) return;
    let active = true;

    const initializeLandmarker = async () => {
      // Create offscreen canvas for frame capture to fix NORM_RECT dimension errors
      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
      }
      
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm"
      );

      landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.7,
        minHandPresenceConfidence: 0.7,
        minTrackingConfidence: 0.7
      });

      const predict = async () => {
        if (!active || !landmarkerRef.current || !canvasRef.current) return;
        
        // readyState 4 = HAVE_ENOUGH_DATA
        if (videoElement.readyState >= 4 && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
          const currentTime = videoElement.currentTime;
          if (currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = currentTime;
            
            // Standardize frame as canvas to provide MediaPipe with consistent IMAGE_DIMENSIONS
            const canvas = canvasRef.current;
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
              
              const now = Math.round(performance.now());
              const timestampMs = Math.max(lastTimestampRef.current + 1, now);
              lastTimestampRef.current = timestampMs;

              try {
                // Silencer for MediaPipe non-fatal logs that trigger Next.js error overlay
                const originalError = console.error;
                console.error = (...args) => {
                  if (args[0]?.includes?.("INFO: Created TensorFlow Lite XNNPACK delegate for CPU")) return;
                  originalError.apply(console, args);
                };

                const results = landmarkerRef.current.detectForVideo(canvas, timestampMs);
                
                // Restore console.error immediately after call
                console.error = originalError;

                if (results) {
                  processResults(results);
                }
              } catch (err: any) {
                // Suppress the "INFO" pseudo-errors from MediaPipe
                if (err?.message?.includes("INFO:")) return;
                console.warn("[HAND_LANDMARKER] Detection stalled:", err);
              }
            }
          }
        }
        animationFrameRef.current = requestAnimationFrame(predict);
      };

      if (active) {
        animationFrameRef.current = requestAnimationFrame(predict);
      }
    };

    initializeLandmarker();

    return () => {
      active = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch (e) {}
        landmarkerRef.current = null;
      }
    };
  }, [videoElement, processResults]);

  return cursor;
};
