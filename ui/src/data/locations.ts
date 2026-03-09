export const LOCATIONS: Record<string, string[]> = {
  Australia: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide'],
  Brazil: ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Curitiba', 'Belo Horizonte'],
  Canada: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa'],
  France: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice'],
  Germany: ['Berlin', 'Munich', 'Frankfurt', 'Hamburg', 'Cologne'],
  India: ['Mumbai', 'Bangalore', 'Delhi', 'Hyderabad', 'Chennai', 'Pune'],
  Italy: ['Milan', 'Rome', 'Turin', 'Florence', 'Naples', 'Bologna'],
  Japan: ['Tokyo', 'Osaka', 'Yokohama', 'Nagoya', 'Fukuoka'],
  Netherlands: ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven'],
  Singapore: ['Singapore'],
  'United Arab Emirates': ['Dubai', 'Abu Dhabi', 'Sharjah'],
  'United Kingdom': ['London', 'Manchester', 'Birmingham', 'Edinburgh', 'Bristol', 'Leeds'],
  'United States': ['New York', 'San Francisco', 'Los Angeles', 'Chicago', 'Austin', 'Seattle', 'Boston', 'Denver'],
  Remote: ['Remote'],
};

export const COUNTRIES = Object.keys(LOCATIONS).sort();

export function getCitiesForCountry(country: string): string[] {
  return LOCATIONS[country] || [];
}

export const CURRENCIES = [
  { value: 'USD', label: 'USD – US Dollar' },
  { value: 'EUR', label: 'EUR – Euro' },
  { value: 'GBP', label: 'GBP – British Pound' },
  { value: 'INR', label: 'INR – Indian Rupee' },
  { value: 'AED', label: 'AED – UAE Dirham' },
  { value: 'AUD', label: 'AUD – Australian Dollar' },
  { value: 'BRL', label: 'BRL – Brazilian Real' },
  { value: 'CAD', label: 'CAD – Canadian Dollar' },
  { value: 'CHF', label: 'CHF – Swiss Franc' },
  { value: 'JPY', label: 'JPY – Japanese Yen' },
  { value: 'SGD', label: 'SGD – Singapore Dollar' },
];

export const EXPERIENCE_RANGES = [
  '0-1 years',
  '1-3 years',
  '2-5 years',
  '3-5 years',
  '5-8 years',
  '5-10 years',
  '8-12 years',
  '10-15 years',
  '15+ years',
];
