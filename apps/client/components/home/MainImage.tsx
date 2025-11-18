import Image from "next/image";
import { FC, useRef } from "react";
import { motion, useInView } from "framer-motion";

export const MainImage: FC = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <div className="px-4 sm:px-6 md:px-20" ref={ref}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.6 }}
        whileHover={{ scale: 1.01 }}
      >
        <Image
          src="/logo1.png"
          alt="Build Market Main Image"
          width={1280}
          height={640}
          className="w-full h-auto rounded-lg"
          blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
          placeholder="blur"
          loading="lazy"
          quality={85}
        />
      </motion.div>
    </div>
  );
};
