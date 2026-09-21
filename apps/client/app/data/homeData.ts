import { ROUTES } from "@/lib/routes";

export interface Review {
  id: string;
  quote: string;
  name: string;
  location: string; // Added location for local context
  role: string; // e.g., Homeowner, Developer
  image: string;
  rating: number; // Added rating for trust
  href: string;
}

// ... keep other interfaces (Feature, Store, Professional) as they were ...

export const reviews: Review[] = [
  {
    id: "1",
    quote:
      "Finding a reliable contractor in Nairobi used to be a nightmare. Build Market connected me with a vetted team that finished my Kileleshwa apartment renovation two weeks early.",
    name: "Pamela Njeru",
    location: "Kileleshwa, Nairobi",
    role: "Homeowner",
    image: "/customers/amy-burns.png", // Ensure you have a placeholder
    rating: 5,
    href: ROUTES.reviews,
  },
  {
    id: "2",
    quote:
      "As a diaspora investor, I needed someone I could trust to manage my build in Nakuru while I was in the UK. The transparency this platform offers is unmatched.",
    name: "Catherine Mwende",
    location: "Nakuru (Diaspora Client)",
    role: "Property Investor",
    image: "/customers/delba-de-oliveira.png",
    rating: 5,
    href: ROUTES.reviews,
  },
  {
    id: "3",
    quote:
      "The quality of architects on this platform is top-tier. I found a landscape designer who completely transformed our Karen garden using native plants.",
    name: "Khalid Galileo",
    location: "Karen, Nairobi",
    role: "Homeowner",
    image: "/customers/michael-novotny.png",
    rating: 4,
    href: ROUTES.reviews,
  },
];

export interface Feature {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  href: string;
}

export interface Store {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  href: string;
}

export interface Professional {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  href: string;
}

export const features: Feature[] = [
  {
    title: "Idea Books",
    description: "Browse idea books to find inspiration",
    image: "/design.png",
    imageAlt: "Idea Books",
    href: ROUTES.ideaBooks,
  },
  {
    title: "Find a Professional",
    description: "Find a professional for your specific needs.",
    image: "/professional.png",
    imageAlt: "Find a Professional",
    href: ROUTES.findProfessional,
  },
  {
    title: "Find Properties",
    description: "Find properties for sale or rent.",
    image: "/hero-realestate.jpg",
    imageAlt: "Find Properties",
    href: ROUTES.properties,
  },
];

export const stores: Store[] = [
  {
    title: "Hardware Shops",
    description: "Find hardware shops near you.",
    image: "/hardware.png",
    imageAlt: "Hardware Shops",
    href: ROUTES.storeHardware,
  },
  {
    title: "Commercial Stores",
    description: "Find specialty stores to suit your specific project needs.",
    image: "/kitchen-fixtures.png",
    imageAlt: "Commercial Stores",
    href: ROUTES.stores,
  },
];

// Previously shipped with Figma/Lorem-ipsum placeholder copy ("Body text for
// whatever you'd like to expand on the main point.") that never got replaced
// with real content — a launch blocker if it ever reached this array's
// consumer (components/professional/ProfessionalSection.tsx). Replaced with
// real, specific descriptions of what each profession actually does on the
// platform.
export const professionals: Professional[] = [
  {
    title: "Engineers",
    description:
      "Structural, civil, and electrical engineers who sign off on Kenyan building-code compliance — from foundation design through final inspection.",
    image: "/engineers.png",
    imageAlt: "Engineers",
    href: ROUTES.engineers,
  },
  {
    title: "Designers",
    description:
      "Interior and landscape designers who turn a finished shell into a livable space — space planning, sourcing, and styling included.",
    image: "/design.png",
    imageAlt: "Designers",
    href: ROUTES.designers,
  },
  {
    title: "Architects",
    description:
      "Licensed architects for concept design, planning approvals, and construction drawings, vetted against county-level building regulations.",
    image: "/architect.png",
    imageAlt: "Architects",
    href: ROUTES.architects,
  },
];
