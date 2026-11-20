import type { Extraction } from "../src/schemas/extraction.js";

export const recordedResults: Readonly<Record<string, Extraction>> = {
  "people-date-location-uk": {
    names: ["Олена Коваль"],
    dates: ["14 липня"],
    locations: ["Львова"],
    summary: "Олена Коваль 14 липня приїхала до Львова на конференцію з веброзробки.",
  },
  "no-dates": {
    names: ["Андрій Мельник"],
    dates: [],
    locations: ["Києві"],
    summary: "Андрій Мельник проводить у Києві воркшоп.",
  },
  "no-names": {
    names: [],
    dates: ["3 вересня"],
    locations: ["Одесі"],
    summary: "Зустріч в Одесі відбудеться 3 вересня.",
  },
  "no-structured-entities": {
    names: [],
    dates: [],
    locations: [],
    summary: "Документ пояснює загальні правила командної роботи.",
  },
  multilingual: {
    names: ["Марія Савчук"],
    dates: ["5 May"],
    locations: ["Berlin"],
    summary: "Марія Савчук presented the demo in Berlin on 5 May.",
  },
};
