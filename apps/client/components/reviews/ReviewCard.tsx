import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '../ui/card'; // We only need Content and strict styling
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { Star, Quote, BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming you have a cn utility from shadcn

interface ReviewProps {
  quote: string;
  name: string;
  location?: string;
  role?: string;
  image: string;
  rating?: number;
}

const ReviewCard: React.FC<ReviewProps> = ({ 
  quote, 
  name, 
  location = "Nairobi, Kenya", 
  role = "Homeowner", 
  image, 
  rating = 5 
}) => {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      transition={{ duration: 0.3 }}
      className="h-full"
    >
      <Card className="h-full border-zinc-100 bg-white shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col p-6 rounded-2xl relative overflow-hidden group">
        
        {/* Background Decoration Quote Icon */}
        <div className="absolute top-4 right-6 opacity-5 group-hover:opacity-10 transition-opacity">
           <Quote size={80} className="text-emerald-600 fill-emerald-600" />
        </div>

        {/* Rating Stars */}
        <div className="flex gap-1 mb-4">
          {[...Array(5)].map((_, i) => (
            <Star 
              key={i} 
              size={16} 
              className={cn(
                "fill-current", 
                i < rating ? "text-amber-400" : "text-gray-200"
              )} 
            />
          ))}
        </div>

        {/* Quote Content */}
        <div className="flex-grow mb-6 relative z-10">
          <p className="text-zinc-700 text-lg leading-relaxed font-medium font-inter">
            &ldquo;{quote}&rdquo;
          </p>
        </div>

        {/* Footer: User Info */}
        <div className="flex items-center gap-3 mt-auto pt-4 border-t border-zinc-50">
          <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
            <AvatarImage src={image} alt={`${name}'s avatar`} className="object-cover" />
            <AvatarFallback className="bg-emerald-50 text-emerald-700 font-bold">
              {name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-900 font-semibold text-sm">{name}</span>
              {/* Verified Badge */}
              <BadgeCheck size={14} className="text-emerald-500" />
            </div>
            <span className="text-zinc-500 text-xs font-medium">
              {role} • {location}
            </span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};
export default ReviewCard;