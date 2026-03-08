import { useState, useEffect, useRef, type FormEvent } from "react";
import { Shield, Lock, LogOut, KeyRound, RefreshCw, Key, Copy, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NotesApp } from "./NotesApp";
import {
  rotatePassphrase,
  requestPersistentStorage,
  createAndStoreKeyPair,
  getStoredKeyPair,
  deleteStoredKeyPair,
  type StoredKeyPair,
} from "./db";
import "./index.css";

const SESSION_KEY = "ciphernotes-passphrase";

function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const chars = "01アイウエオカキクケコサシスセソABCDEF0123456789{}[]<>/\\";
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: number[] = Array(columns).fill(1);

    let animId: number;
    let lastTime = 0;
    const frameInterval = 50;

    const draw = (time: number) => {
      animId = requestAnimationFrame(draw);
      if (time - lastTime < frameInterval) return;
      lastTime = time;

      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#34d399";
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars.charAt(Math.floor(Math.random() * chars.length));
        ctx.fillText(text, i * fontSize, drops[i]! * fontSize);
        if (drops[i]! * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]!++;
      }
    };

    animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} id="matrix-rain" />;
}

function PassphrasePrompt({ onUnlock }: { onUnlock: (passphrase: string) => void }) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const passphrase = (formData.get("passphrase") as string).trim();
    if (passphrase) onUnlock(passphrase);
  };

  return (
    <div className="glass-card rounded-xl p-8 max-w-sm mx-auto text-center">
      <div className="flex justify-center mb-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <KeyRound className="w-7 h-7 text-primary" strokeWidth={1.5} />
        </div>
      </div>
      <h2 className="text-lg font-semibold mb-1">Unlock Your Vault</h2>
      <p className="text-xs text-muted-foreground/60 mb-6">
        Enter your passphrase to encrypt &amp; decrypt notes
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input
          name="passphrase"
          type="password"
          placeholder="Passphrase..."
          autoFocus
          required
          className="bg-background/50 border-border/50 focus:border-primary/50 transition-colors text-center"
        />
        <Button type="submit" className="gap-2 font-semibold">
          <Lock className="w-3.5 h-3.5" />
          Unlock
        </Button>
      </form>
    </div>
  );
}

export function App() {
  const [passphrase, setPassphrase] = useState<string | null>(() => {
    return sessionStorage.getItem(SESSION_KEY);
  });
  const [showRotate, setShowRotate] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [showKeyMgmt, setShowKeyMgmt] = useState(false);
  const [keyPair, setKeyPair] = useState<StoredKeyPair | null>(null);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [copiedPubKey, setCopiedPubKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const handleUnlock = async (pp: string) => {
    sessionStorage.setItem(SESSION_KEY, pp);
    setPassphrase(pp);
    // Request persistent storage so the browser won't evict IndexedDB
    try {
      await requestPersistentStorage();
    } catch {
      // Silently ignore — not all browsers support this
    }
  };

  const handleLock = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setPassphrase(null);
    setShowRotate(false);
  };

  const handleRotate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setRotateError(null);
    const formData = new FormData(e.currentTarget);
    const newPassphrase = (formData.get("new-passphrase") as string).trim();
    const confirmPassphrase = (formData.get("confirm-passphrase") as string).trim();

    if (!newPassphrase) return;
    if (newPassphrase !== confirmPassphrase) {
      setRotateError("Passphrases do not match");
      return;
    }
    if (newPassphrase === passphrase) {
      setRotateError("New passphrase must be different");
      return;
    }

    try {
      setRotating(true);
      await rotatePassphrase(passphrase!, newPassphrase);
      sessionStorage.setItem(SESSION_KEY, newPassphrase);
      setPassphrase(newPassphrase);
      setShowRotate(false);
    } catch {
      setRotateError("Failed to rotate — is your current passphrase correct?");
    } finally {
      setRotating(false);
    }
  };

  // Load key pair on unlock
  useEffect(() => {
    if (!passphrase) {
      setKeyPair(null);
      return;
    }
    getStoredKeyPair().then((kp) => setKeyPair(kp ?? null));
  }, [passphrase]);

  const handleGenerateKeyPair = async () => {
    if (!passphrase) return;
    try {
      setGeneratingKey(true);
      setKeyError(null);
      const kp = await createAndStoreKeyPair(passphrase);
      setKeyPair(kp);
    } catch (err) {
      setKeyError(`Failed to generate key pair: ${err}`);
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleDeleteKeyPair = async () => {
    try {
      await deleteStoredKeyPair();
      setKeyPair(null);
    } catch (err) {
      setKeyError(`Failed to delete key pair: ${err}`);
    }
  };

  const handleCopyPublicKey = async () => {
    if (!keyPair) return;
    const pubKeyStr = JSON.stringify(keyPair.publicKey);
    await navigator.clipboard.writeText(pubKeyStr);
    setCopiedPubKey(true);
    setTimeout(() => setCopiedPubKey(false), 2000);
  };

  const handleExportPublicKey = () => {
    if (!keyPair) return;
    const json = JSON.stringify(keyPair.publicKey, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ciphernotes-publickey.jwk.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-mesh noise-overlay min-h-screen w-full">
      <MatrixRain />

      <div className="relative z-10 w-full max-w-2xl mx-auto px-4 py-10 sm:px-6">
        {/* Header */}
        <header className="mb-8 text-center">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <div className="relative">
              <Shield className="w-8 h-8 text-primary" strokeWidth={1.5} />
              <Lock className="w-3.5 h-3.5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="cipher-text">Cipher</span>
              <span className="text-foreground">Notes</span>
            </h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            AES-256-GCM encrypted notes stored in IndexedDB.
            <br />
            <span className="text-xs opacity-70 font-mono">Your data never leaves the browser.</span>
          </p>
          <div className="glow-line mt-6 mx-auto max-w-xs" />
          {passphrase && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowKeyMgmt((v) => !v); setShowRotate(false); setKeyError(null); }}
                className="gap-1.5 text-xs text-muted-foreground/60 hover:text-primary hover:bg-primary/10"
              >
                <Key className="w-3.5 h-3.5" />
                Key Pair
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowRotate((v) => !v); setShowKeyMgmt(false); setRotateError(null); }}
                className="gap-1.5 text-xs text-muted-foreground/60 hover:text-primary hover:bg-primary/10"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Rotate Passphrase
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLock}
                className="gap-1.5 text-xs text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-3.5 h-3.5" />
                Lock
              </Button>
            </div>
          )}
          {showKeyMgmt && (
            <div className="glass-card rounded-xl p-5 max-w-sm mx-auto mt-4">
              <h3 className="text-sm font-semibold mb-1">RSA Key Pair</h3>
              <p className="text-[11px] text-muted-foreground/60 mb-4">
                Generate a key pair for sharing encrypted notes with others.
                Your private key is protected by your passphrase.
              </p>

              {keyError && (
                <p className="text-xs text-destructive mb-3">{keyError}</p>
              )}

              {keyPair ? (
                <div className="flex flex-col gap-3">
                  <div className="rounded-lg bg-background/60 border border-primary/10 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Key className="w-3 h-3 text-primary/60" />
                      <span className="text-[10px] font-semibold text-primary/60 uppercase tracking-widest">
                        RSA-OAEP 4096-bit
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground/50">
                      Created {new Date(keyPair.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground/40 break-all mt-1 select-all">
                      {keyPair.publicKey.n?.slice(0, 40)}...
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyPublicKey}
                      className="flex-1 gap-1.5 text-xs"
                    >
                      {copiedPubKey ? (
                        <><Check className="w-3 h-3" /> Copied</>
                      ) : (
                        <><Copy className="w-3 h-3" /> Copy Public Key</>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportPublicKey}
                      className="gap-1.5 text-xs"
                    >
                      Export
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDeleteKeyPair}
                      className="gap-1.5 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={handleGenerateKeyPair}
                  disabled={generatingKey}
                  className="w-full gap-2 font-semibold"
                >
                  <Key className={`w-3.5 h-3.5 ${generatingKey ? "animate-pulse" : ""}`} />
                  {generatingKey ? "Generating 4096-bit RSA..." : "Generate Key Pair"}
                </Button>
              )}
            </div>
          )}
          {showRotate && (
            <div className="glass-card rounded-xl p-5 max-w-sm mx-auto mt-4">
              <h3 className="text-sm font-semibold mb-1">Rotate Passphrase</h3>
              <p className="text-[11px] text-muted-foreground/60 mb-4">
                All notes will be re-encrypted with the new passphrase.
              </p>
              <form onSubmit={handleRotate} className="flex flex-col gap-3">
                <Input
                  name="new-passphrase"
                  type="password"
                  placeholder="New passphrase..."
                  autoFocus
                  required
                  className="bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
                />
                <Input
                  name="confirm-passphrase"
                  type="password"
                  placeholder="Confirm new passphrase..."
                  required
                  className="bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
                />
                {rotateError && (
                  <p className="text-xs text-destructive">{rotateError}</p>
                )}
                <div className="flex gap-2">
                  <Button type="submit" disabled={rotating} className="flex-1 gap-2 font-semibold">
                    <RefreshCw className={`w-3.5 h-3.5 ${rotating ? "animate-spin" : ""}`} />
                    {rotating ? "Rotating..." : "Rotate"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowRotate(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          )}
        </header>

        {/* Main content */}
        <main>
          {passphrase ? (
            <NotesApp passphrase={passphrase} hasKeyPair={!!keyPair} />
          ) : (
            <PassphrasePrompt onUnlock={handleUnlock} />
          )}
        </main>

        {/* Footer */}
        <footer className="mt-10 text-center">
          <div className="glow-line mx-auto max-w-xs mb-4" />
          <p className="text-[11px] text-muted-foreground/50 font-mono tracking-wider uppercase">
            Web Crypto API &middot; IndexedDB &middot; Zero Server Storage
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
