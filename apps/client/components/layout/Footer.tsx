import { Building2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils"; 
import { 
  Camera, Palette, Hammer, ArrowRight, Star, CheckCircle, 
  ChevronRight, MousePointer2, Search, Menu, X, 
  LayoutGrid, Layers, Zap, AlertTriangle, Terminal, Sparkles, Send, Loader2,
  Home, User, Mail, ChevronDown, HelpCircle, Quote, ShieldCheck, Eye, Coins,
  Calculator, AlertOctagon, Check, Facebook, Twitter, Instagram, Linkedin,
  Briefcase, Map, PieChart, MessageSquare, FileText, Settings, LogOut, Bell, Plus
} from 'lucide-react';

export const Footer = () => {
    return (
        <footer className="w-full pt-16 pb-8 bg-[#0F1D18] border-t border-white/5 text-[#E0C9A6]">
            <div className="container mx-auto px-4 md:px-10">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-12">
                    <div className="md:col-span-4 space-y-6">
                        <div className="text-2xl font-bold flex items-center gap-2 font-playfair"><Building2 /> BuildMarket</div>
                        <p className="text-sm leading-relaxed max-w-xs text-gray-400">The definitive platform for architectural excellence and premier construction in East Africa.</p>
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
