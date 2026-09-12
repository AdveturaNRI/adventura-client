import { normalizeGameSystemName } from '@/utils/game-system-name';
import { fetchGameSystems } from '@/services/reference/referenceApi';

let cachedOfficialNames: Set<string> | null = null;
let inflightRequest: Promise<Set<string>> | null = null;

export function getOfficialGameSystemNames(): Promise<Set<string>> {
  if (cachedOfficialNames) {
    return Promise.resolve(cachedOfficialNames);
  }

  if (!inflightRequest) {
    inflightRequest = fetchGameSystems()
      .then((items) => {
        cachedOfficialNames = new Set(
          items.filter((item) => item.isOfficial).map((item) => normalizeGameSystemName(item.name)),
        );

        return cachedOfficialNames;
      })
      .finally(() => {
        inflightRequest = null;
      });
  }

  return inflightRequest;
}

export function isOfficialGameSystemName(name: string, officialNames: Set<string>): boolean {
  return officialNames.has(normalizeGameSystemName(name));
}
