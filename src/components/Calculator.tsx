"use client";

import React, { useState, useEffect, useRef } from "react";
import { CursorPosition } from "@/hooks/useHandTracker";
import styles from "./Calculator.module.css";

interface CalculatorProps {
  cursor: CursorPosition;
  onSaveHistory?: (expression: string, result: string) => void;
}

export const Calculator: React.FC<CalculatorProps> = ({ cursor, onSaveHistory }) => {
  const [display, setDisplay] = useState("0");
  const [expression, setExpression] = useState("");
  const [isNewOperation, setIsNewOperation] = useState(true);
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  // Handle pinch gesture as a click
  useEffect(() => {
    if (cursor.isPinching) {
      // Find the element at the SNAP position (which is now button-centered)
      const element = document.elementFromPoint(cursor.x, cursor.y);
      if (element instanceof HTMLButtonElement && element.closest(`.${styles.grid}`)) {
        element.click();
      }
    }
  }, [cursor.isPinching]);

  // Handle clear gesture
  useEffect(() => {
    if (cursor.isClearing) {
      handleAction("C");
    }
  }, [cursor.isClearing]);

  const handleAction = (val: string) => {
    if (val === "C") {
      setDisplay("0");
      setExpression("");
      setIsNewOperation(true);
      return;
    }

    if (val === "=") {
      try {
        const result = eval(expression.replace(/×/g, "*").replace(/÷/g, "/").replace(/sin\(/g, "Math.sin(").replace(/cos\(/g, "Math.cos(").replace(/tan\(/g, "Math.tan(").replace(/ln\(/g, "Math.log(").replace(/√\(/g, "Math.sqrt("));
        const finalResult = String(Number(result).toFixed(4)).replace(/\.?0+$/, "");
        setDisplay(finalResult);
        setExpression(expression + " = " + finalResult);
        setIsNewOperation(true);
        if (onSaveHistory) onSaveHistory(expression, finalResult);
      } catch (e) {
        setDisplay("ERROR");
        setIsNewOperation(true);
      }
      return;
    }

    if (["sin", "cos", "tan", "ln", "√"].includes(val)) {
        setExpression(prev => prev + val + "(");
        setDisplay(val + "(");
        setIsNewOperation(false);
        return;
    }

    if (isNewOperation) {
      setDisplay(val);
      setExpression(val);
      setIsNewOperation(false);
    } else {
      setDisplay(prev => (prev === "0" ? val : prev + val));
      setExpression(prev => prev + val);
    }
  };

  const buttons = [
    ["sin", "cos", "tan", "ln"],
    ["√", "(", ")", "÷"],
    ["7", "8", "9", "×"],
    ["4", "5", "6", "-"],
    ["1", "2", "3", "+"],
    ["C", "0", ".", "="]
  ];

  return (
    <div className={styles.container}>
      {/* Display */}
      <div className={styles.display}>
        <div className={styles.expression}>{expression || "READY_FOR_INPUT"}</div>
        <div className={styles.result}>{display}</div>
      </div>

      {/* Buttons Grid */}
      <div className={styles.grid}>
        {buttons.flat().map((btn) => (
          <button
            key={btn}
            ref={(el) => { buttonRefs.current[btn] = el; }}
            onClick={() => handleAction(btn)}
            className={`
              ${styles.btn} 
              ${btn === "=" ? styles.btnEqual : ""} 
              ${btn === "C" ? styles.btnClear : ""}
              ${["sin", "cos", "tan", "ln", "√"].includes(btn) ? styles.btnFunction : ""}
            `}
          >
            {btn}
          </button>
        ))}
      </div>
    </div>
  );
};
