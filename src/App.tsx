import { useEffect, useRef } from "react";
import { Shield, Lock } from "lucide-react";
import { NotesApp } from "./NotesApp";
import "./index.css";

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

    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#34d399";
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 50);
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} id="matrix-rain" />;
}

export function App() {
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
        </header>

        {/* Main content */}
        <main>
          <NotesApp />
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
