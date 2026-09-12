export type ProfileCity = {
  id: string;
  name: string;
  region: string | null;
  countryCode: string;
  countryName: string;
};

export type CityReferenceItem = {
  id: string;
  name: string;
  region: string | null;
  countryCode: string;
  countryName: string;
  label: string;
};

export function formatCityLabel(city: Pick<ProfileCity, 'name' | 'region' | 'countryCode'>): string {
  if (city.region && city.region !== city.name) {
    return `${city.name}, ${city.region}`;
  }

  if (city.countryCode === 'BY') {
    return `${city.name}, Беларусь`;
  }

  return city.name;
}
