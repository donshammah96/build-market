import { ROUTES } from '../lib/links';

export interface Review {
  quote: string;
  name: string;
  description: string;
  image: string;
  imageAlt: string;
  href: string;
}

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

export const reviews: Review[] = [
  { quote: '“Excellent service!”', name: 'Name', description: 'Description', image: '/customers/amy-burns.png', imageAlt: 'Amy Burns', href: ROUTES.speakWithAdvisor },
  { quote: '“Best experience ever!”', name: 'Name', description: 'Description', image: '/customers/balazs-orban.png', imageAlt: 'Balazs Orban', href: ROUTES.ideaBooks },
  { quote: '“Great products and service!”', name: 'Name', description: 'Description', image: '/customers/lee-robinson.png', imageAlt: 'Lee Robinson', href: ROUTES.findProfessional },
];

export const features: Feature[] = [
  { title: 'Idea Books', description: 'Browse idea books to find inspiration', image: '/design.png', imageAlt: 'Idea Books', href: ROUTES.ideaBooks },
  { title: 'Find a Professional', description: 'Find a professional for your specific needs.', image: '/professional.png', imageAlt: 'Find a Professional', href: ROUTES.findProfessional },
  { title: 'Speak with an Advisor', description: 'Contact a knowledgeable guide.', image: '/contact.png', imageAlt: 'Speak with an Advisor', href: ROUTES.speakWithAdvisor },
];

export const stores: Store[] = [
  { title: 'Hardware Shops', description: 'Find hardware shops near you.', image: '/hardware.png', imageAlt: 'Hardware Shops', href: ROUTES.hardwareShops },
  { title: 'Commercial Stores', description: 'Find specialty stores to suit your specific project needs.', image: '/kitchen-fixtures.png', imageAlt: 'Commercial Stores', href: ROUTES.commercialStores },
];

export const professionals: Professional[] = [
  { title: 'Engineers', description: 'Body text for whatever you’d like to expand on the main point.', image: '/engineers.png', imageAlt: 'Engineers', href: ROUTES.engineers },
  { title: 'Designers', description: 'Body text for whatever you’d like to say. Add main takeaway points, quotes, anecdotes.', image: '/design.png', imageAlt: 'Designers', href: ROUTES.designers },
  { title: 'Architects', description: 'Body text for whatever you’d like to add more to the main point. It provides details, explanations, and context.', image: '/architect.png', imageAlt: 'Architects', href: ROUTES.architects },
];