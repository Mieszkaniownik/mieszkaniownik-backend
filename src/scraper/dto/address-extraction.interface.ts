export interface AddressExtractionResult {
  street?: string;
  streetNumber?: string;
  fullAddress?: string;
  confidence?: number;
  extractedFrom: "title" | "description" | "both";
  rawText: string;
}
