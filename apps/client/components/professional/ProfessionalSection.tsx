import { professionals as allProfessionals } from '../../app/data/homeData';
import ProfessionalCard from './ProfessionalCard';
import Link from 'next/link';
import { ROUTES } from '../../app/lib/links';
import Image from 'next/image';
import { FC } from "react";
import { ProfessionalCardData } from '../../types/professional';

interface ProfessionalItemProps {
  title: string;
  description: string;
}

const ProfessionalItem: FC<ProfessionalItemProps> = ({ title, description }) => {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-black text-xl sm:text-2xl font-medium font-inter leading-7 sm:leading-9">{title}</h3>
      <p className="text-zinc-500  text-xl sm:text-2xl font-normal font-inter leading-7 sm:leading-9">{description}</p>
    </div>
  );
};

export const ProfessionalsSection: React.FC<{ searchTerm: string }> = ({ searchTerm }) => {
    const filteredProfessionals = allProfessionals.filter(professional =>
      professional.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      professional.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  
    return (
      <section className="flex flex-col w-[516px] items-end gap-12 relative">
        <h2 className="text-black  text-3xl sm:text-4xl font-semibold font-inter">Browse Professionals Near You</h2>
        <div className="flex flex-col gap-8 sm:gap-12 max-w-[516px]">
          <div className="align-self-stretch flex-direction-column justify-content-center flex-start display-flex relative w-full grid grid-cols-1 gap-6">
            {filteredProfessionals.map((professional, index) => (
            <ProfessionalItem key={index} title={professional.title} description={professional.description} />
          ))}
        </div>
          <div className="relative w-full h-full md:h-[704px] rounded-tl-lg rounded-bl-lg overflow-hidden">
            <Image
              src="/architect.png"
              alt="Professionals Image"
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="w-full md:w-[704px] h-auto rounded-tl-lg rounded-bl-lg"
              blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
              placeholder="blur"
              loading="lazy"
              quality={85}
            />
          </div>
        </div>
        <div className="mt-6 text-center">
          <button className="px-4 sm:px-6 py-2 sm:py-3 bg-neutral-200  rounded-lg shadow text-black  text-xl sm:text-2xl font-medium font-inter leading-7 sm:leading-9">
             <Link href={ROUTES.findProfessional} className="text-black  hover:underline text-xl font-medium inline-flex items-center gap-1">Explore more!</Link>
          </button>
        </div>
      </section>
    );
  };