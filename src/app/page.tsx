"use client";

import React, { useRef, useState, useEffect } from "react";
import { useHandTracker } from "@/hooks/useHandTracker";
import { HandCursor } from "@/components/HandCursor";
import { Calculator } from "@/components/Calculator";
import { Calculator as CalcIcon, History as HistoryIcon, LogIn, LogOut, X, ShieldCheck } from "lucide-react";
import styles from "./page.module.css";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const cursor = useHandTracker(videoElement);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authData, setAuthData] = useState({ username: "", password: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      const savedUser = localStorage.getItem("user");
      if (savedUser) {
        setUser(JSON.parse(savedUser));
        await fetchHistory();
      }
      // Brief delay for system initialization feel
      setTimeout(() => setIsCheckingAuth(false), 1500);
    };
    checkSession();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/history");
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("fetchHistory error:", err);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authData),
      });

      const data = await res.json();
      if (res.ok) {
        if (authMode === "login") {
          setUser({ username: data.username });
          localStorage.setItem("user", JSON.stringify({ username: data.username }));
          fetchHistory();
        } else {
          setAuthMode("login");
          setMessage("SYSTEM AUTHORIZED. PLEASE LOGIN.");
        }
      } else {
        setMessage(data.error || "ACCESS DENIED");
      }
    } catch (err) {
      setMessage("UPLINK FAILED");
    }
  };

  const saveCalculation = async (expression: string, result: string) => {
    if (!user) return;
    try {
      await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expression, result }),
      });
      fetchHistory();
    } catch (err) {
      console.error("saveCalc error:", err);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    setHistory([]);
  };

  // 1. SYSTEM INITIALIZING STATE
  if (isCheckingAuth) {
    return (
      <div className={styles.initOverlay}>
        <div className={styles.background} />
        <div className="scanline" />
        <div className={styles.initContainer}>
          <div className={styles.initLogo}>
            <ShieldCheck size={48} className={styles.initIcon} />
          </div>
          <h2 className={styles.initText}>SYSTEM INITIALIZING...</h2>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} />
          </div>
        </div>
      </div>
    );
  }

  // 2. UNAUTHORIZED / ENTRY PORTAL STATE
  if (!user) {
    return (
      <div className={styles.portalContainer}>
        <div className={styles.background} />
        <div className="scanline" />
        
        <div className={styles.portalContent}>
          <div className={styles.portalHeader}>
            <div className={styles.logoIcon}>
              <CalcIcon size={32} color="var(--accent-color)" />
            </div>
            <h1 className={styles.portalTitle}>IDENTITY VERIFICATION TERMINAL</h1>
          </div>

          <div className={styles.portalFormBox}>
            <div className={styles.terminalHeader}>
              <span className={styles.terminalLabel}>{authMode === "login" ? "SECURITY SCAN" : "AUTHORIZATION REQUEST"}</span>
              <div className={styles.terminalStatus}>
                <span className={styles.blinkDot} /> ACTIVE_LINK
              </div>
            </div>

            <form onSubmit={handleAuth} className={styles.form}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Identity Code</label>
                <input 
                  type="text" 
                  required 
                  className={styles.input}
                  placeholder="OPERATOR NAME"
                  value={authData.username}
                  onChange={(e) => setAuthData({...authData, username: e.target.value})}
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Security Key</label>
                <input 
                  type="password" 
                  required 
                  className={styles.input}
                  placeholder="PASSCODE"
                  value={authData.password}
                  onChange={(e) => setAuthData({...authData, password: e.target.value})}
                />
              </div>

              {message && <div className={styles.errorMessage}>{message}</div>}

              <button type="submit" className={styles.submitButton}>
                {authMode === "login" ? "INITIATE SYSTEM UPLINK" : "INITIALIZE NEW OPERATOR"}
              </button>
            </form>

            <div className={styles.switchMode}>
              <button 
                onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                className={styles.switchButton}
              >
                {authMode === "login" ? "> Request Access Credentials" : "> Return to Primary Terminal"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. AUTHORIZED / DASHBOARD STATE
  return (
    <main className={styles.main}>
      <div className={styles.background} />
      <div className="scanline" />
      
      <HandCursor cursor={cursor} />

      <header className={styles.header}>
        <div className={styles.logoContainer}>
          <div className={styles.logoIcon}>
            <CalcIcon size={24} color="var(--accent-color)" />
          </div>
          <h1 className={styles.title}>
            G-DRIVE <span className={styles.version}>CALC_V1.0</span>
          </h1>
        </div>

        <div className={styles.userSection}>
          <div className={styles.userInfo}>
            <span className={styles.authLabel}>Authorized Personal</span>
            <span className={styles.userName}>{user.username}</span>
          </div>
          <button onClick={logout} className={styles.logoutButton} title="Disconnect System">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className={styles.layoutGroup}>
        <div className={styles.sidePanel}>
            <div className={styles.cameraContainer}>
                <video ref={videoRef} className={styles.videoFeed} autoPlay playsInline muted />
                <div className={styles.cameraOverlay}>
                    <div className={`${styles.corner} ${styles.topLeft}`} />
                    <div className={`${styles.corner} ${styles.topRight}`} />
                    <div className={`${styles.corner} ${styles.bottomLeft}`} />
                    <div className={`${styles.corner} ${styles.bottomRight}`} />
                    <span className={styles.cameraStatus}>Webcam Tracking Active</span>
                </div>
            </div>

            <div className={styles.legendPanel}>
                <h3 className={styles.legendTitle}>Control Protocol</h3>
                <ul className={styles.legendList}>
                    <li className={styles.legendItem}><b>INDEX FINGER</b> Cursor Link</li>
                    <li className={styles.legendItem}><b>PINCH GESTURE</b> Action / Click</li>
                    <li className={styles.legendItem}><b>2 FINGER MOVE</b> Scroll History</li>
                    <li className={styles.legendItem}><b>3 FINGER WAVE</b> Clear System</li>
                </ul>
            </div>
        </div>

        <Calculator cursor={cursor} onSaveHistory={saveCalculation} />

        <div className={styles.recordPanel}>
            <div className={styles.panelHeader}>
                <HistoryIcon size={18} />
                <h2 className={styles.panelTitle}>Record Archives</h2>
            </div>
            
            <div 
                className={`${styles.historyList} custom-scrollbar`}
                style={{ 
                    transform: cursor.isScrolling ? `translateY(${cursor.scrollDelta}px)` : 'none',
                    transition: 'transform 0.1s linear'
                }}
            >
                {history.length > 0 ? (
                    history.map((item, idx) => (
                        <div key={idx} className={styles.historyItem}>
                            <div className={styles.historyTime}>{new Date(item.createdAt).toLocaleString()}</div>
                            <div className={styles.historyExpr}>{item.expression}</div>
                            <div className={styles.historyRes}>= {item.result}</div>
                        </div>
                    ))
                ) : (
                    <div className={styles.emptyHistory}>
                        <CalcIcon size={48} />
                        <span className={styles.historyTime}>No records found</span>
                    </div>
                )}
            </div>
        </div>
      </div>
    </main>
  );
}
