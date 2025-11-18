import Image from 'next/image';
import { FC } from "react";
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../ui/carousel';
import { ArrowRight } from 'lucide-react';

interface Feature {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  href: string;
  images?: string[]; // Optional array of additional images for carousel
}

const FeatureCard: FC<Feature> = ({ title, description, image, imageAlt, href, images }) => {
  // Combine single image with additional images if provided
  const allImages = images && images.length > 0 ? [image, ...images] : [image];
  const hasMultipleImages = allImages.length > 1;

  return (
    <motion.div
      whileHover={{ y: -8 }}
      transition={{ duration: 0.3 }}
      className="h-full"
    >
      <Card className="overflow-hidden hover:shadow-xl transition-shadow h-full flex flex-col">
        <div className="relative h-96 overflow-hidden">
          {hasMultipleImages ? (
            <Carousel
              opts={{
                align: "start",
                loop: true,
              }}
              className="w-full h-full"
            >
              <CarouselContent className="h-full">
                {allImages.map((img, index) => (
                  <CarouselItem key={index} className="h-full pl-0">
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.3 }}
                      className="relative h-full w-full"
                    >
                      <Image
                        src={img}
                        alt={`${imageAlt} - Image ${index + 1}`}
                        fill
                        className="object-cover"
                        blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
                        placeholder="blur"
                        loading={index === 0 ? "eager" : "lazy"}
                        quality={85}
                      />
                    </motion.div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-2 opacity-80 hover:opacity-100" />
              <CarouselNext className="right-2 opacity-80 hover:opacity-100" />
            </Carousel>
          ) : (
            <motion.div
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.3 }}
              className="relative h-full w-full"
            >
              <Image
                src={image}
                alt={imageAlt}
                fill
                className="object-cover"
                blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
                placeholder="blur"
                loading="lazy"
                quality={85}
              />
            </motion.div>
          )}
        </div>
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl font-medium font-inter leading-7 sm:leading-9">{title}</CardTitle>
          <CardDescription className="text-xl sm:text-2xl font-normal font-inter leading-7 sm:leading-9">{description}</CardDescription>
        </CardHeader>
        <CardContent className="mt-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button variant="secondary" className="w-full group" asChild>
              <Link href={href} className="inline-flex items-center justify-center gap-2">
                Explore more!
                <motion.span
                  animate={{ x: [0, 4, 0] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  aria-hidden
                >
                  <ArrowRight className="h-4 w-4" />
                </motion.span>
              </Link>
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default FeatureCard;