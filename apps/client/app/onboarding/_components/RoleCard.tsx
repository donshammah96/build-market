import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Props for RoleCard component */
interface RoleCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  delay: number;
  highlight?: boolean;
  prefersReducedMotion?: boolean;
}

export const RoleCard: React.FC<RoleCardProps> = ({
  icon,
  title,
  description,
  onClick,
  delay,
  highlight,
  prefersReducedMotion = false,
}) => (
  <motion.button
    initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: prefersReducedMotion ? 0.1 : 0.5 }}
    whileHover={prefersReducedMotion ? undefined : { y: -5, scale: 1.02 }}
    whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
    onClick={onClick}
    className={cn(
      "group relative flex flex-col items-start text-left p-8 rounded-2xl transition-all duration-300 border",
      "bg-zinc-900/40 backdrop-blur-md hover:bg-zinc-800/60",
      highlight
        ? "border-emerald-500/30 hover:border-emerald-500/60 hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.15)]"
        : "border-white/10 hover:border-white/20 hover:shadow-xl",
    )}
  >
    <div
      className={cn(
        "mb-6 p-4 rounded-xl transition-colors duration-300",
        highlight
          ? "bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white"
          : "bg-white/5 text-zinc-400 group-hover:bg-white group-hover:text-zinc-900",
      )}
    >
      {icon}
    </div>
    <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-emerald-400 transition-colors">
      {title}
    </h3>
    <p className="text-zinc-400 text-sm leading-relaxed group-hover:text-zinc-300">
      {description}
    </p>
  </motion.button>
);
