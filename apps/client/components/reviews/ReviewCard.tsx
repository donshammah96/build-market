import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';

interface Review {
  quote: string;
  name: string;
  description: string;
  image: string;
}

const ReviewCard: React.FC<Review> = ({ quote, name, description, image }) => {
  return (
    <motion.div
      whileHover={{ y: -8 }}
      transition={{ duration: 0.3 }}
      className="h-full"
    >
      <Card className="hover:shadow-xl transition-shadow h-full flex flex-col">
        <CardHeader>
          <p className="text-black sm:text-2xl font-medium font-inter leading-7 sm:leading-9">{quote}</p>
        </CardHeader>
        <CardContent className="mt-auto">
          <div className="flex items-center gap-4">
            <Avatar>
              <AvatarImage 
                src={image} 
                alt={`${name}'s avatar`}
              />
              <AvatarFallback>{name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5">
              <span className="text-black text-base font-medium font-inter leading-6">{name}</span>
              <span className="text-zinc-500 text-base font-medium font-inter leading-6">{description}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
export default ReviewCard;