export function formatCityLabel(city) {
    if (city.region && city.region !== city.name) {
        return `${city.name}, ${city.region}`;
    }
    if (city.countryCode === 'BY') {
        return `${city.name}, Беларусь`;
    }
    return city.name;
}
