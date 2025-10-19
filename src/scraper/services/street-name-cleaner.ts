// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class StreetNameCleaner {
  private static readonly PROMOTIONAL_SUFFIXES = [
    "oś. Energetyki. Wynajmę mieszkanie",
    "oś. Energetyki. Wynajmę",
    "Wynajmę mieszkanie",
    "Wynajmę",
    "Do wynajęcia",
    "Na wynajem",
    "MIESZKANIE DO NAJMU",
    "MIESZKANIE",
    "Mieszkanie składa się z",
    "Mieszkanie",
    "Do najmu",
    "Najem",

    "dostępne od",
    "od zaraz",
    "wolne od",
    "lokalizacja",
    "centrum",
    "blisko",
    "przy",
    "obok",
    "w pobliżu",
    "niedaleko",
    "tuż przy",
    "vis-à-vis",

    "nieruchomość",
    "oferta",
    "ogłoszenie",
    "sprzedam",
    "kupię",
    "szukam",
    "poszukuję",
    "pilnie",
    "zapraszam",
    "serdecznie zapraszam",
    "kontakt",
    "tel",
    "telefon",
    "dzwoń",

    "umeblowane",
    "nieumeblowane",
    "z balkonem",
    "z garażem",
    "z piwnicą",
    "z ogródkiem",
    "taras",
    "loggia",
    "antresola",
    "klimatyzacja",
    "ogrzewanie",
    "winda",
    "bez windy",
    "parking",
    "garaż",
    "piwnica",

    "od grudnia",
    "od stycznia",
    "od lutego",
    "od marca",
    "od kwietnia",
    "od maja",
    "od czerwca",
    "od lipca",
    "od sierpnia",
    "od września",
    "od października",
    "od listopada",
    "styczeń",
    "luty",
    "marzec",
    "kwiecień",
    "maj",
    "czerwiec",
    "lipiec",
    "sierpień",
    "wrzesień",
    "październik",
    "listopad",
    "grudzień",

    ". ",
    ", ",
    " - ",
    " – ",
    " | ",
    " / ",
  ];

  private static readonly STREET_PREFIXES = [
    "ul.",
    "ulica",
    "al.",
    "aleja",
    "os.",
    "osiedle",
    "pl.",
    "plac",
    "św.",
    "świętego",
    "świętej",
    "im.",
    "imienia",
  ];

  private static readonly POLISH_STREET_PATTERNS = [
    /[a-ząćęłńóśźż]+(owa|owej|ego|ej|y|i|a|e)$/i,

    /św\.\s*[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+/i,

    /[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]{2,}/,

    /[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+-[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+/,
  ];

  public static cleanStreetName(streetName: string): string {
    if (!streetName || typeof streetName !== "string") {
      return "";
    }

    let cleaned = streetName.trim();

    const extracted = this.extractCoreStreetName(cleaned);
    if (extracted !== null && extracted !== "") {
      cleaned = extracted;
    } else {
      const punctuationSplits = [". ", ", ", " - ", " – ", " | ", " / ", ": "];

      for (const punct of punctuationSplits) {
        const index = cleaned.indexOf(punct);
        if (index > 0) {
          const beforePunct = cleaned.slice(0, Math.max(0, index)).trim();

          if (this.looksLikeValidStreetName(beforePunct)) {
            cleaned = beforePunct;
            break;
          }
        }
      }

      const promotionalPatterns = [
        /\b(wynajmę|mieszkanie|do wynajęcia|na wynajem|umeblowane|dostępne|wolne|pilnie)\b.*$/gi,
        /\b(od zaraz|centrum|blisko|przy|obok|niedaleko)\b.*$/gi,
        /\b(parking|garaż|winda|balkon|taras)\b.*$/gi,
      ];

      for (const pattern of promotionalPatterns) {
        cleaned = cleaned.replace(pattern, "").trim();
      }

      const numericPattern =
        /^([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż\s.-]+?)\s+\d+\s*[-–].*$/i;
      const numericMatch = numericPattern.exec(cleaned);
      if (numericMatch !== null) {
        cleaned = numericMatch[1].trim();
      }

      cleaned = cleaned.replaceAll(/\s+/g, " ").trim();

      cleaned = cleaned.replace(/[,;!?]+$/, "").trim();

      const words = cleaned.split(/\s+/);
      if (words.length > 1) {
        let lastWord = words.at(-1);
        while (
          words.length > 1 &&
          lastWord !== undefined &&
          this.isDescriptiveWord(lastWord)
        ) {
          words.pop();
          lastWord = words.at(-1);
        }
        cleaned = words.join(" ").trim();
      }
    }

    return cleaned;
  }

  private static looksLikeValidStreetName(name: string): boolean {
    if (!name || name.length < 2) {
      return false;
    }

    if (name.length > 50) {
      return false;
    }

    if (this.containsPromotionalText(name)) {
      return false;
    }

    return this.POLISH_STREET_PATTERNS.some((pattern) => pattern.test(name));
  }

  private static containsPromotionalText(text: string): boolean {
    const lowerText = text.toLowerCase();

    const promotionalKeywords = [
      "wynajmę",
      "mieszkanie",
      "do wynajęcia",
      "najem",
      "oferta",
      "sprzedam",
      "kupię",
      "szukam",
      "pilnie",
      "zapraszam",
      "umeblowane",
      "dostępne",
      "wolne",
      "kontakt",
      "telefon",
    ];

    return promotionalKeywords.some((keyword) => lowerText.includes(keyword));
  }

  private static isDescriptiveWord(word: string): boolean {
    const lowerWord = word.toLowerCase();

    const descriptiveWords = [
      "mieszkanie",
      "wynajmę",
      "składa",
      "dostępne",
      "wolne",
      "umeblowane",
      "nieumeblowane",
      "balkon",
      "garaż",
      "parking",
      "winda",
      "centrum",
      "blisko",
      "przy",
      "obok",
      "niedaleko",
      "najmu",
      "wynajęcia",
      "zaraz",
      "pokoje",
      "pokojowe",
      "kawalerka",
      "kawalerkę",
      "pilnie",
      "pilne!",
      "pilne",
    ];

    return descriptiveWords.includes(lowerWord);
  }

  private static extractCoreStreetName(text: string): string | null {
    const streetPrefixAnywhere =
      /(ul\.|ulica|al\.|aleja|os\.|osiedle|pl\.|plac)\s+([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż\s.-]+?)(?:\s*[,;-]|\s+(?:\d+|mieszkanie|do|wolne|od|umeblowane|wynajmę|pokoje?).*|$)/i.exec(
        text,
      );
    if (streetPrefixAnywhere !== null) {
      const prefix = streetPrefixAnywhere[1];
      const streetName = streetPrefixAnywhere[2].trim();
      const cleanStreetName = streetName.replace(/[,;.!?-]+$/, "").trim();
      return `${prefix} ${cleanStreetName}`;
    }

    const contextualPattern =
      /(?:mieszkanie\s+na\s+|przy\s+|na\s+|lokalizacja\s+przy\s+|pilne!?\s+)?(ul\.|ulica|al\.|aleja|os\.|osiedle|pl\.|plac)\s*([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż\s.-]+?)(?:\s+(?:mieszkanie|do|wolne|od|umeblowane|wynajmę|,|\d+|[-–]).*)?$/i.exec(
        text,
      );
    if (contextualPattern !== null) {
      const prefix = contextualPattern[1];
      const streetName = contextualPattern[2].trim();

      const cleanStreetName = streetName.replace(/[,;.!?]+$/, "").trim();
      return `${prefix} ${cleanStreetName}`;
    }

    const prefixMatch =
      /^(?:pilne!?\s+)?(ul\.|ulica|al\.|aleja|os\.|osiedle|pl\.|plac)\s+([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż\s.-]+?)(?:\s+(?:mieszkanie|do|wolne|od|umeblowane|wynajmę|pilnie|pilne|kawalerkę|,|\d+).*)?$/i.exec(
        text,
      );
    if (prefixMatch !== null) {
      const prefix = prefixMatch[1];
      const streetName = prefixMatch[2].trim();
      const cleanStreetName = streetName.replace(/[,;.!?]+$/, "").trim();
      return `${prefix} ${cleanStreetName}`;
    }

    const streetFirstPattern =
      /^([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+(?:\s+[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+)*?)\s+(?:mieszkanie|do|wolne|od|umeblowane|wynajmę).*$/i.exec(
        text,
      );
    if (streetFirstPattern !== null) {
      const candidate = streetFirstPattern[1].trim();
      if (this.looksLikeValidStreetName(candidate)) {
        return candidate;
      }
    }

    const complexPattern =
      /^([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż.]+(?:\s+[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż.]*)*?)\s+(?:oś\.|os\.|ul\.|al\.)?.*?(?:wynajmę|mieszkanie|do\s+najmu).*$/i.exec(
        text,
      );
    if (complexPattern !== null) {
      let candidate = complexPattern[1].trim();

      candidate = candidate.replace(/\s+(oś\.|os\.)$/, "");
      if (this.looksLikeValidStreetName(candidate)) {
        return candidate;
      }
    }

    const simpleNameMatch =
      /^([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]{3,}(?:\s+[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]{2,})*)/.exec(
        text,
      );
    if (simpleNameMatch !== null) {
      const candidate = simpleNameMatch[1].trim();
      if (
        this.looksLikeValidStreetName(candidate) &&
        !this.containsPromotionalText(candidate)
      ) {
        return candidate;
      }
    }

    return null;
  }

  public static normalizeStreetName(streetName: string): string {
    if (!streetName) {
      return "";
    }

    let normalized = this.cleanStreetName(streetName);

    normalized = normalized
      .replaceAll(/\bulica\b/gi, "ul.")
      .replaceAll(/\baleja\b/gi, "al.")
      .replaceAll(/\bosiedle\b/gi, "os.")
      .replaceAll(/\bplac\b/gi, "pl.")
      .replaceAll(/\bświętego\b/gi, "św.")
      .replaceAll(/\bświętej\b/gi, "św.")
      .replaceAll(/\bimienia\b/gi, "im.");

    normalized = normalized.replaceAll(/\.([A-ZĄĆĘŁŃÓŚŹŻ])/g, ". $1");
    normalized = normalized.replaceAll(/\.\s{2,}/g, ". ");

    normalized = this.capitalizeStreetName(normalized);

    return normalized.trim();
  }

  private static capitalizeStreetName(streetName: string): string {
    return streetName
      .split(/\s+/)
      .map((word) => {
        if (word.includes(".")) {
          return word.toLowerCase();
        }

        if (/^[IVX]+$/.test(word.toUpperCase())) {
          return word.toUpperCase();
        }

        if (word.length > 1) {
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }

        return word.toUpperCase();
      })
      .join(" ");
  }

  public static isValidStreetName(streetName: string): boolean {
    if (!streetName || streetName.length < 2) {
      return false;
    }

    if (streetName.length > 100) {
      return false;
    }

    if (this.containsPromotionalText(streetName)) {
      return false;
    }

    return this.looksLikeValidStreetName(streetName);
  }
}
