"use client";

import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { Toggle } from "./Toggle";
import type { CategoryConfig } from "./categories";

interface CookieCategoryCardProps {
  category: CategoryConfig;
  index: number;
  checked: boolean;
  onToggle: (value: boolean) => void;
}

export function CookieCategoryCard({
  category,
  index,
  checked,
  onToggle,
}: CookieCategoryCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className={`bg-white/3 backdrop-blur-sm border ${category.borderColor} rounded-2xl overflow-hidden`}
    >
      <div className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2.5 mb-2">
              <span className="text-xl">{category.emoji}</span>
              <h2 className="text-lg font-bold text-white">{category.label}</h2>
              {category.locked && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-zinc-700 text-zinc-400 uppercase tracking-wider font-semibold">
                  <Lock className="w-2.5 h-2.5" /> Always On
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {category.description}
            </p>
          </div>
          <div className="shrink-0 pt-1">
            <Toggle
              checked={checked}
              onChange={onToggle}
              disabled={category.locked}
            />
          </div>
        </div>

        {category.cookies.length > 0 && (
          <div className="mt-4 bg-white/2 rounded-lg border border-white/5 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-2 px-3 text-zinc-500 font-medium">
                    Cookie
                  </th>
                  <th className="text-left py-2 px-3 text-zinc-500 font-medium hidden sm:table-cell">
                    Purpose
                  </th>
                  <th className="text-right py-2 px-3 text-zinc-500 font-medium">
                    Expiry
                  </th>
                </tr>
              </thead>
              <tbody>
                {category.cookies.map((cookie) => (
                  <tr
                    key={cookie.name}
                    className="border-b border-white/3 last:border-0"
                  >
                    <td className="py-2 px-3 text-emerald-400 font-mono">
                      {cookie.name}
                    </td>
                    <td className="py-2 px-3 text-zinc-500 hidden sm:table-cell">
                      {cookie.purpose}
                    </td>
                    <td className="py-2 px-3 text-zinc-500 text-right">
                      {cookie.expiry}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
