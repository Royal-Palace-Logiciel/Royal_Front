// src/pages/LoginPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import logo from '../assets/logo_s.png';
import AuthService from '../services/authService';

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

export const LoginPage: React.FC = () => {
  const { showToast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    rememberMe: false,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const warningShownRef = useRef(false);

  // Animation du fond avec particules
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    interface Particle {
      x: number;
      y: number;
      radius: number;
      speedX: number;
      speedY: number;
      opacity: number;
      color: string;
    }

    const particles: Particle[] = [];
    const particleCount = Math.min(80, Math.floor((window.innerWidth * window.innerHeight) / 15000));

    const colors = [
      'rgba(212, 168, 71, ',
      'rgba(196, 149, 58, ',
      'rgba(232, 200, 106, ',
    ];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 3 + 1,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: (Math.random() - 0.5) * 0.5,
        opacity: Math.random() * 0.5 + 0.1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    let animationId: number;

    const drawParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle) => {
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        if (particle.x < 0 || particle.x > canvas.width) particle.speedX *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.speedY *= -1;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = particle.color + particle.opacity + ')';
        ctx.fill();

        const glow = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.radius * 4
        );
        glow.addColorStop(0, particle.color + (particle.opacity * 0.3) + ')');
        glow.addColorStop(1, particle.color + '0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius * 4, 0, Math.PI * 2);
        ctx.fill();
      });

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 120) {
            const opacity = (1 - distance / 120) * 0.15;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(212, 168, 71, ${opacity})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      animationId = requestAnimationFrame(drawParticles);
    };

    drawParticles();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  // ===== DÉTECTION DE PERFORMANCE FIABLE =====
  useEffect(() => {
    const detectDevicePerformance = () => {
      if (warningShownRef.current) return;
      
      const cores = navigator.hardwareConcurrency || 4;
      const memory = (navigator as any).deviceMemory || 4;
      
      const start = performance.now();
      let sum = 0;
      for (let i = 0; i < 1_000_000; i++) {
        sum += Math.sqrt(i) * Math.sin(i);
      }
      const elapsed = performance.now() - start;
      void sum;
      
      let score = 0;
      let details = [];
      
      if (cores >= 8) {
        score += 35;
        details.push('8+ cœurs');
      } else if (cores >= 4) {
        score += 25;
        details.push('4 cœurs');
      } else if (cores >= 2) {
        score += 15;
        details.push('2 cœurs');
      } else {
        score += 5;
        details.push('1 cœur');
      }
      
      if (memory >= 16) {
        score += 30;
        details.push('16+ GB RAM');
      } else if (memory >= 8) {
        score += 20;
        details.push('8 GB RAM');
      } else if (memory >= 4) {
        score += 10;
        details.push('4 GB RAM');
      } else {
        score += 5;
        details.push('Moins de 4 GB RAM');
      }
      
      if (elapsed < 20) {
        score += 35;
        details.push('Très rapide');
      } else if (elapsed < 35) {
        score += 25;
        details.push('Rapide');
      } else if (elapsed < 50) {
        score += 15;
        details.push('Moyen');
      } else {
        score += 5;
        details.push('Lent');
      }
      
      const isSlow = score < 50;
      warningShownRef.current = true;

      if (isSlow) {
        showToast(
          `⚠️ Performances limitées détectées (${score}/100). Certaines animations peuvent être ralenties.`,
          'warning',
          5000
        );
      } else {
        showToast(
          `✅ Performances optimales détectées (${score}/100) - L'application fonctionnera parfaitement.`,
          'success',
          3000
        );
      }
    };

    const timeoutId = setTimeout(detectDevicePerformance, 500);
    return () => clearTimeout(timeoutId);
  }, [showToast]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // ===== LOGIN AVEC API REEL =====
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { user } = await AuthService.login(formData.email, formData.password);

      if (formData.rememberMe) {
        localStorage.setItem('rememberMe', 'true');
      }

      const roleNames: Record<string, string> = {
        admin: 'Administrateur',
        manager: 'Manager',
        receptioniste: 'Réceptionniste',
        caisse: 'Caissier',
        water: 'Barman',
        hotesse: 'Hôtesse',
        housekeeping: 'Housekeeping',
      };
      const roleLabel = roleNames[user.role] || user.role;
      const welcomeMessage = `Bienvenue ${roleLabel} ${user.prenom ?? ''} ${user.nom}`;

      showToast(welcomeMessage, 'success', 5000);

      const redirectPath = AuthService.getRedirectPath();
      
      // Redirection avec rechargement complet pour initialiser la session globale
      window.location.href = redirectPath;
    } catch (err: any) {
      const errorMessage = err.message || 'Erreur de connexion';
      setError(errorMessage);
      showToast(errorMessage, 'error', 4000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Canvas pour l'animation de particules */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-0"
        style={{ pointerEvents: 'none' }}
      />

      {/* Overlay pour améliorer la lisibilité */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-bg/80 via-bg/60 to-bg/80" />

      {/* Effets d'ambiance supplémentaires */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 left-1/3 w-96 h-96 rounded-full bg-accent/5 blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-accent/5 blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/4 w-64 h-64 rounded-full bg-accent/5 blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md animate-fade-in">
        {/* Logo et titre */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center">
            <img 
              src={logo} 
              alt="HDA Logo" 
              className="w-full h-full object-contain drop-shadow-lg hover:scale-105 transition-transform duration-500"
            />
          </div>
          <h1 className="text-3xl font-bold text-primary" style={{ fontFamily: 'Playfair Display, serif' }}>
            Bienvenue
          </h1>
          <p className="text-muted text-sm mt-2">
            Connectez-vous à votre espace de gestion
          </p>
        </div>

        {/* Formulaire */}
        <div className="bg-surface/80 backdrop-blur-xl border border-base rounded-2xl p-6 md:p-8 shadow-2xl card-gold-hover">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={18} className="text-muted" />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-surface-2 border border-base rounded-xl py-2.5 pl-10 pr-4 text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all"
                  placeholder="admin@hda.com"
                  required
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-secondary">
                  Mot de passe
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-muted hover:text-primary text-xs transition-colors flex items-center gap-1"
                >
                  {showPassword ? 'Masquer' : 'Afficher'}
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-muted" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full bg-surface-2 border border-base rounded-xl py-2.5 pl-10 pr-12 text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-primary transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Erreur */}
            {error && (
              <div className="bg-danger-bg border border-danger/30 rounded-xl p-3 text-danger text-sm animate-shake">
                {error}
              </div>
            )}

            {/* Options */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-muted cursor-pointer hover:text-primary transition-colors">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-base bg-surface-2 text-accent focus:ring-accent/50 focus:ring-offset-0 transition-colors"
                />
                <span>Se souvenir de moi</span>
              </label>
              <a 
                href="#" 
                className="text-accent hover:text-accent-3 transition-colors"
              >
                Mot de passe oublié ?
              </a>
            </div>

            {/* Bouton de connexion */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-accent text-black font-medium py-2.5 rounded-xl hover:bg-accent-2 transition-all shadow-lg shadow-accent/25 hover:shadow-accent/40 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Connexion en cours...
                </>
              ) : (
                <>
                  Se connecter
                </>
              )}
            </button>

            {/* Separator */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-base"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-surface text-muted">Accès sécurisé</span>
              </div>
            </div>

            {/* Version */}
            <div className="text-center">
              <p className="text-subtle text-xs">
                Version 2.0.0
              </p>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-subtle text-sm">
            © {new Date().getFullYear()} HDA — Hôtel de l'Avenue
          </p>
        </div>
      </div>

      {/* Animations CSS */}
      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
          }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        
        .animate-fade-in {
          animation: fade-in 0.6s ease-out forwards;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
        
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
