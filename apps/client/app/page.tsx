'use client';

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { 
  Camera, Palette, Hammer, ArrowRight, Star, CheckCircle, 
  ChevronRight, MousePointer2, Building2, Search, Menu, X, 
  LayoutGrid, Layers, Zap, AlertTriangle, Terminal, Sparkles, Send, Loader2,
  Home, User, Mail, ChevronDown, HelpCircle, Quote, ShieldCheck, Eye, Coins,
  Calculator, AlertOctagon, Check, Facebook, Twitter, Instagram, Linkedin, MapPin,
  Briefcase, Map
} from 'lucide-react';

// ==========================================
// SECTION 1: UTILITIES & API
// ==========================================

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

// --- GEMINI API HOOK ---
const useGemini = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const generate = async (prompt: string, systemInstruction: string, jsonMode = false) => {
    setLoading(true);
    setError(null);
    const apiKey = ""; // Injected by environment
    
    try {
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: jsonMode ? { responseMimeType: "application/json" } : undefined
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) throw new Error('AI Service temporarily unavailable');
      
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      setData(jsonMode ? JSON.parse(text) : text);
      return jsonMode ? JSON.parse(text) : text;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { generate, loading, error, data, setData };
};

// ==========================================
// SECTION 2: UI COMPONENTS
// ==========================================

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "outline" | "ghost" | "link"; size?: "default" | "sm" | "lg" | "icon" }>(({ className, variant = "default", size = "default", ...props }, ref) => {
  const variants = {
    default: "bg-[#E0C9A6] text-[#142620] hover:bg-white uppercase tracking-widest border border-[#E0C9A6] transition-all duration-500", // Luxe Default
    outline: "bg-transparent text-[#E0C9A6] border border-[#E0C9A6] hover:bg-[#E0C9A6] hover:text-[#142620] transition duration-500 ease-out",
    ghost: "hover:bg-[#E0C9A6]/10 text-[#E0C9A6]",
    link: "text-white hover:text-[#E0C9A6] transition gap-2 no-underline p-0",
  };

  const sizes = {
    default: "h-10 px-6 py-2 text-xs font-bold",
    sm: "h-9 rounded-md px-3 text-xs",
    lg: "h-14 px-8 text-sm tracking-[0.2em]",
    icon: "h-10 w-10",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-none ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0C9A6] disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className ?? ""
      )}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = "Button";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("bg-white/5 border border-white/10 text-cream-50 rounded-none", className ?? "")} {...props} />
));
Card.displayName = "Card";

const Badge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("inline-flex items-center border px-3 py-1 text-[10px] font-medium transition-colors bg-[#E0C9A6]/10 text-[#E0C9A6] border-[#E0C9A6]/50 uppercase tracking-widest", className ?? "")} {...props} />
));
Badge.displayName = "Badge";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-12 w-full rounded-none border border-[#E0C9A6]/30 bg-[#0F1D18] px-4 py-2 text-sm text-[#E0C9A6] placeholder:text-[#E0C9A6]/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E0C9A6] disabled:cursor-not-allowed disabled:opacity-50",
      className ?? ""
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
    <select
      className={cn(
        "flex h-12 w-full rounded-none border border-[#E0C9A6]/30 bg-[#0F1D18] px-4 py-2 text-sm text-[#E0C9A6] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E0C9A6] appearance-none",
        className ?? ""
      )}
      ref={ref}
      {...props}
    />
));
Select.displayName = "Select";


// ==========================================
// SECTION 3: SHADERS
// ==========================================

const FontLoader = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;600&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap');
  `}</style>
);

interface ShaderErrorBoundaryProps {
  children: React.ReactNode;
  fallbackClass?: string;
}

interface ShaderErrorBoundaryState {
  hasError: boolean;
}

class ShaderErrorBoundary extends React.Component<ShaderErrorBoundaryProps, ShaderErrorBoundaryState> {
    constructor(props: ShaderErrorBoundaryProps) { 
      super(props); 
      this.state = { hasError: false }; 
    }

    static getDerivedStateFromError(error: Error): ShaderErrorBoundaryState {
      return { hasError: true };
    }
    render() { return this.state.hasError ? <div className={cn("absolute inset-0 z-0", this.props.fallbackClass ?? "")} /> : this.props.children; }
}

const WavesShader = () => {
    const mountRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x1a2e25, 0.05);
      const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); renderer.setSize(window.innerWidth, window.innerHeight);
      if (mountRef.current) mountRef.current.appendChild(renderer.domElement);
      const geometry = new THREE.PlaneGeometry(20, 20, 60, 60);
      const material = new THREE.MeshStandardMaterial({ color: 0xE0C9A6, wireframe: true, side: THREE.DoubleSide, transparent: true, opacity: 0.3 });
      const plane = new THREE.Mesh(geometry, material); plane.rotation.x = -Math.PI / 2.5; plane.position.y = -2; scene.add(plane);
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); scene.add(ambientLight); const pointLight = new THREE.PointLight(0xffffff, 1); pointLight.position.set(5, 10, 5); scene.add(pointLight);
      camera.position.z = 5;
      const animate = () => { requestAnimationFrame(animate); const now = Date.now() * 0.0005; const positionAttr = geometry.attributes.position; if (positionAttr) { const count = positionAttr.count; for (let i = 0; i < count; i++) { const x = positionAttr.array[i*3] ?? 0; const y = positionAttr.array[i*3+1] ?? 0; positionAttr.setZ(i, Math.sin(x * 0.5 + now) * 0.8 + Math.cos(y * 0.3 + now) * 0.8); } positionAttr.needsUpdate = true; } renderer.render(scene, camera); };
      animate();
      return () => { if(mountRef.current && renderer.domElement) mountRef.current.removeChild(renderer.domElement); geometry.dispose(); material.dispose(); };
    }, []);
    return <div ref={mountRef} className="absolute inset-0 z-0 bg-[#142620]" />;
};

// ==========================================
// SECTION 4: COMPONENTS & ONBOARDING
// ==========================================

// --- STANDALONE HEADER ---
const LuxeHeader = ({ onSignUpClick, onLogoClick }: { onSignUpClick: () => void; onLogoClick: () => void }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <nav className="sticky z-50 flex items-center justify-between px-4 md:px-10 py-6 md:py-8 max-w-7xl mx-auto w-full border-b border-white/10 bg-[#142620]/80 backdrop-blur-md sticky top-0">
          <div onClick={onLogoClick} className="font-playfair text-2xl md:text-3xl tracking-wide text-[#E0C9A6] cursor-pointer flex items-center gap-2">
             <Building2 size={24} /> Build Market.
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex space-x-8 text-sm uppercase tracking-widest text-gray-300">
            {['Directory', 'Portfolio', 'Journal'].map((item) => (
               <Button key={item} variant="link" className="text-gray-300 hover:text-[#E0C9A6] no-underline hover:no-underline">{item}</Button>
            ))}
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-4">
             <Button variant="outline" className="px-6" onClick={onSignUpClick}>Sign In</Button>
             <Button variant="default" onClick={onSignUpClick}>Join Now</Button>
          </div>

          {/* Mobile Toggle */}
          <Button variant="ghost" size="icon" className="md:hidden text-[#E0C9A6]" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <X /> : <Menu />}
          </Button>

          {/* Mobile Menu Overlay */}
          {isMobileMenuOpen && (
            <div className="absolute top-full left-0 w-full bg-[#0F1D18] border-t border-white/10 p-6 flex flex-col gap-4 animate-in slide-in-from-top-2">
                {['Directory', 'Portfolio', 'Journal'].map((item) => (
                    <a key={item} href="#" className="text-[#E0C9A6] uppercase tracking-widest py-2 border-b border-white/5">{item}</a>
                ))}
                <Button variant="default" className="w-full mt-4" onClick={() => {
                    onSignUpClick();
                    setIsMobileMenuOpen(false);
                }}>Join Now</Button>
            </div>
          )}
        </nav>
    );
};

// --- ONBOARDING COMPONENT ---
const LuxeOnboarding = () => {
    const [step, setStep] = useState(1);
    const [role, setRole] = useState<'HOMEOWNER' | 'PROFESSIONAL' | null>(null); // 'HOMEOWNER' | 'PROFESSIONAL'

    // Homeowner Form State
    const [projectLocation, setProjectLocation] = useState("");
    
    // Pro Form State
    const [profession, setProfession] = useState("");

    type Role = 'HOMEOWNER' | 'PROFESSIONAL';

    const handleRoleSelect = (selectedRole: Role): void => {
      setRole(selectedRole);
      setStep(2);
    };

    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12">
            <div className="w-full max-w-4xl">
                {/* Progress Indicator */}
                <div className="flex justify-center mb-12">
                    <div className="flex items-center gap-4">
                        <div className={cn("w-3 h-3 rounded-full", step >= 1 ? "bg-[#E0C9A6]" : "bg-white/10")}></div>
                        <div className={cn("w-16 h-px", step >= 2 ? "bg-[#E0C9A6]" : "bg-white/10")}></div>
                        <div className={cn("w-3 h-3 rounded-full", step >= 2 ? "bg-[#E0C9A6]" : "bg-white/10")}></div>
                    </div>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* STEP 1: ROLE SELECTION */}
                    {step === 1 && (
                        <div className="text-center">
                            <h2 className="font-playfair text-4xl md:text-5xl text-white mb-6">How will you build your legacy?</h2>
                            <p className="text-gray-400 mb-12 max-w-lg mx-auto">Select your role to access Kenya's premier construction network.</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Homeowner Card */}
                                <button onClick={() => handleRoleSelect('HOMEOWNER')} className="group text-left p-8 border border-white/10 bg-white/5 hover:bg-[#E0C9A6] hover:text-[#142620] transition-all duration-300 relative overflow-hidden">
                                    <div className="absolute top-4 right-4 opacity-50 group-hover:opacity-100"><Home size={24} /></div>
                                    <h3 className="font-playfair text-2xl mb-2">I am a Homeowner</h3>
                                    <p className="text-sm opacity-70 group-hover:opacity-100">I want to hire trusted architects & builders for my project.</p>
                                </button>

                                {/* Professional Card */}
                                <button onClick={() => handleRoleSelect('PROFESSIONAL')} className="group text-left p-8 border border-white/10 bg-white/5 hover:bg-[#E0C9A6] hover:text-[#142620] transition-all duration-300 relative overflow-hidden">
                                    <div className="absolute top-4 right-4 opacity-50 group-hover:opacity-100"><Briefcase size={24} /></div>
                                    <h3 className="font-playfair text-2xl mb-2">I am a Professional</h3>
                                    <p className="text-sm opacity-70 group-hover:opacity-100">I am an Architect, Engineer, or Contractor looking for clients.</p>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: HOMEOWNER FORM */}
                    {step === 2 && role === 'HOMEOWNER' && (
                        <div className="max-w-md mx-auto">
                            <h2 className="font-playfair text-3xl text-white mb-2">Tell us about your vision.</h2>
                            <p className="text-gray-400 mb-8 text-sm">We'll match you with professionals who specialize in your needs.</p>
                            
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[#E0C9A6] text-xs uppercase tracking-widest mb-2">Project Type</label>
                                    <Select className="w-full">
                                        <option>New Residential Build</option>
                                        <option>Commercial Development</option>
                                        <option>Luxury Renovation</option>
                                        <option>Interior Design</option>
                                    </Select>
                                </div>
                                <div>
                                    <label className="block text-[#E0C9A6] text-xs uppercase tracking-widest mb-2">Project Location</label>
                                    <Select className="w-full" value={projectLocation} onChange={(e) => setProjectLocation(e.target.value)}>
                                        <option value="">Select a Location...</option>
                                        <option value="karen">Karen</option>
                                        <option value="runda">Runda</option>
                                        <option value="muthaiga">Muthaiga</option>
                                        <option value="kilimani">Kilimani / Kileleshwa</option>
                                        <option value="other">Other (Nairobi Environs)</option>
                                    </Select>
                                </div>
                                <div>
                                    <label className="block text-[#E0C9A6] text-xs uppercase tracking-widest mb-2">Estimated Budget (KES)</label>
                                    <Input placeholder="e.g. 5,000,000 - 15,000,000" />
                                </div>
                                
                                <div className="pt-4">
                                    <Button variant="default" className="w-full" size="lg">Create Account</Button>
                                    <button onClick={() => setStep(1)} className="w-full text-center text-gray-500 text-xs mt-4 hover:text-white">Go Back</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: PROFESSIONAL FORM */}
                    {step === 2 && role === 'PROFESSIONAL' && (
                        <div className="max-w-md mx-auto">
                            <h2 className="font-playfair text-3xl text-white mb-2">Join the Gold Standard.</h2>
                            <p className="text-gray-400 mb-8 text-sm">Verification is mandatory. Please have your NCA or board registration ready.</p>
                            
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[#E0C9A6] text-xs uppercase tracking-widest mb-2">Profession</label>
                                    <Select className="w-full" value={profession} onChange={(e) => setProfession(e.target.value)}>
                                        <option value="">Select Profession...</option>
                                        <option value="architect">Architect</option>
                                        <option value="contractor">General Contractor</option>
                                        <option value="interior">Interior Designer</option>
                                        <option value="engineer">Structural Engineer</option>
                                    </Select>
                                </div>
                                <div>
                                    <label className="block text-[#E0C9A6] text-xs uppercase tracking-widest mb-2">Company Name</label>
                                    <Input placeholder="Your Firm's Legal Name" />
                                </div>
                                <div>
                                    <label className="flex text-[#E0C9A6] text-xs uppercase tracking-widest mb-2 flex items-center justify-between">
                                        <span>NCA / Board License #</span>
                                        <span className="text-[10px] text-green-500 flex items-center gap-1"><ShieldCheck size={10} /> Required for Verification</span>
                                    </label>
                                    <Input placeholder="e.g. NCA/1234/5678" />
                                </div>
                                
                                <div className="pt-4">
                                    <Button variant="default" className="w-full" size="lg">Apply for Verification</Button>
                                    <button onClick={() => setStep(1)} className="w-full text-center text-gray-500 text-xs mt-4 hover:text-white">Go Back</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- STYLE QUIZ (INTERACTIVE) ---
const StyleQuiz = () => {
    const [step, setStep] = useState(0);
    const [result, setResult] = useState<QuizResult | null>(null);
    const questions: QuizQuestion[] = [
        { q: "Where do you find peace?", options: [{ label: "A luxury safari lodge", vibe: "Organic" }, { label: "A penthouse in Westlands", vibe: "Modern" }] },
        { q: "Pick a material:", options: [{ label: "Mahogany & Stone", vibe: "Organic" }, { label: "Glass & Steel", vibe: "Modern" }] },
    ];

    interface QuizOption {
      label: string;
      vibe: 'Organic' | 'Modern';
    }

    interface QuizQuestion {
      q: string;
      options: QuizOption[];
    }

    type QuizVibe = 'Organic' | 'Modern';
    type QuizResult = 'The Safari Modernist' | 'The Urban Minimalist';

    const handleAnswer = (vibe: QuizVibe): void => {
      if (step < questions.length - 1) {
        setStep(step + 1);
      } else {
        setResult(vibe === "Organic" ? "The Safari Modernist" : "The Urban Minimalist");
      }
    };

    return (
        <Card className="bg-[#0F1D18] border border-[#E0C9A6]/20 text-center p-8 max-w-md mx-auto rounded-none shadow-2xl relative z-10">
            {!result && questions[step] ? (
                <>
                    <Badge className="mb-4 border-[#E0C9A6]/50 text-[#E0C9A6]">Curate Your Aesthetic</Badge>
                    <h3 className="text-2xl font-playfair text-white mb-6">{questions[step].q}</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {questions[step].options.map((opt, i) => (
                            <button key={i} onClick={() => handleAnswer(opt.vibe)} className="py-4 border border-white/20 text-[#E0C9A6] hover:bg-[#E0C9A6] hover:text-[#142620] transition-all uppercase tracking-widest text-xs">
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </>
            ) : (
                <div className="animate-in fade-in zoom-in duration-500">
                    <h3 className="text-[#E0C9A6] text-sm uppercase tracking-widest mb-2">Your Style Is</h3>
                    <h2 className="text-3xl font-playfair text-white mb-4">{result}</h2>
                    <p className="text-gray-400 text-sm mb-6">Timeless, refined, and distinctly yours. We have 12 architects who specialize in this exact look.</p>
                    <Button variant="default" onClick={() => {setResult(null); setStep(0);}}>View Matches</Button>
                </div>
            )}
        </Card>
    );
};

// --- LANDING CONTENT ---
const LuxeLanding = () => {
    const luxeFAQs = [
      { q: "What qualifies a professional for the 'Gold Standard'?", a: "Excellence is non-negotiable. Our network consists strictly of NCA-certified entities with a verified portfolio of high-caliber projects in Kenya." },
      { q: "Is Build Market suitable for commercial developments?", a: "Precisely. Our directory includes Tier-1 architectural firms and engineering consultancies equipped for commercial and multi-unit residential projects." },
      { q: "How does the matchmaking process ensure privacy?", a: "Your project details remain discreet. Our intelligent matching system connects you only with relevant firms capable of executing your specific vision." },
    ];

    return (
        <div className="animate-in fade-in duration-500">
            {/* Hero Section */}
            <div className="relative z-10 container mx-auto px-4 md:px-10 flex flex-col justify-center pt-12 min-h-[80vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div className="text-center md:text-left">
                  <Badge className="mb-6">The Gold Standard</Badge>
                  <h1 className="font-playfair text-5xl md:text-7xl leading-tight mb-6 md:mb-8 text-white">Where Vision <br/><span className="italic text-[#E0C9A6]">Meets Craftsmanship.</span></h1>
                  <p className="text-gray-400 text-base md:text-lg font-light mb-8 md:mb-10 max-w-md leading-relaxed mx-auto md:mx-0">
                    Access an exclusive network of NCA-certified architects and master builders who value precision as much as you do.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center gap-6 justify-center md:justify-start">
                      <Button variant="default" size="lg">Discover Excellence</Button>
                      <Button variant="link"><span className="border-b border-white/30 pb-1">View Portfolio</span><ArrowRight size={16} /></Button>
                  </div>
                </div>
                
                {/* Style Quiz Widget */}
                <div className="relative w-full max-w-md mx-auto md:max-w-none mt-8 md:mt-0">
                    <StyleQuiz />
                </div>
              </div>
            </div>

            {/* Logo Strip */}
            <div className="w-full py-12 border-y border-white/5 bg-[#0F1D18]">
                <div className="container mx-auto px-4">
                    <p className="text-center text-xs font-bold uppercase tracking-widest mb-8 text-[#E0C9A6]/50">Trusted by Professionals & Featured In</p>
                    <div className="flex flex-wrap justify-center gap-12 md:gap-24 opacity-40 grayscale text-white font-playfair text-xl">
                        {["NCA Accredited", "AAK Member", "Kenya Homes", "Daily Nation", "Standard Media"].map((logo, i) => (
                            <span key={i}>{logo}</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Testimonials */}
            <div className="py-20 px-4 bg-[#142620]">
                <div className="container mx-auto max-w-6xl">
                    <h2 className="text-3xl md:text-4xl font-bold mb-16 text-center text-white font-playfair">Endorsed by the Industry's Best</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <Card className="p-8 h-full">
                                <div className="flex gap-1 mb-4 text-[#E0C9A6]"><Star size={16} fill="currentColor"/><Star size={16} fill="currentColor"/><Star size={16} fill="currentColor"/><Star size={16} fill="currentColor"/><Star size={16} fill="currentColor"/></div>
                                <p className="text-lg mb-6 leading-relaxed italic font-light text-gray-300">"An indispensable resource for sourcing top-tier architectural talent in East Africa. The vetting process is rigorous and reliable."</p>
                                <div className="flex items-center gap-4 mt-auto pt-6 border-t border-white/10">
                                    <div className="w-10 h-10 bg-[#E0C9A6] text-[#142620] rounded-full flex items-center justify-center font-bold">J</div>
                                    <div><p className="font-bold text-sm">James K.</p><p className="text-xs uppercase tracking-wider text-[#E0C9A6]">Commercial Developer</p></div>
                                </div>
                         </Card>
                         <Card className="p-8 h-full">
                                <div className="flex gap-1 mb-4 text-[#E0C9A6]"><Star size={16} fill="currentColor"/><Star size={16} fill="currentColor"/><Star size={16} fill="currentColor"/><Star size={16} fill="currentColor"/><Star size={16} fill="currentColor"/></div>
                                <p className="text-lg mb-6 leading-relaxed italic font-light text-gray-300">"We needed a landscape architect who understood our vision for a sustainable garden in Karen. Build Market matched us perfectly."</p>
                                <div className="flex items-center gap-4 mt-auto pt-6 border-t border-white/10">
                                    <div className="w-10 h-10 bg-[#E0C9A6] text-[#142620] rounded-full flex items-center justify-center font-bold">A</div>
                                    <div><p className="font-bold text-sm">Amina & David</p><p className="text-xs uppercase tracking-wider text-[#E0C9A6]">Private Residence</p></div>
                                </div>
                         </Card>
                    </div>
                </div>
            </div>

            {/* FAQ */}
            <div className="w-full py-16 px-4 md:px-10 bg-[#142620]">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-3xl font-bold mb-8 text-center text-white font-playfair">Curated Insights</h2>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                         {luxeFAQs.map((item, i) => (
                             <div key={i} className="border-b border-white/10 last:border-none py-4">
                                 <h4 className="text-[#E0C9A6] font-serif text-lg mb-2">{item.q}</h4>
                                 <p className="text-gray-400 text-sm leading-relaxed">{item.a}</p>
                             </div>
                         ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- FOOTER ---
const Footer = () => {
    return (
        <footer className="w-full pt-16 pb-8 bg-[#0F1D18] border-t border-white/5 text-[#E0C9A6]">
            <div className="container mx-auto px-4 md:px-10">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-12">
                    <div className="md:col-span-4 space-y-6">
                        <div className="text-2xl font-bold flex items-center gap-2 font-playfair"><Building2 /> BuildMarket</div>
                        <p className="text-sm leading-relaxed max-w-xs text-gray-400">The definitive platform for architectural excellence and premier construction in East Africa.</p>
                        <div className="flex gap-4 text-gray-400">
                            <Facebook size={20} className="hover:text-[#E0C9A6]" />
                            <Twitter size={20} className="hover:text-[#E0C9A6]" />
                            <Instagram size={20} className="hover:text-[#E0C9A6]" />
                            <Linkedin size={20} className="hover:text-[#E0C9A6]" />
                        </div>
                    </div>
                    <div className="md:col-span-2 space-y-4">
                        <h4 className="font-bold uppercase text-xs tracking-wider">Company</h4>
                        <ul className="space-y-2 text-sm text-gray-400"><li>About Us</li><li>Careers</li><li>Press</li></ul>
                    </div>
                    <div className="md:col-span-2 space-y-4">
                        <h4 className="font-bold uppercase text-xs tracking-wider">For Pros</h4>
                        <ul className="space-y-2 text-sm text-gray-400"><li>Join as a Pro</li><li>Pro Login</li><li>Success Stories</li></ul>
                    </div>
                    <div className="md:col-span-4 space-y-4">
                        <h4 className="font-bold uppercase text-xs tracking-wider">Stay Updated</h4>
                        <div className="flex gap-2">
                            <Input placeholder="Enter your email" className="bg-transparent text-sm border-[#E0C9A6]/30 text-white" />
                            <Button variant="default">Subscribe</Button>
                        </div>
                    </div>
                </div>
                <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1"><MapPin size={12} /> Made in Nairobi, Kenya. &copy; 2025 Build Market Ltd.</div>
                    <div className="flex gap-6"><span>Privacy Policy</span><span>Terms of Service</span></div>
                </div>
            </div>
        </footer>
    );
};

// ==========================================
// SECTION 5: MAIN LAYOUT
// ==========================================

export default function Page() {
  const [currentView, setCurrentView] = useState('landing'); // 'landing' | 'onboarding'

  return (
    <div className="flex flex-col min-h-screen w-full overflow-hidden bg-[#142620] font-manrope text-cream-50">
      <FontLoader />
      <ShaderErrorBoundary fallbackClass="bg-[#142620]">
         <div className="fixed inset-0 pointer-events-none z-0">
            <WavesShader />
         </div>
      </ShaderErrorBoundary>
      
      {/* Standalone Header */}
      <LuxeHeader 
          onSignUpClick={() => setCurrentView('onboarding')} 
          onLogoClick={() => setCurrentView('landing')}
      />

      {/* Main Content Switching */}
      <main className="flex-1 relative z-10 flex flex-col">
        {currentView === 'landing' ? <LuxeLanding /> : <LuxeOnboarding />}
        <Footer />
      </main>

      
    </div>
  );
}