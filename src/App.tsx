import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  User, 
  Lock, 
  Eye, 
  AlertTriangle, 
  MessageSquare, 
  Settings, 
  BarChart3,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Zap
} from 'lucide-react';
import Scene from './components/Scene';
import { GoogleGenAI } from "@google/genai";

// Types
type Role = 'Student' | 'Professional' | 'Senior' | 'Child' | 'Parent';

interface UserProfile {
  name: string;
  age: number;
  education: string;
  role: Role;
  goals: string;
  linkedChild?: string; // For Parent role
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  flagged?: boolean;
}

interface LogEntry {
  timestamp: Date;
  intent: string;
  status: 'Allowed' | 'Blocked';
  details: string;
}

// Constants
const ROLE_RESTRICTIONS: Record<Role, { allow: string[]; block: string[] }> = {
  Child: {
    allow: ['Storytelling', 'Basic Math', 'Nature'],
    block: ['Social Media', 'Violence', 'Complex Science', 'Gambling', 'Abuse', 'Exploitation', 'Stranger Interaction']
  },
  Student: {
    allow: ['STEM', 'History', 'Literature', 'Coding'],
    block: ['Gambling', 'Deepfake Tools', 'Social Media Hacks', 'Explicit Content', 'Cyberbullying', 'Harassment']
  },
  Professional: {
    allow: ['Business', 'Advanced Tech', 'Legal', 'Medical'],
    block: ['Illegal Activities', 'Malware Creation', 'Human Trafficking', 'Exploitation']
  },
  Senior: {
    allow: ['Health', 'Finance', 'Communication', 'Hobbies'],
    block: ['Scams', 'Complex Tech jargon', 'Phishing', 'Identity Theft']
  },
  Parent: {
    allow: ['Parenting Tips', 'Child Safety', 'Educational Resources', 'Family Planning'],
    block: ['Inappropriate Content', 'Illegal Activities', 'Exploitation Awareness']
  }
};

export default function App() {
  const [step, setStep] = useState<'landing' | 'signup' | 'dashboard'>('landing');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [alerts, setAlerts] = useState<number>(0);
  const [sessionStartTime] = useState<Date>(new Date());
  const [timeSpent, setTimeSpent] = useState<number>(0);
  const [theme, setTheme] = useState<string>('default');
  const [selectedRole, setSelectedRole] = useState<Role>('Child');
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - sessionStartTime.getTime()) / 1000);
      setTimeSpent(diff);
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionStartTime]);

  useEffect(() => {
    if (user) {
      if (user.role === 'Child') setTheme('child');
      else if (user.role === 'Student') {
        const goals = user.goals.toLowerCase();
        if (goals.includes('science') || goals.includes('tech')) setTheme('science');
        else if (goals.includes('art') || goals.includes('design')) setTheme('arts');
        else if (goals.includes('business') || goals.includes('finance')) setTheme('business');
        else if (goals.includes('medical') || goals.includes('health')) setTheme('medical');
      }
    }
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSignUp = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const profile: UserProfile = {
      name: formData.get('name') as string,
      age: parseInt(formData.get('age') as string),
      education: formData.get('education') as string,
      role: formData.get('role') as Role,
      goals: formData.get('goals') as string,
      linkedChild: formData.get('linkedChild') as string,
    };
    setUser(profile);
    setStep('dashboard');
    
    if (profile.role === 'Parent') {
      setTheme('business'); // Professional theme for parents
      setMessages([
        { 
          role: 'system', 
          content: `Parent Mode Active. Syncing with ${profile.linkedChild}'s profile...` 
        },
        {
          role: 'assistant',
          content: `Welcome back, ${profile.name}. I've synced your dashboard with ${profile.linkedChild}'s recent activity. You can track their progress, time spent, and knowledge focus below.`
        }
      ]);
      return;
    }
    
    // Initial system message
    setMessages([
      { 
        role: 'system', 
        content: `License Active: ${profile.role} Mode. Guardian AI is here to support you!` 
      },
      {
        role: 'assistant',
        content: `Hi ${profile.name}! I'm your Guardian AI companion. I'm so excited to help you with your goals in ${profile.goals}. How has your day been so far?`
      }
    ]);
  };

  const analyzeIntent = (text: string, role: Role): { allowed: boolean; reason: string } => {
    const lowerText = text.toLowerCase();
    
    // Dynamic theme update based on search
    if (role === 'Student') {
      if (lowerText.includes('science') || lowerText.includes('physics') || lowerText.includes('biology')) setTheme('science');
      else if (lowerText.includes('art') || lowerText.includes('paint') || lowerText.includes('music')) setTheme('arts');
      else if (lowerText.includes('money') || lowerText.includes('stock') || lowerText.includes('market')) setTheme('business');
      else if (lowerText.includes('doctor') || lowerText.includes('anatomy') || lowerText.includes('medicine')) setTheme('medical');
    }

    const restrictions = ROLE_RESTRICTIONS[role];
    
    // Simple semantic check
    for (const blocked of restrictions.block) {
      if (lowerText.includes(blocked.toLowerCase())) {
        return { allowed: false, reason: `Topic "${blocked}" is restricted for ${role} License.` };
      }
    }
    
    // General malicious intent check
    const maliciousKeywords = [
      'hack', 'bypass', 'exploit', 'illegal', 'deepfake', 'malware',
      'abuse', 'harass', 'bully', 'groom', 'exploit', 'traffick', 'porn', 'explicit'
    ];
    for (const kw of maliciousKeywords) {
      if (lowerText.includes(kw)) {
        return { allowed: false, reason: 'Strict Safety Protocol: Potential abuse or exploitation intent detected.' };
      }
    }
    
    return { allowed: true, reason: 'Safe' };
  };

  const sendMessage = async () => {
    if (!input.trim() || !user) return;

    const userMessage = input;
    setInput('');
    
    // 1. Intent Filter
    const analysis = analyzeIntent(userMessage, user.role);
    
    const newLogs: LogEntry = {
      timestamp: new Date(),
      intent: userMessage.slice(0, 30) + '...',
      status: analysis.allowed ? 'Allowed' : 'Blocked',
      details: analysis.reason
    };
    setLogs(prev => [newLogs, ...prev]);

    if (!analysis.allowed) {
      setMessages(prev => [...prev, 
        { role: 'user', content: userMessage },
        { role: 'system', content: `[BLOCK] ${analysis.reason}`, flagged: true }
      ]);
      setAlerts(prev => prev + 1);
      return;
    }

    // 2. System Prompt Layering
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const result = await ai.models.generateContent({ 
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: userMessage }] }],
        config: {
          systemInstruction: `You are a supportive, friendly, and emotionally intelligent AI companion named Guardian AI. 
          Your goal is to help a ${user.role} with their research and daily life while keeping things fun and engaging.
          
          User Profile: ${user.name}, Age ${user.age}, Education: ${user.education}, Goals: ${user.goals}.
          
          Persona Guidelines:
          1. Be conversational: Ask about their day, their feelings, and their progress.
          2. Emotional Support: If they seem stressed or tired, offer encouragement and kind words.
          3. Educational & Fun: Make research feel like an adventure. Use analogies and exciting language.
          4. Age-Appropriate: 
             - For a Child: Use simple words, emojis, and a playful, "cartoon-character" like energy.
             - For a Student: Be like a cool, supportive mentor who knows a lot about their major (${theme}).
          5. Safety & Ethics: 
             - Adhere strictly to these allowed topics: ${ROLE_RESTRICTIONS[user.role].allow.join(', ')}.
             - ZERO TOLERANCE for abuse, harassment, or online exploitation. 
             - If the user mentions anything related to being groomed, bullied, or exploited, immediately provide supportive resources and advise them to talk to a trusted adult.
             - Politely decline any requests outside these boundaries, but do it kindly.`
        }
      });
      const response = result.text;
      
      setMessages(prev => [...prev, { role: 'assistant', content: response || 'No response from AI.' }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'system', content: 'Error connecting to AI engine.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const getThemeColor = () => {
    switch (theme) {
      case 'child': return 'var(--theme-child)';
      case 'science': return 'var(--theme-science)';
      case 'arts': return 'var(--theme-arts)';
      case 'medical': return 'var(--theme-medical)';
      default: return 'var(--color-accent)';
    }
  };

  const Mascot = ({ type }: { type: string }) => {
    const mascots: Record<string, { color: string, icon: React.ReactNode, text: string }> = {
      child: { color: 'bg-pink-400', icon: '🌈', text: "Let's play and learn!" },
      science: { color: 'bg-blue-500', icon: '🤖', text: "Analyzing data..." },
      arts: { color: 'bg-amber-500', icon: '🎨', text: "Creating magic!" },
      medical: { color: 'bg-red-500', icon: '❤️', text: "Stay healthy!" },
      business: { color: 'bg-emerald-500', icon: '💼', text: "Strategic thinking." },
      default: { color: 'bg-accent', icon: '🛡️', text: "Guardian Active." }
    };

    const mascot = mascots[type] || mascots.default;

    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0 }}
        className="fixed bottom-24 left-8 z-40 pointer-events-none"
      >
        <div className="relative">
          <motion.div 
            animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
            transition={{ repeat: Infinity, duration: 4 }}
            className={`w-20 h-20 ${mascot.color} rounded-full flex items-center justify-center shadow-lg border-4 border-white text-3xl`}
          >
            {mascot.icon}
          </motion.div>
          <div className="absolute -top-12 -left-4 glass p-2 rounded-xl text-[10px] font-bold text-white whitespace-nowrap shadow-xl border border-white/20">
            {mascot.text}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen relative" style={{ '--color-accent': getThemeColor() } as React.CSSProperties}>
      <Scene theme={theme} />
      
      {/* Dynamic Mascot */}
      <AnimatePresence>
        {step === 'dashboard' && <Mascot type={theme} />}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center glass-dark">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.5)]">
            <Shield className="w-5 h-5 text-black" />
          </div>
          <span className="text-xl font-serif font-bold tracking-tight text-glow">GUARDIAN AI</span>
        </div>
        
        {step === 'dashboard' && user && (
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-medium uppercase tracking-wider">
              {user.role} License
            </div>
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
              <User className="w-4 h-4" />
            </div>
          </div>
        )}
      </nav>

      <main className="pt-24 pb-12 px-6 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {step === 'landing' && (
            <motion.div 
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center min-h-[70vh] text-center"
            >
              <motion.h1 
                className="text-6xl md:text-8xl font-bold mb-6 leading-tight"
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                AI Safety for the <br />
                <span className="text-accent italic">Next Generation</span>
              </motion.h1>
              <p className="text-xl text-white/60 max-w-2xl mb-12 font-light leading-relaxed">
                Guardian AI is a comprehensive governance platform. 
                Parents can monitor search history, track time spent, and set 
                strict ethical boundaries for their children's AI interactions.
              </p>
              <button 
                onClick={() => setStep('signup')}
                className="group relative px-8 py-4 bg-accent text-black font-bold rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Initialize License <ChevronRight className="w-5 h-5" />
                </span>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </button>
            </motion.div>
          )}

          {step === 'signup' && (
            <motion.div 
              key="signup"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="max-w-xl mx-auto glass p-8 rounded-3xl"
            >
              <h2 className="text-3xl font-bold mb-2">License Registration</h2>
              <p className="text-white/50 mb-8">Define your persona to calibrate the governance engine.</p>
              
              <form onSubmit={handleSignUp} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-white/40 font-bold">Full Name</label>
                  <input 
                    required 
                    name="name"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-accent focus:outline-none transition-colors"
                    placeholder="Enter your name"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-white/40 font-bold">Age</label>
                    <input 
                      required 
                      name="age"
                      type="number"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-accent focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-white/40 font-bold">Role</label>
                    <select 
                      name="role"
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value as Role)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-accent focus:outline-none transition-colors appearance-none"
                    >
                      <option value="Child">Child</option>
                      <option value="Student">Student</option>
                      <option value="Professional">Professional</option>
                      <option value="Senior">Senior</option>
                      <option value="Parent">Parent</option>
                    </select>
                  </div>
                </div>

                <AnimatePresence>
                  {selectedRole === 'Parent' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                      <label className="text-xs uppercase tracking-widest text-white/40 font-bold">Child's Name (to sync)</label>
                      <input 
                        required 
                        name="linkedChild"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-accent focus:outline-none transition-colors"
                        placeholder="e.g. Leo"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-white/40 font-bold">Education Level</label>
                  <input 
                    required 
                    name="education"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-accent focus:outline-none transition-colors"
                    placeholder="e.g. High School, PhD"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-white/40 font-bold">Primary Goals</label>
                  <textarea 
                    required 
                    name="goals"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-accent focus:outline-none transition-colors h-24 resize-none"
                    placeholder="What do you want to achieve with AI?"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-accent text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all"
                >
                  Generate License
                </button>
              </form>
            </motion.div>
          )}

          {step === 'dashboard' && user && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-10rem)]"
            >
              {/* Left Column: Chat */}
              <div className="lg:col-span-8 flex flex-col glass rounded-3xl overflow-hidden">
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-accent" />
                    <span className="font-medium">AI Interaction Engine</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/40">
                    <Lock className="w-3 h-3" /> Encrypted Session
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {messages.map((msg, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] p-4 rounded-2xl ${
                        msg.role === 'user' 
                          ? 'bg-accent text-black font-medium' 
                          : msg.flagged 
                            ? 'bg-red-500/20 border border-red-500/30 text-red-200'
                            : 'bg-white/5 border border-white/10'
                      }`}>
                        {msg.flagged && <AlertTriangle className="w-4 h-4 mb-2" />}
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </motion.div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex gap-1">
                        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-accent rounded-full" />
                        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-accent rounded-full" />
                        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-accent rounded-full" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-4 bg-white/5 border-t border-white/10">
                  <div className="relative">
                    <input 
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder={`Ask anything within your ${user.role} license...`}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 pr-16 focus:border-accent focus:outline-none transition-all"
                    />
                    <button 
                      onClick={sendMessage}
                      className="absolute right-2 top-2 bottom-2 px-4 bg-accent text-black rounded-xl font-bold hover:scale-105 transition-transform"
                    >
                      <Zap className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Monitoring & Stats */}
              <div className="lg:col-span-4 space-y-6 flex flex-col">
                {/* Guardian Dashboard */}
                <div className="glass rounded-3xl p-6 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-accent" />
                      <h3 className="font-bold">{user.role === 'Parent' ? `${user.linkedChild}'s Activity` : 'Guardian Dashboard'}</h3>
                    </div>
                    {alerts > 0 && (
                      <div className="px-2 py-0.5 bg-red-500 text-[10px] font-bold rounded flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="w-3 h-3" /> {alerts} ALERTS
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 flex-1 overflow-y-auto pr-2">
                    {user.role === 'Parent' && (
                      <div className="p-4 rounded-2xl bg-accent/10 border border-accent/20 mb-4">
                        <div className="text-[10px] uppercase tracking-widest text-accent font-bold mb-2">Weekly Improvement</div>
                        <div className="flex items-end gap-1 h-12">
                          {[40, 60, 45, 70, 85, 90, 95].map((h, i) => (
                            <motion.div 
                              key={i}
                              initial={{ height: 0 }}
                              animate={{ height: `${h}%` }}
                              className="flex-1 bg-accent rounded-t-sm"
                            />
                          ))}
                        </div>
                        <div className="mt-2 text-[10px] text-white/40 flex justify-between">
                          <span>Mon</span>
                          <span>Sun</span>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                        <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Status</div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold">Active</span>
                          <CheckCircle2 className="w-4 h-4 text-accent" />
                        </div>
                      </div>
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                        <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Time Spent</div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold">{Math.floor(timeSpent / 60)}m {timeSpent % 60}s</span>
                          <Zap className="w-4 h-4 text-accent" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[10px] uppercase tracking-widest text-white/40">Parental Audit Log</div>
                      {logs.length === 0 ? (
                        <div className="text-center py-8 text-white/20 text-sm italic">No logs generated yet</div>
                      ) : (
                        logs.map((log, i) => (
                          <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {log.status === 'Allowed' ? <CheckCircle2 className="w-3 h-3 text-accent" /> : <XCircle className="w-3 h-3 text-red-500" />}
                                <span className={log.status === 'Allowed' ? 'text-accent' : 'text-red-500'}>{log.status}</span>
                                <span className="text-white/20">•</span>
                                <span className="text-white/40">{log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                              </div>
                              <div className="text-white/80 font-mono truncate">{log.intent}</div>
                              {log.status === 'Blocked' && <div className="text-red-400/60 mt-1 italic">{log.details}</div>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-white/10">
                    <div className="flex items-center justify-between text-xs mb-4">
                      <span className="text-white/40">Knowledge Focus</span>
                      <span className="text-accent uppercase font-bold">{theme === 'default' ? 'General' : theme}</span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '84%' }}
                        className="h-full bg-accent" 
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Controls & Guidelines */}
                <div className="glass rounded-3xl p-6 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-accent" />
                    <h3 className="font-bold text-sm">Strict Safety Protocols</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center text-[10px] font-bold text-red-400 shrink-0">!</div>
                      <p className="text-[11px] text-white/60 leading-tight font-bold">ZERO TOLERANCE for abuse, harassment, or exploitation.</p>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent shrink-0">1</div>
                      <p className="text-[11px] text-white/60 leading-tight">Never share personal details like your address or school name with the AI.</p>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent shrink-0">2</div>
                      <p className="text-[11px] text-white/60 leading-tight">If the AI says something that makes you uncomfortable, tell a parent immediately.</p>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent shrink-0">3</div>
                      <p className="text-[11px] text-white/60 leading-tight">Report any suspicious behavior to a trusted adult or use the 'Help' button.</p>
                    </div>
                  </div>
                </div>

                <div className="glass rounded-3xl p-4 flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="text-xs font-bold text-red-400 uppercase tracking-widest">Emergency Help</span>
                  </div>
                  <p className="text-[10px] text-white/40 leading-tight">Facing online abuse? Contact Childhelp National Child Abuse Hotline: 1-800-422-4453</p>
                  <div className="grid grid-cols-2 gap-4">
                    <button className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors gap-2">
                      <Settings className="w-5 h-5 text-white/40" />
                      <span className="text-[10px] uppercase tracking-widest font-bold">Settings</span>
                    </button>
                    <button className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors gap-2">
                      <Eye className="w-5 h-5 text-white/40" />
                      <span className="text-[10px] uppercase tracking-widest font-bold">Privacy</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center text-[10px] uppercase tracking-[0.2em] text-white/20 pointer-events-none">
        <div>System Version 2.4.0_GUARDIAN</div>
        <div>Parental Controls Active</div>
      </footer>
    </div>
  );
}
