"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldAlert, ArrowLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = 'force-dynamic';

const UnauthorizedPage = () => {
  const { signOut } = useAuth();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 overflow-hidden relative">
      
      {/* Background Pattern (Architectural Grid) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="border-zinc-200 shadow-2xl bg-white/90 backdrop-blur-xl overflow-hidden">
          <div className="h-1.5 w-full bg-red-500" /> {/* Status Indicator Line */}
          
          <CardContent className="pt-10 pb-8 px-8 text-center flex flex-col items-center">
            
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="h-20 w-20 bg-red-50 rounded-full flex items-center justify-center mb-6 border border-red-100 shadow-sm"
            >
              <ShieldAlert className="h-10 w-10 text-red-500" />
            </motion.div>

            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight mb-3">
              Access Restricted
            </h1>
            
            <p className="text-zinc-500 text-sm leading-relaxed mb-8 max-w-[280px] mx-auto">
              You do not have the necessary permissions to view this page. This area is restricted to authorized personnel only.
            </p>

            <div className="flex flex-col gap-3 w-full">
              <Button 
                onClick={() => signOut({ redirectUrl: '/' })} 
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white h-11 shadow-sm transition-all hover:shadow-md"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => router.push('/')}
                className="w-full border-zinc-200 hover:bg-zinc-50 text-zinc-600 h-11"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Return to Home
              </Button>
            </div>

          </CardContent>
        </Card>
        
        <div className="text-center mt-8 space-y-2">
          <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-medium">
            Build Market Security
          </p>
          <p className="text-[10px] text-zinc-300 font-mono">
            Error Code: 403_FORBIDDEN
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default UnauthorizedPage;