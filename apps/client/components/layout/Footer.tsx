import Link from 'next/link';
import { ROUTES } from '../../app/lib/links';
import { FC } from "react";

interface FooterColumnProps {
  title: string;
  items: string[];
}

const FooterColumn: FC<FooterColumnProps> = ({ title, items }) => {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 items-end">
      <h4 className="text-black  text-base font-medium font-inter leading-6">{title}</h4>
      {items.map((item) => (
        <p key={item} className="text-zinc-700  text-base font-medium font-inter leading-6">
          {item}
        </p>
      ))}
    </div>
  );
};
export const Footer: React.FC = () => (
    <footer className="w-full h-64 overflow-hidden relative flex justify-center bg-white">
    <div className="w-full max-w-[1280px] px-4 sm:px-6 md:px-20 py-8 sm:py-12 flex flex-col md:flex-row justify-between gap-6 sm:gap-8">
      <div className="flex flex-col gap-4 sm:gap-6">
        <h3 className="text-black  text-xl sm:text-2xl font-normal font-inter leading-7 sm:leading-9">Build Market</h3>
        <div className="flex gap-2">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="w-8 sm:w-10 h-8 sm:h-10 rounded-sm bg-gray-200 flex justify-center items-center" />
          ))}
        </div>
      </div>
      <div className="hidden md:flex space-x-8 sm:space-x-12">
        <FooterColumn
          title="COMPANY"
          items={["About Build Market", "Terms & Privacy", "Copyright & Trademark"]}
        />
        <FooterColumn
          title="BUSINESS SERVICES"
          items={["For Brand", "For Professionals", "Buttons and Badges"]}
        />
        <FooterColumn
          title="GET HELP"
          items={["Review Professionals", "Build Market Support", "Contact"]}
        />
      </div>
    </div>
    <div className="absolute bottom-0 w-full border-t border-neutral-200" />
  </footer>
);