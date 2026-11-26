import type { Extraction } from "../src/schemas/extraction.js";

export interface EvalCase<TExpected = unknown> {
  id: string;
  input: string;
  expected?: TExpected;
  expectedTool?: string;
  shouldRefuse?: boolean;
  tags?: string[];
}

export interface ExtractionEvalExpected {
  extraction: Extraction;
  summaryMustInclude: string[];
  summaryMaxCharacters: number;
}

export const extractionEvalCases: ReadonlyArray<EvalCase<ExtractionEvalExpected>> = [
  {
    id: "people-date-location-uk",
    input: "14 липня Олена Коваль приїхала до Львова на конференцію з веброзробки.",
    expected: {
      extraction: {
        names: ["Олена Коваль"],
        dates: ["14 липня"],
        locations: ["Львова"],
        summary: "14 липня Олена Коваль приїхала до Львова на конференцію з веброзробки.",
      },
      summaryMustInclude: ["Олена Коваль", "Львова", "конференцію"],
      summaryMaxCharacters: 220,
    },
    tags: ["uk", "all-entities"],
  },
  {
    id: "no-dates",
    input: "Андрій Мельник проводить воркшоп у Києві.",
    expected: {
      extraction: {
        names: ["Андрій Мельник"],
        dates: [],
        locations: ["Києві"],
        summary: "Андрій Мельник проводить воркшоп у Києві.",
      },
      summaryMustInclude: ["Андрій Мельник", "Києві", "воркшоп"],
      summaryMaxCharacters: 180,
    },
    tags: ["uk", "missing-date"],
  },
  {
    id: "no-names",
    input: "Зустріч відбудеться 3 вересня в Одесі.",
    expected: {
      extraction: {
        names: [],
        dates: ["3 вересня"],
        locations: ["Одесі"],
        summary: "Зустріч відбудеться 3 вересня в Одесі.",
      },
      summaryMustInclude: ["3 вересня", "Одесі", "зустріч"],
      summaryMaxCharacters: 180,
    },
    tags: ["uk", "missing-name"],
  },
  {
    id: "no-structured-entities",
    input: "Документ пояснює загальні правила командної роботи.",
    expected: {
      extraction: {
        names: [],
        dates: [],
        locations: [],
        summary: "Документ пояснює загальні правила командної роботи.",
      },
      summaryMustInclude: ["правила", "командної роботи"],
      summaryMaxCharacters: 180,
    },
    tags: ["uk", "no-entities"],
  },
  {
    id: "multilingual",
    input: "On 5 May Марія Савчук presented the demo in Berlin.",
    expected: {
      extraction: {
        names: ["Марія Савчук"],
        dates: ["5 May"],
        locations: ["Berlin"],
        summary: "5 May Марія Савчук presented the demo in Berlin.",
      },
      summaryMustInclude: ["Марія Савчук", "5 May", "Berlin", "demo"],
      summaryMaxCharacters: 200,
    },
    tags: ["multilingual", "all-entities"],
  },
];
