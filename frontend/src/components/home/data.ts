import { Search, Truck, CreditCard, Phone, Mail, MessageCircle } from "lucide-react";

export const vehicleFields = [
  { label: "Make", placeholder: "Select make", options: ["Toyota", "Honda", "BMW", "Audi"] },
  { label: "Model", placeholder: "Select model", options: ["Civic", "Corolla", "A4", "X5"] },
  { label: "Year", placeholder: "Select year", options: ["2025", "2024", "2023", "2022"] },
  { label: "Variant", placeholder: "Select variant", options: ["Base", "Sport", "Premium"] },
];

export const tyreFields = [
  { label: "Width", placeholder: "e.g. 225", options: ["205", "215", "225", "235"] },
  { label: "Profile", placeholder: "e.g. 45", options: ["35", "40", "45", "50"] },
  { label: "Rim Size", placeholder: 'e.g. 18"', options: ["16", "17", "18", "19"] },
];


export const tyres = [
  { id: 1, brand: "MICHELIN", name: "Pilot Sport 4", size: "225/45R17", price: "$189", oldPrice: "$236", rating: "4.8", reviews: "(412)", discount: "-20%", image: "/singleTyre.svg" },
  { id: 2, brand: "BRIDGESTONE", name: "Potenza Sport", size: "245/40R18", price: "$215", oldPrice: "$268", rating: "4.7", reviews: "(389)", discount: "-19%", image: "/singleTyre.svg" },
  { id: 3, brand: "GOODYEAR", name: "Eagle F1 Asymm", size: "235/45R18", price: "$174", oldPrice: "$220", rating: "4.6", reviews: "(531)", discount: "-21%", image: "/singleTyre.svg" },
  { id: 4, brand: "PIRELLI", name: "P Zero", size: "255/40R19", price: "$248", oldPrice: "$310", rating: "4.9", reviews: "(278)", discount: "-20%", image: "/singleTyre.svg" },
  { id: 5, brand: "CONTINENTAL", name: "SportContact 7", size: "225/45R17", price: "$196", oldPrice: "$245", rating: "4.7", reviews: "(342)", discount: "-20%", image: "/singleTyre.svg" },
  { id: 6, brand: "DUNLOP", name: "Sport Maxx RT2", size: "235/35R19", price: "$165", oldPrice: "$206", rating: "4.5", reviews: "(614)", discount: "-20%", image: "/singleTyre.svg" },
  { id: 7, brand: "MICHELIN", name: "CrossClimate 2", size: "205/55R16", price: "$142", oldPrice: "$178", rating: "4.8", reviews: "(820)", discount: "-20%", image: "/singleTyre.svg" },
  { id: 8, brand: "BRIDGESTONE", name: "Turanza T005", size: "215/60R16", price: "$129", oldPrice: "$161", rating: "4.6", reviews: "(455)", discount: "-20%", image: "/singleTyre.svg" },
  { id: 9, brand: "GOODYEAR", name: "EfficientGrip", size: "195/65R15", price: "$108", oldPrice: "$135", rating: "4.5", reviews: "(702)", discount: "-20%", image: "/singleTyre.svg" },
  { id: 10, brand: "PIRELLI", name: "Cinturato P7", size: "225/50R17", price: "$155", oldPrice: "$194", rating: "4.7", reviews: "(381)", discount: "-20%", image: "/singleTyre.svg" },
  { id: 11, brand: "CONTINENTAL", name: "EcoContact 6", size: "205/55R16", price: "$118", oldPrice: "$148", rating: "4.6", reviews: "(593)", discount: "-20%", image: "/singleTyre.svg" },
  { id: 12, brand: "DUNLOP", name: "BluResponse", size: "195/60R15", price: "$99", oldPrice: "$124", rating: "4.4", reviews: "(477)", discount: "-20%", image: "/singleTyre.svg" },
  { id: 13, brand: "MICHELIN", name: "Primacy 4+", size: "215/55R17", price: "$163", oldPrice: "$204", rating: "4.8", reviews: "(348)", discount: "-20%", image: "/singleTyre.svg" },
  { id: 14, brand: "BRIDGESTONE", name: "Alenza 001", size: "235/55R19", price: "$198", oldPrice: "$248", rating: "4.7", reviews: "(267)", discount: "-20%", image: "/singleTyre.svg" },
  { id: 15, brand: "GOODYEAR", name: "UltraGrip 9+", size: "205/60R16", price: "$121", oldPrice: "$151", rating: "4.6", reviews: "(539)", discount: "-20%", image: "/singleTyre.svg" },
  { id: 16, brand: "PIRELLI", name: "Scorpion Verde", size: "255/50R19", price: "$212", oldPrice: "$265", rating: "4.7", reviews: "(319)", discount: "-20%", image: "/singleTyre.svg" },
  { id: 17, brand: "CONTINENTAL", name: "CrossContact RX", size: "235/65R17", price: "$178", oldPrice: "$222", rating: "4.6", reviews: "(421)", discount: "-20%", image: "/singleTyre.svg" },
  { id: 18, brand: "DUNLOP", name: "Grandtrek AT5", size: "265/65R17", price: "$195", oldPrice: "$244", rating: "4.5", reviews: "(287)", discount: "-20%", image: "/singleTyre.svg" },
  { id: 19, brand: "MICHELIN", name: "Latitude Sport 3", size: "275/45R21", price: "$289", oldPrice: "$362", rating: "4.9", reviews: "(198)", discount: "-20%", image: "/singleTyre.svg" },
  { id: 20, brand: "BRIDGESTONE", name: "Dueler HP Sport", size: "255/55R18", price: "$224", oldPrice: "$280", rating: "4.7", reviews: "(305)", discount: "-20%", image: "/singleTyre.svg" },
  { id: 21, brand: "GOODYEAR", name: "Wrangler HP All", size: "235/70R16", price: "$146", oldPrice: "$182", rating: "4.5", reviews: "(443)", discount: "-20%", image: "/singleTyre.svg" },
  { id: 22, brand: "PIRELLI", name: "Scorpion ATR", size: "265/70R16", price: "$168", oldPrice: "$210", rating: "4.6", reviews: "(376)", discount: "-20%", image: "/singleTyre.svg" },
  { id: 23, brand: "CONTINENTAL", name: "VanContact 200", size: "215/65R16", price: "$134", oldPrice: "$168", rating: "4.5", reviews: "(512)", discount: "-20%", image: "/singleTyre.svg" },
  { id: 24, brand: "DUNLOP", name: "Econodrive", size: "195/70R15", price: "$95", oldPrice: "$119", rating: "4.4", reviews: "(628)", discount: "-20%", image: "/singleTyre.svg" },
];

export const steps = [
  { id: "01", title: "Find the right tire for you", short: "FIND TIRES", desc: "Enter your vehicle year, make, and model or search by tire size to see our top recommendations.", image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1600&auto=format&fit=crop", icon: Search },
  { id: "02", title: "Delivery Method", short: "DELIVERY METHOD", desc: "Choose delivery or pickup that works best for your schedule and location.", image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1200&auto=format&fit=crop", icon: Truck },
  { id: "03", title: "Choose Payment", short: "CHOOSE PAYMENT", desc: "Secure checkout with multiple payment methods for a smooth experience.", image: "https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=1200&auto=format&fit=crop", icon: CreditCard },
];

export const contactItems = [
  { icon: Phone, title: "Call", value: "886-540-0167" },
  { icon: MessageCircle, title: "Chat", value: "Here & Now" },
  { icon: Mail, title: "Email", value: "info@tyrevault.com.au" },
];

export const faqs = [
  { question: "Are the tires for sale new or used?", answer: "Our selection is composed of new tires mostly, however, retreaded and take-off tires can also be found on our website. Retreaded and Take-off tires are advertised as such, so there can be no confusion during shopping." },
  { question: "Can Gift Cards be combined with available Coupon Codes?", answer: "Yes, gift cards can be combined with active coupon codes unless otherwise stated." },
  { question: "Does the Tyres & Car Valeting Gift Card have an expiration date?", answer: "No, our gift cards do not expire and can be used anytime." },
  { question: "Do you provide a warranty on your tires?", answer: "Yes, manufacturer warranty is available on eligible tire purchases." },
  { question: "Do I need to register my tires?", answer: "We recommend registering your tires for safety recalls and warranty coverage." },
];

export const reviews = [
  { name: "Nevin H.", initial: "N", review: "Easy to look up and pay! Very user friendly!" },
  { name: "Ryan F.", initial: "R", review: "very easy, like the recommended feature" },
  { name: "Mathew M.", initial: "M", review: "Great website. And a great selection of tires. Best prices around." },
  { name: "Phillip T.", initial: "P", review: "Great platform and smooth checkout process." },
];

// Static fallback for pages that cannot use the async FooterWrapper (e.g. client-only pages)
export const staticFooterSections = [
  {
    title: 'Top Tyre Brands',
    moreLabel: '...more tyre brands', moreHref: '/tyres',
    items: ['Winrun','Pirelli','Kumho','Bridgestone','Michelin','Hankook','BF Goodrich','Continental','Dunlop','Goodyear']
      .map(b => ({ label: b, href: `/tyres?brand=${encodeURIComponent(b.toLowerCase())}` })),
  },
  {
    title: 'Top Tyre Models',
    moreLabel: '...more tyre models', moreHref: '/tyres',
    items: ['Winrun R330','Kinforest KF 550','Pirelli Scorpion Verde AS','Bridgestone Potenza RE003','Michelin Pilot Sport 5','BFGoodrich All Terrain KO2','Hankook Ventus S1 EVO3','Continental Contimaxcontact MC6','Goodyear Assurance TripleMax 2','Dunlop SP Sport FM800']
      .map(m => ({ label: m, href: '/tyres' })),
  },
  {
    title: 'Top Tyre Sizes',
    moreLabel: '...more tyre sizes', moreHref: '/tyres',
    items: [
      { w: 205, p: 55, r: 16 }, { w: 215, p: 60, r: 16 }, { w: 235, p: 45, r: 17 },
      { w: 245, p: 70, r: 16 }, { w: 265, p: 65, r: 17 }, { w: 265, p: 70, r: 16 },
      { w: 265, p: 70, r: 17 }, { w: 265, p: 75, r: 16 }, { w: 285, p: 70, r: 17 },
      { w: 285, p: 75, r: 16 },
    ].map(s => ({ label: `${s.w}/${s.p}R${s.r}`, href: `/tyres?width=${s.w}&profile=${s.p}&rim_size=${s.r}` })),
  },
  {
    title: 'Top Vehicle Makers',
    moreLabel: '...more vehicle makes', moreHref: '/tyres',
    items: ['BMW','Ford','Toyota','Mercedes-Benz','Mitsubishi','Hyundai','Subaru','Audi','Holden','Kia']
      .map(m => ({ label: m, href: `/tyres?make=${encodeURIComponent(m)}` })),
  },
  {
    title: 'Top Vehicle Models',
    moreLabel: '...more vehicle models', moreHref: '/tyres',
    items: [['Ford','Falcon'],['Honda','Civic'],['Holden','Commodore'],['Hyundai','i30'],['Audi','A6'],['Mercedes-Benz','C200'],['BMW','318i'],['Volkswagen','Golf'],['Mitsubishi','Lancer'],['Subaru','Forester']]
      .map(([make, model]) => ({ label: `${make} ${model}`, href: `/tyres?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}` })),
  },
];

export const footerLinks = [
  {
    title: "Company", links: [
      { label: "About Us", href: "/about" },
      { label: "Services", href: "/services" },
      { label: "Blog", href: "#" },
      { label: "Warehouse Locations", href: "#" },
    ],
  },
  {
    title: "Customer Support", links: [
      { label: "Contact Us", href: "/contact" },
      { label: "Help Center", href: "#" },
      { label: "Track My Order", href: "/track-order" },
      { label: "Return Policy", href: "#" },
      { label: "Privacy Policy", href: "#" },
    ],
  },
  {
    title: "Programs", links: [
      { label: "Membership Benefits", href: "#" },
      { label: "Become a Dealer", href: "#" },
      { label: "Affiliate Program", href: "#" },
      { label: "Installer Program", href: "#" },
    ],
  },
];

export const TYRES_PER_PAGE = 8;

export function chunkTyres(arr: typeof tyres, size: number) {
  const chunks: (typeof tyres)[] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

export const tyrePages = chunkTyres(tyres, TYRES_PER_PAGE);
export type Tyre = (typeof tyres)[0];
