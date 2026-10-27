// Edit this file only. Everything on the site reads from here.
window.DESI = {
  brand: "DesiSmash by Chef Hass",
  tagline: "Original & Spiced Smash Burgers",
  city: "Leicester",

  // Orders arrive here. Use your WhatsApp Business number, country code first, digits only.
  // Example: "447123456789". Leave empty until you have it: customers then get a copy-order button.
  whatsapp: "447786801291",
  phoneDisplay: "07786 801291",

  // Public links. Empty strings show "Coming soon".
  social: {
    instagram: "",   // e.g. "https://instagram.com/desismash.hass"
    tiktok: "",      // e.g. "https://tiktok.com/@desismash.hass"
    facebook: ""
  },
  apps: {
    uberEats: "",    // paste your store link once approved
    deliveroo: "",
    justEat: ""
  },

  // Trading hours, UK time. 0 = Sunday ... 6 = Saturday.
  hours: { 5: ["17:00", "22:30"], 6: ["17:00", "22:30"], 0: ["17:00", "22:30"] },
  lastOrderTime: "22:00",
  slotMinutes: 30,
  minLeadMinutes: 45,       // earliest slot today = now + this

  // Delivery is priced by distance from your kitchen. Collection is always free.
  // Put your exact kitchen postcode here (customers never see it). Until then the LE3 area centre is used.
  kitchenPostcode: "LE3 8RH",   // a nearby postcode, so your home address is not published
  kitchenOutcode: "LE3",
  // Distance is a straight line from your postcode to theirs, multiplied by roadFactor to approximate
  // the drive. Use 1.2 for typical Leicester streets, or 1 for pure straight-line miles.
  roadFactor: 1.2,
  deliveryBands: [
    { maxMiles: 1, fee: 0 },
    { maxMiles: 2, fee: 2.5 },
    { maxMiles: 3, fee: 5 }
  ],
  deliveryArea: "Delivery within 3 miles of our Leicester kitchen. Free under 1 mile, £2.50 from 1 to 2 miles, £5 from 2 to 3 miles. Collection is always free.",

  // Turn items off for the weekend: list menu ids or side ids, e.g. ["truffle", "paneer"].
  soldOut: [],

  // Closed weekend switch. Set on: true to stop orders and show the message everywhere. Change back to false to reopen.
  closed: { on: false, message: "We are closed this weekend. Back next Friday at 5 pm." },

  // Banner above the header. Empty string hides it.
  announcement: "Launch weekend: first 50 orders get a free dip pot",

  // This week's headline burger (menu id). Used on the home banner and the post kit.
  special: "tikka",

  // Round "story" shortcuts above the menu. Ids are burger ids, icon is one of: burger, flame, leaf, stack, onion.
  // Swap these for your real top sellers once you have a few weekends of orders.
  favourites: [
    { id: "og",       icon: "burger" },
    { id: "naga",     icon: "flame" },
    { id: "tikka",    icon: "burger" },
    { id: "triple",   icon: "stack" },
    { id: "paneer",   icon: "leaf" },
    { id: "oklahoma", icon: "onion" },
    { id: "bbq",      icon: "burger" }
  ],

  // Prices in pounds, from the blueprint.
  tiers: {
    1: { name: "Classics",     burger: 4.99, meal: 6.99 },
    2: { name: "Gourmet",      burger: 5.99, meal: 7.99 },
    3: { name: "Heavyweight",  burger: 6.99, meal: 8.99 }
  },

  patties: [
    { id: "beef-original",    label: "Beef Original",    note: "2 x 2 oz, salt and pepper" },
    { id: "beef-desi",        label: "Beef Desi",        note: "2 x 2.5 oz, chilli, coriander, garam masala" },
    { id: "chicken-original", label: "Chicken Original", note: "2 x 2 oz thigh" },
    { id: "chicken-desi",     label: "Chicken Desi",     note: "2 x 2.5 oz, mint, chaat, cumin" }
  ],

  burgers: [
    { id: "og",       tier: 1, name: "The OG Smash",            heat: 0, sauces: ["OG house sauce"], remove: ["American cheese", "Pickles", "Diced white onion"], desc: "American cheese, OG house sauce, pickles, diced white onion." },
    { id: "oklahoma", tier: 1, name: "The Oklahoma Onion",      heat: 0, sauces: ["Mustard mayo"], remove: ["Smashed onions", "Extra cheese slice"], desc: "Onions smashed into the patty, double American cheese, mustard mayo." },
    { id: "naga",     tier: 1, name: "The Naga Firecracker",    heat: 3, sauces: ["Naga chilli mayo"], remove: ["Pepper jack", "Pickled jalapeños", "Crispy shallots"], desc: "Pepper jack, naga chilli mayo, pickled jalapeños, crispy shallots." },
    { id: "garlic",   tier: 1, name: "The Garlic Chilli Crisp", heat: 2, sauces: ["Roasted garlic aioli", "Chilli crisp oil"], remove: ["Chilli-jack cheese", "Iceberg lettuce"], desc: "Chilli-jack, roasted garlic aioli, chilli crisp oil, iceberg." },
    { id: "bbq",      tier: 1, name: "Smoked BBQ Pitmaster",    heat: 0, sauces: ["Smoky BBQ glaze"], remove: ["Aged cheddar", "Pickles", "Onion ring"], desc: "Aged cheddar, smoky BBQ glaze, pickles, crispy onion ring." },
    { id: "tikka",    tier: 2, name: "The Tikka Butter Melt",   heat: 1, sauces: ["Mint-coriander chutney mayo", "Makhani butter glaze"], remove: ["Spiced cheese", "Red onion"], desc: "Spiced cheese, makhani butter glaze, mint-coriander chutney mayo, red onion." },
    { id: "stampede", tier: 2, name: "Caramelized Stampede",    heat: 0, sauces: ["Smoky BBQ mayo"], remove: ["Smoked cheddar", "Caramelised onions", "Turkey bacon"], desc: "Smoked cheddar, slow-cooked caramelised onions, BBQ mayo, turkey bacon." },
    { id: "bombay",   tier: 2, name: "Tamarind & Bombay Street",heat: 1, sauces: ["Coriander lime sauce", "Tamarind chutney"], remove: ["Aged cheddar", "Papri crisp"], desc: "Aged cheddar, tamarind chutney, coriander lime sauce, crushed papri crisp." },
    { id: "truffle",  tier: 2, name: "Truffle & Wild Mushroom", heat: 0, sauces: ["Truffle mayo"], remove: ["Swiss cheese", "Garlic and thyme mushrooms", "Spinach"], desc: "Swiss cheese, garlic and thyme mushrooms, truffle mayo, spinach." },
    { id: "paneer",   tier: 2, name: "Paneer Tikka Melt",       heat: 1, veg: true, sauces: ["Mint chutney mayo", "Tamarind glaze"], remove: ["Pepper jack", "Pickled red onion"], desc: "Tawa-seared paneer in tikka marinade, pepper jack, mint chutney mayo, pickled red onion." },
    { id: "triple",   tier: 3, name: "The Triple Threat",       heat: 0, sauces: ["OG house sauce"], remove: ["American cheese", "Pickles", "Diced white onion"], desc: "Three 2.5 oz smashed patties, three cheese slices, double pickles, extra OG sauce." }
  ],

  // Free changes a customer can ask for. Each burger lists its "sauces" and its other "remove" items (toppings, cheese).
  customise: { noteMax: 80 },

  fries: ["Masala dust", "Peri-peri", "Sea salt"],
  sauces: ["OG House", "Fiery Naga Mayo", "Mint-Coriander Chutney", "Roasted Garlic Aioli", "Smoky BBQ Glaze"],
  cans: ["Coke", "Diet Coke", "Fanta", "Rubicon Mango", "Water"],

  sides: [
    { id: "fries",   name: "Seasoned skin-on fries",  price: 2.50, desc: "200g, your choice of seasoning.", choose: "fries" },
    { id: "naga-f",  name: "Naga Cheese Fries",       price: 3.99, desc: "Warm cheese sauce, naga mayo, jalapeños, crispy onions." },
    { id: "loaded",  name: "Desi Loaded Smash Fries", price: 4.99, desc: "Chopped Desi smash patty, cheese sauce, mint chutney mayo, red onion." },
    { id: "dip",     name: "Dip pot (2 oz)",          price: 0.80, desc: "Pick any of the five house sauces.", choose: "sauces" },
    { id: "can",     name: "Can (330ml)",             price: 1.50, desc: "Cold from the fridge.", choose: "cans" }
  ],

  // Private order database (Supabase). The key is a public "publishable" key: it can only place orders.
  orders: {
    url: "https://agtkkcyaudirqvodxqjd.supabase.co",
    key: "sb_publishable_GQDorFgoz6UzOBPsd7UQUw_9eZusbCo"
  },

  // Order-received email. Paste the Cloudflare Worker URL (see worker/README.md). Empty means no email is sent.
  emailEndpoint: "",

  // Email capture. Paste a form endpoint (Formspree, Web3Forms, or a Google Apps Script URL) so sign-ups reach you.
  // See README, "Collecting emails". Leave empty and the recipe still downloads, but no emails are saved.
  leads: {
    endpoint: "",
    extra: {},                       // e.g. { access_key: "..." } for Web3Forms
    freePdf: "downloads/Desi-Smash-Starter-Recipe.pdf",
    privacyUrl: "privacy.html",
    contactEmail: ""                 // shown on the privacy page
  },

  // Things people can buy for home. Prices here are placeholders: set your own.
  shop: [
    { id: "spice", name: "Chef Hass Desi Smash Spice Blend", size: "100g jar", price: 6.99, type: "order",
      desc: "The blend behind the Desi patties. Add a jar to your weekend order and collect or have it delivered with your burgers." },
    { id: "book", name: "Desi Smash At Home Recipe Book", size: "PDF, 7 pages", price: 4.99, type: "link", url: "",
      desc: "All 10 burgers, 5 sauces, fries and a cook-along plan, scaled for four at home. Paste your Payhip, Gumroad or Stripe link in url to start selling." }
  ],

  allergenNote: "All burgers contain gluten, milk and egg. Sesame and mustard are in buns and sauces. Naga mayo, aioli and chutney mayo contain egg. Paneer burger contains milk. Cooked on shared equipment, so we cannot guarantee any item is free from an allergen. Tell us about any allergy when you order and ask for the full allergen matrix."
};
