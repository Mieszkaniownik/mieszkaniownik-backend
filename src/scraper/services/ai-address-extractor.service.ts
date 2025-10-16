import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import type { AddressExtractionResult } from '../dto/address-extraction.interface';

interface aiResponse {
  street?: string;
  streetNumber?: string;
  estateName?: string;
  confidence?: 'high' | 'medium' | 'low' | 'none';
  found: boolean;
}

@Injectable()
export class aiAddressExtractorService {
  private readonly logger = new Logger(aiAddressExtractorService.name);
  private readonly genAI: GoogleGenerativeAI | null;
  private readonly model: GenerativeModel | null;

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        'GOOGLE_AI_API_KEY not set, AI address extraction will be disabled',
      );
      this.genAI = null;
      this.model = null;
      return;
    }

    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: 'models/gemini-2.0-flash',
      });
      this.logger.log('AI service initialized successfully');
    } catch (error) {
      this.logger.error(
        `Failed to initialize AI service: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      this.genAI = null;
      this.model = null;
    }
  }

  async extractAddress(
    title: string,
    description?: string,
  ): Promise<AddressExtractionResult | null> {
    if (!this.model) {
      this.logger.warn('AI model not initialized, skipping AI extraction');
      return null;
    }

    try {
      const textToAnalyze = description ? `${title}. ${description}` : title;

      this.logger.log(
        `Extracting address using AI from: "${textToAnalyze.substring(
          0,
          100,
        )}..."`,
      );

      const prompt = this.buildExtractionPrompt(textToAnalyze);
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      this.logger.debug(`AI raw response: ${text}`);

      return this.parseAiResponse(text, textToAnalyze, title, description);
    } catch (error) {
      this.logger.error(
        `Error extracting address with AI: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return null;
    }
  }

  private buildExtractionPrompt(text: string): string {
    return `
Analyze the following Polish rental property listing text and extract the street name and street number if present.

TEXT TO ANALYZE:
"${text}"

INSTRUCTIONS:
1. Look for Polish street addresses in the format:
   - "ul. [Street Name] [Number]" (ulica = street)
   - "al. [Street Name] [Number]" (aleja = avenue)  
   - "os. [Street Name] [Number]" (osiedle = housing estate)
   - "pl. [Street Name] [Number]" (plac = square)
   - "[Street Name] [Number]" (direct format)

2. Common patterns to look for:
   - "przy ul. Krakowska 15" → street: "ul. Krakowska", number: "15"
   - "ul. Floriańska 20/5" → street: "ul. Floriańska", number: "20/5"
   - "Mickiewicza 12A" → street: "Mickiewicza", number: "12A"
   - "na alei Solidarności 45" → street: "al. Solidarności", number: "45"

3. Ignore promotional text like:
   - "wynajmę mieszkanie"
   - "do wynajęcia"
   - "umeblowane"
   - "dostępne od"
   - "centrum miasta"

4. Return ONLY a JSON response in this exact format:
{
  "street": "extracted street name with prefix if present",
  "streetNumber": "extracted number (can include letters like 12A, 20/5)",
  "confidence": "high|medium|low",
  "found": true/false
}

5. If no clear street address OR estate name is found, return:
{
  "found": false,
  "confidence": "none"
}

RESPOND WITH ONLY THE JSON, NO OTHER TEXT:`;
  }

  private parseAiResponse(
    response: string,
    rawText: string,
    title: string,
    description?: string,
  ): AddressExtractionResult {
    try {
      const cleanResponse = response
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .replace(/^[^{]*/, '')
        .replace(/[^}]*$/, '')
        .trim();

      this.logger.debug(`Cleaned AI response: ${cleanResponse}`);

      const parsed = JSON.parse(cleanResponse) as aiResponse;

      if (!parsed.found) {
        return {
          extractedFrom: 'title',
          rawText,
          confidence: 0,
        };
      }

      let confidence = 0;
      switch (parsed.confidence?.toLowerCase()) {
        case 'high':
          confidence = 0.95;
          break;
        case 'medium':
          confidence = 0.75;
          break;
        case 'low':
          confidence = 0.55;
          break;
        default:
          confidence = 0.5;
      }

      let extractedFrom: 'title' | 'description' | 'both' = 'title';
      if (description && parsed.street) {
        const inTitle = title
          .toLowerCase()
          .includes(parsed.street.toLowerCase());
        const inDescription = description
          .toLowerCase()
          .includes(parsed.street.toLowerCase());

        if (inTitle && inDescription) {
          extractedFrom = 'both';
        } else if (inDescription) {
          extractedFrom = 'description';
        }
      }

      let fullAddress = '';
      if (parsed.street && parsed.streetNumber) {
        fullAddress = `${parsed.street} ${parsed.streetNumber}`;
      } else if (parsed.street) {
        fullAddress = parsed.street;
      }

      if (parsed.estateName) {
        fullAddress = fullAddress
          ? `${fullAddress}, ${parsed.estateName}`
          : parsed.estateName;
      }

      const result: AddressExtractionResult = {
        street: parsed.street || undefined,
        streetNumber: parsed.streetNumber || undefined,
        fullAddress: fullAddress || undefined,
        confidence,
        extractedFrom,
        rawText,
      };

      const extractionDetails: string[] = [];
      if (result.street) {
        extractionDetails.push(`street: ${result.street}`);
      }
      if (result.streetNumber) {
        extractionDetails.push(`number: ${result.streetNumber}`);
      }

      this.logger.log(
        `AI extracted (${extractionDetails.join(', ')}) → ${result.fullAddress} (confidence: ${confidence})`,
      );

      return result;
    } catch (parseError) {
      this.logger.error(
        `Error parsing AI response: ${
          parseError instanceof Error ? parseError.message : 'Unknown error'
        }`,
      );
      this.logger.debug(`Raw response that failed to parse: ${response}`);

      return {
        extractedFrom: 'title',
        rawText,
        confidence: 0,
      };
    }
  }

  isAvailable(): boolean {
    return !!this.model;
  }

  async generateSummary(
    title: string,
    description: string,
  ): Promise<string | null> {
    if (!this.model) {
      this.logger.warn('AI model not initialized, skipping summary generation');
      return null;
    }

    try {
      this.logger.log(
        `Generating summary using AI for: "${title.substring(0, 50)}..."`,
      );

      const prompt = this.buildSummaryPrompt(title, description);
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const summary = response.text().trim();

      const limitedSummary =
        summary.length > 500 ? summary.substring(0, 497) + '...' : summary;

      this.logger.log(
        `Generated summary (${limitedSummary.length} chars): "${limitedSummary.substring(0, 100)}..."`,
      );

      return limitedSummary;
    } catch (error) {
      this.logger.error(
        `Error generating summary with AI: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return null;
    }
  }

  private buildSummaryPrompt(title: string, description: string): string {
    return `
Przeanalizuj poniższe ogłoszenie o wynajmie mieszkania i stwórz zwięzłe streszczenie w języku polskim.

TYTUŁ: "${title}"

OPIS: "${description}"

INSTRUKCJE:
1. Stwórz krótkie, zwięzłe streszczenie (maksymalnie 450 znaków)
2. Uwzględnij najważniejsze informacje: lokalizację, cenę, powierzchnię, liczbę pokoi
3. Dodaj kluczowe udogodnienia (winda, parking, umeblowane, zwierzęta)
4. Użyj naturalnego języka polskiego
5. Pomiń informacje kontaktowe i dane osobowe
6. Skoncentruj się na tym, co jest najważniejsze dla potencjalnego najemcy
7. Nie używaj niepotrzebnych ozdobników czy zachęt marketingowych

PRZYKŁAD DOBREGO STRESZCZENIA:
"Przestronne 3-pokojowe mieszkanie (65m²) w centrum Krakowa przy ul. Floriańskiej. Czynsz 3500 zł. Umeblowane, z windą, miejscem parkingowym. Blisko komunikacji miejskiej i galerii handlowej. Dostępne od zaraz."

ODPOWIEDZ TYLKO STRESZCZENIEM, BEZ DODATKOWEGO TEKSTU:`;
  }

  getStatus(): { available: boolean; reason?: string } {
    if (!process.env.GOOGLE_AI_API_KEY) {
      return {
        available: false,
        reason: 'GOOGLE_AI_API_KEY environment variable not set',
      };
    }

    if (!this.model) {
      return {
        available: false,
        reason: 'AI model failed to initialize',
      };
    }

    return { available: true };
  }
}
