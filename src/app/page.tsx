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
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursor = useHandTracker(videoElement, overlayCanvasRef.current);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isHudStarted, setIsHudStarted] = useState(false);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authData, setAuthData] = useState({ username: "", password: "" });
  const [message, setMessage] = useState("");

  const loginButtonRef = useRef<HTMLButtonElement | null>(null);
  const switchButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const savedUser = localStorage.getItem("user");
      if (savedUser) {
        setUser(JSON.parse(savedUser));
        await fetchHistory();
      }
      setTimeout(() => setIsCheckingAuth(false), 1500);
    };
    checkSession();
  }, []);

  // Manual webcam start to satisfy browser "user gesture" rule
  const startHUD = async () => {
    try {
      console.log("[WEBCAM] Requesting stream via USER_GESTURE...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setVideoElement(videoRef.current);
      }
      setIsHudStarted(true);
      setIsPermissionDenied(false);
    } catch (err: any) {
      console.error("[WEBCAM] ERROR:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setIsPermissionDenied(true);
      }
      setMessage("CAMERA_ACCESS_DENIED: CHECK BROWSER PERMISSIONS");
    }
  };

  useEffect(() => {
    if (isHudStarted && videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      setVideoElement(videoRef.current);
    }
  }, [isHudStarted, user]);

  // Sync overlay canvas dimensions with video
  useEffect(() => {
    if (videoElement && overlayCanvasRef.current) {
      const updateDimensions = () => {
        if (overlayCanvasRef.current && videoRef.current) {
          overlayCanvasRef.current.width = videoRef.current.videoWidth;
          overlayCanvasRef.current.height = videoRef.current.videoHeight;
        }
      };
      videoElement.addEventListener("loadedmetadata", updateDimensions);
      updateDimensions();
      return () => videoElement.removeEventListener("loadedmetadata", updateDimensions);
    }
  }, [videoElement]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Pinch-to-click logic for portal buttons
  useEffect(() => {
    if (cursor.isPinching && !user) {
      const element = document.elementFromPoint(cursor.x, cursor.y);
      if (element instanceof HTMLButtonElement) {
        element.click();
      }
    }
  }, [cursor.isPinching, user]);

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

  const handleAuth = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
    setIsHudStarted(false);
    setIsPermissionDenied(false);
  };

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

  return (
    <main className={styles.main}>
      <div className={styles.background} />
      <div className="scanline" />
      
      {/* HUD-First Entry: Tracker starts before Auth Portal */}
      <HandCursor cursor={isHudStarted ? cursor : { ...cursor, isScrolling: false, isPinching: false, isClearing: false }} />

      {!isHudStarted ? (
        <div className={styles.portalContainer}>
          <div className={styles.portalContent}>
            <div className={styles.initContainer} style={{ background: 'rgba(0,0,0,0.4)', padding: '4rem', borderRadius: '40px', border: '1px dashed var(--accent-glow)' }}>
              <ShieldCheck size={64} className={styles.initIcon} />
              <h2 className={styles.initText} style={{ margin: '2rem 0' }}>HARDWARE LINK PENDING</h2>
              <button 
                onClick={startHUD}
                className={styles.submitButton}
                style={{ width: 'auto', padding: '1.5rem 3rem' }}
              >
                INITIALIZE HUD SYSTEM
              </button>
              {isPermissionDenied && (
                  <div className={styles.errorMessage} style={{ marginTop: '2rem' }}>
                      ERROR: PERMISSION_BLOCKED_BY_OPERATOR.<br/>
                      RE-ENABLE CAMERA IN BROWSER SETTINGS.
                  </div>
              )}
            </div>
            
            <div className={styles.cameraContainer} style={{ marginTop: '2rem', opacity: 0.2 }}>
                <video ref={videoRef} className={styles.videoFeed} autoPlay playsInline muted />
                <canvas ref={overlayCanvasRef} className={styles.overlayCanvas} />
                <div className={styles.cameraOverlay}>
                    <div className={`${styles.corner} ${styles.topLeft}`} />
                    <div className={`${styles.corner} ${styles.topRight}`} />
                    <div className={`${styles.corner} ${styles.bottomLeft}`} />
                    <div className={`${styles.corner} ${styles.bottomRight}`} />
                    <span className={styles.cameraStatus}>SYSTEM_OFFLINE</span>
                </div>
            </div>
          </div>
        </div>
      ) : !user ? (
        <div className={styles.portalContainer}>
          <div className={styles.portalContent}>
            <div className={styles.portalHeader}>
              <div className={styles.logoIcon}>
                <CalcIcon size={48} color="var(--accent-color)" />
              </div>
              <h1 className={styles.portalTitle}>IDENTITY VERIFICATION TERMINAL</h1>
            </div>

            <div className={styles.portalFormBox}>
              <div className={styles.terminalHeader}>
                <span className={styles.terminalLabel}>{authMode === "login" ? "SECURITY SCAN" : "AUTHORIZATION REQUEST"}</span>
                <div className={styles.terminalStatus}>
                  <span className={styles.blinkDot} /> OPERATOR_LINK_ACTIVE
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

                <button 
                  ref={loginButtonRef}
                  type="submit" 
                  className={styles.submitButton}
                >
                  {authMode === "login" ? "INITIATE SYSTEM UPLINK" : "INITIALIZE NEW OPERATOR"}
                </button>
              </form>

              <div className={styles.switchMode}>
                <button 
                  ref={switchButtonRef}
                  onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                  className={styles.switchButton}
                >
                  {authMode === "login" ? "> Request Access Credentials" : "> Return to Primary Terminal"}
                </button>
              </div>
            </div>
            
            <div className={styles.cameraContainer} style={{ marginTop: '2rem' }}>
                <video ref={videoRef} className={styles.videoFeed} autoPlay playsInline muted />
                <canvas ref={overlayCanvasRef} className={styles.overlayCanvas} />
                <div className={styles.cameraOverlay}>
                    <div className={`${styles.corner} ${styles.topLeft}`} />
                    <div className={`${styles.corner} ${styles.topRight}`} />
                    <div className={`${styles.corner} ${styles.bottomLeft}`} />
                    <div className={`${styles.corner} ${styles.bottomRight}`} />
                    <span className={styles.cameraStatus}>Webcam Tracking Active</span>
                </div>
            </div>
          </div>
        </div>
      ) : (
        <>
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
                    <canvas ref={overlayCanvasRef} className={styles.overlayCanvas} />
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
        </>
      )}
    </main>
  );
}
