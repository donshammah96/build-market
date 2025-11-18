import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import ProfessionalCard from "./ProfessionalCard";
import { ProfessionalCardData } from "../../types/professional";
import Link from "next/link";
import { Button } from "../ui/button";

// Helper function to style last word(s) in emerald
const renderTitleWithEmerald = (title: string) => {
  const words = title.split(' ');
  const lastWord = words[words.length - 1];
  const restWords = words.slice(0, -1).join(' ');
  
  return (
    <>
      {restWords && `${restWords} `}
      <span className="text-emerald-600">{lastWord}</span>
    </>
  );
};

// Mock data - used as fallback if no professionals provided
const defaultProfessionals: ProfessionalCardData[] = [
  {
    id: "1",
    name: "Evans Ndegwa",
    companyName: "Evannas Structural Engineering",
    title: "Structural Engineer",
    bio: "I am a structural engineer with 10 years of experience in the industry. I have worked on a variety of projects, including residential, commercial, and industrial buildings.",
    servicesOffered: ["Structural Engineering", "Civil Engineering", "Building Design", "Structural Analysis", "Structural Design"],
    portfolioImage: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800",
    yearsExperience: 10,
    verified: true,
    rating: 4.8,
    reviewCount: 24,
    location: "Nairobi, Kenya"
  },
  {
    id: "2",
    name: "Don Shammah",
    companyName: "Shammah Architecture Inc.",
    title: "Architect",
    bio: "I am an architect with 10 years of experience in the industry. I have worked on a variety of projects, including residential, commercial, and industrial buildings.",
    servicesOffered: ["Architecture", "Building Design", "Architectural Design", "3D Modeling", "Urban Planning"],
    portfolioImage: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800",
    portfolioUrl: "https://linkedin.com",
    yearsExperience: 10,
    verified: true,
    rating: 4.9,
    reviewCount: 31,
    location: "Nairobi, Kenya"
  },
  {
    id: "3",
    name: "Ken Roy",
    companyName: "Roy Civil Engineering",
    title: "Civil Engineer",
    bio: "I am a civil engineer with 10 years of experience in the industry. I have worked on a variety of projects, including residential, commercial, and industrial buildings.",
    servicesOffered: ["Civil Engineering", "Building Design", "Site Planning", "Geotechnical Analysis", "Project Management"],
    portfolioImage: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800",
    yearsExperience: 10,
    verified: false,
    rating: 4.6,
    reviewCount: 18,
    location: "Embu, Kenya"
  },
  {
    id: "4",
    name: "Robinson Jiriswa",
    companyName: "Jiriswa Interior Design",
    title: "Interior Designer",
    bio: "I am an interior designer with 10 years of experience in the industry. I have worked on a variety of projects, including residential, commercial, and industrial buildings.",
    servicesOffered: ["Interior Design", "Space Planning", "Color Consultation", "Furniture Selection", "Renovation Design"],
    portfolioImage: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800",
    portfolioUrl: "https://linkedin.com",
    yearsExperience: 10,
    verified: true,
    rating: 5.0,
    reviewCount: 42,
    location: "Kisumu, Kenya"
  }
];

interface ProfessionalsProps {
  professionals?: ProfessionalCardData[];
  showViewAll?: boolean;
}

export function Professionals({ professionals = defaultProfessionals, showViewAll = true }: ProfessionalsProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="professionals" className="py-20 px-4 sm:px-6 md:px-20 bg-white" ref={ref}>
      <div className="max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, x: 50 }}
          animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
          transition={{ duration: 0.6 }}
          className="text-black text-4xl sm:text-5xl md:text-6xl font-semibold font-inter mb-6 sm:mb-10 text-left"
        >
          {renderTitleWithEmerald("Featured Professionals")}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-left text-slate-600 mb-12 text-lg sm:text-xl"
        >
          Showcasing professionals in the industry
        </motion.p>
        
        <div className="grid md:grid-cols-2 gap-6">
          {professionals.map((professional, index) => (
            <ProfessionalCard
              key={professional.id}
              professional={professional}
              index={index}
              isInView={isInView}
            />
          ))}
        </div>

        {showViewAll && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-center mt-12"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Button asChild size="lg">
                <Link href="/professionals">
                  View All Professionals
                </Link>
              </Button>
            </motion.div>
          </motion.div>
        )}
      </div>
    </section>
  );
}