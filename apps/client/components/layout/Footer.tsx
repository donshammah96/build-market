import React from 'react';
import Link from 'next/link';
import { motion } from "framer-motion";
import { 
  MapPin, 
  Instagram, 
  Linkedin, 
  Twitter, 
  Facebook, 
  Mail, 
  Phone, 
  ArrowRight 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/lib/links";

export const Footer = () => {
    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const currentYear = new Date().getFullYear();

    return (
        <footer className="w-full bg-white border-t border-zinc-100 pt-16 pb-8">
            <div className="container mx-auto px-4 md:px-10 max-w-[1280px]">
                
                {/* Top Section: Grid Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8 mb-16">
                    
                    {/* Brand Column */}
                    <div className="lg:col-span-4 space-y-6">
                        <motion.div 
                            whileHover={{ scale: 1.02 }}
                            onClick={scrollToTop} 
                            className="cursor-pointer inline-flex items-center gap-2"
                        >
                            {/* Optional: Add Logo Icon here if available */}
                            <span className="text-2xl font-bold text-zinc-900 tracking-tight">
                                Build<span className="text-emerald-600">Market</span>
                            </span>
                        </motion.div>
                        <p className="text-zinc-500 text-sm leading-relaxed max-w-sm">
                            The definitive platform connecting Kenyan homeowners with top-tier architects, engineers, and trusted fundis.
                        </p>
                        
                        {/* Social Links */}
                        <div className="flex items-center gap-4 pt-2">
                            <SocialIcon icon={<Instagram size={18} />} href="#" label="Instagram" />
                            <SocialIcon icon={<Linkedin size={18} />} href="#" label="LinkedIn" />
                            <SocialIcon icon={<Twitter size={18} />} href="#" label="Twitter" />
                            <SocialIcon icon={<Facebook size={18} />} href="#" label="Facebook" />
                        </div>
                    </div>

                    {/* Links Column 1: Company */}
                    <div className="lg:col-span-2 space-y-6">
                        <h4 className="font-semibold text-zinc-900 text-sm tracking-wide">Company</h4>
                        <ul className="space-y-3">
                            <FooterLink href={ROUTES.home}>About Us</FooterLink>
                            <FooterLink href={ROUTES.home}>Careers</FooterLink>
                            <FooterLink href={ROUTES.reviews}>Success Stories</FooterLink>
                            <FooterLink href={ROUTES.home}>Press</FooterLink>
                        </ul>
                    </div>

                    {/* Links Column 2: Resources */}
                    <div className="lg:col-span-2 space-y-6">
                        <h4 className="font-semibold text-zinc-900 text-sm tracking-wide">Resources</h4>
                        <ul className="space-y-3">
                            <FooterLink href={ROUTES.joinAsPro}>Join as a Pro</FooterLink>
                            <FooterLink href={ROUTES.ideaBooks}>Idea Books</FooterLink>
                            <FooterLink href={ROUTES.findProfessional}>Find Professionals</FooterLink>
                            <FooterLink href={ROUTES.home}>Help Center</FooterLink>
                        </ul>
                    </div>

                    {/* Newsletter / Contact Column */}
                    <div className="lg:col-span-4 space-y-6">
                        <h4 className="font-semibold text-zinc-900 text-sm tracking-wide">Stay Connected</h4>
                        <p className="text-sm text-zinc-500 mb-4">
                            Get the latest design trends and market insights delivered to your inbox.
                        </p>
                        <div className="flex gap-2 max-w-md">
                            <Input 
                                placeholder="Enter your email" 
                                className="bg-zinc-50 border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500 transition-all" 
                            />
                            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shrink-0">
                                <ArrowRight size={18} />
                            </Button>
                        </div>
                        
                        {/* Contact Info (Crucial for Trust in Kenya) */}
                        <div className="pt-6 mt-6 border-t border-zinc-100 space-y-3">
                            <div className="flex items-center gap-3 text-sm text-zinc-500">
                                <Mail size={16} className="text-emerald-600" />
                                <span>hello@buildmarket.co.ke</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-zinc-500">
                                <Phone size={16} className="text-emerald-600" />
                                <span>+254 791 938 881</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-zinc-100 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-zinc-500">
                    <div className="flex items-center gap-1.5">
                        <MapPin size={14} className="text-emerald-600" /> 
                        <span className="font-medium">Nairobi, Kenya</span>
                        <span className="mx-2 text-zinc-300">|</span>
                        <span>&copy; {currentYear} Build Market Ltd.</span>
                    </div>
                    <div className="flex gap-6 font-medium">
                        <Link href="#" className="hover:text-emerald-600 transition-colors">Privacy Policy</Link>
                        <Link href="#" className="hover:text-emerald-600 transition-colors">Terms of Service</Link>
                        <Link href="#" className="hover:text-emerald-600 transition-colors">Cookie Settings</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};

// Helper Components for Cleaner Code

const FooterLink = ({ href, children }: { href: string, children: React.ReactNode }) => (
    <li>
        <Link 
            href={href} 
            className="text-sm text-zinc-500 hover:text-emerald-600 hover:translate-x-1 transition-all duration-200 inline-block"
        >
            {children}
        </Link>
    </li>
);

const SocialIcon = ({ icon, href, label }: { icon: React.ReactNode, href: string, label: string }) => (
    <Link 
        href={href} 
        aria-label={label}
        className="h-8 w-8 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-600 hover:bg-emerald-600 hover:text-white transition-all duration-300"
    >
        {icon}
    </Link>
);

export default Footer;