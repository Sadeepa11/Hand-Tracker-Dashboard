"use client";

import React from "react";
import { CursorPosition } from "@/hooks/useHandTracker";

interface HandCursorProps {
  cursor: CursorPosition;
}

import styles from "./HandCursor.module.css";

export const HandCursor: React.FC<HandCursorProps> = ({ cursor }) => {
  return (
    <div
      className={`${styles.cursor} ${cursor.isPinching ? styles.pinching : ""}`}
      style={{
        top: cursor.y,
        left: cursor.x,
        width: cursor.isPinching ? "24px" : "48px",
        height: cursor.isPinching ? "24px" : "48px",
      }}
    >
      {/* HUD Reticle */}
      <div className={styles.outer} />
      <div className={styles.inner} />
      <div className={styles.center} />
      
      {/* Indicators */}
      {cursor.isScrolling && (
        <div className={`${styles.label} ${styles.top}`}>
           ::: TRACKING_SCROLL :::
        </div>
      )}

      {cursor.isClearing && (
        <div className={`${styles.label} ${styles.bottom}`}>
          !!! CLEARING_BUFFER !!!
        </div>
      )}

      {cursor.isPinching && (
        <div className={`${styles.label} ${styles.top}`} style={{ top: '-30px', color: 'var(--success-color)' }}>
          PINCH_LOCKED
        </div>
      )}
    </div>
  );
};
