import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card';

interface Store {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  href: string;
}

const StoreCard: React.FC<Store> = ({ title, description, image, imageAlt }) => (
  <motion.div
    whileHover={{ y: -8 }}
    transition={{ duration: 0.3 }}
    className="h-full"
  >
    <Card className="overflow-hidden hover:shadow-xl transition-shadow h-full flex flex-col">
      <motion.div
        whileHover={{ scale: 1.05 }}
        transition={{ duration: 0.3 }}
        className="relative h-80 overflow-hidden"
      >
        <Image
          src={image}
          alt={imageAlt || title}
          fill
          className="object-cover"
          blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
          placeholder="blur"
          loading="lazy"
          quality={85}
        />
      </motion.div>
      <CardHeader>
        <CardTitle className="text-2xl font-medium font-inter leading-9">{title}</CardTitle>
        <CardDescription className="text-2xl font-normal font-inter leading-9">{description}</CardDescription>
      </CardHeader>
    </Card>
  </motion.div>
);

export default StoreCard;