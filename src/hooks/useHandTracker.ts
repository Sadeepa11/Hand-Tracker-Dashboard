"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export interface CursorPosition {
  x: number;
  y: number;
  isPinching: boolean;
  isScrolling: boolean;
  scrollDelta: number;
  isClearing: boolean;
}

export const useHandTracker = (videoElement: HTMLVideoElement | null) => {
  const [cursor, setCursor] = useState<CursorPosition>({
    x: 0,
    y: 0,
    isPinching: false,
    isScrolling: false,
    scrollDelta: 0,
    isClearing: false,
  });

  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastScrollY = useRef<number | null>(null);

  const processResults = useCallback((results: any) => {
    if (results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0];
      
      // Index finger tip (Landmark 8) for cursor position
      const indexTip = landmarks[8];
      const thumbTip = landmarks[4];
      const middleTip = landmarks[12];
      const ringTip = landmarks[16];

      // Normalized coordinates (0 to 1)
      // Mirroring the X coordinate for natural interaction
      const x = 1 - indexTip.x;
      const y = indexTip.y;

      // Pinch detection (Thumb + Index)
      const pinchDist = Math.sqrt(
        Math.pow(thumbTip.x - indexTip.x, 2) +
        Math.pow(thumbTip.y - indexTip.y, 2) +
        Math.pow(thumbTip.z - indexTip.z, 2)
      );
      const isPinching = pinchDist < 0.05;

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

      // Clear detection (Three fingers up: Index, Middle, Ring)
      const isClearing = 
        indexTip.y < landmarks[6].y && 
        middleTip.y < landmarks[10].y && 
        ringTip.y < landmarks[14].y &&
        !isPinching && !isScrolling;

      setCursor({
        x: x * window.innerWidth,
        y: y * window.innerHeight,
        isPinching,
        isScrolling,
        scrollDelta,
        isClearing,
      });
    }
  }, []);

  useEffect(() => {
    if (!videoElement) return;

    const initializeLandmarker = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
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
        if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
          const startTimeMs = performance.now();
          const results = landmarkerRef.current?.detectForVideo(videoElement, startTimeMs);
          if (results) {
            processResults(results);
          }
        }
        animationFrameRef.current = requestAnimationFrame(predict);
      };

      animationFrameRef.current = requestAnimationFrame(predict);
    };

    initializeLandmarker();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      landmarkerRef.current?.close();
    };
  }, [videoElement, processResults]);

  return cursor;
};
