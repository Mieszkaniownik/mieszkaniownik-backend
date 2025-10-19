import { isMainThread, parentPort, workerData } from "node:worker_threads";

export interface ExtractorWorkerData {
  pageNum: number;
  html: string;
  isNewOffersOnly?: boolean;
}

export interface ExtractorWorkerResult {
  success: boolean;
  offers: string[];
  hasNextPage: boolean;
  error?: string;
  pageNum: number;
  source: "olx" | "otodom";
}

if (!isMainThread && parentPort !== null) {
  const data = workerData as ExtractorWorkerData;

  try {
    const offerRegex =
      /<a[^>]*href="(https:\/\/www\.olx\.pl\/d\/oferta\/[^"]+)"/g;
    const offers: string[] = [];
    const seenUrls = new Set<string>();

    let match = offerRegex.exec(data.html);
    while (match !== null) {
      const url = match[1];
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        offers.push(url);
      }
      match = offerRegex.exec(data.html);
    }

    const hasNextPage =
      data.html.includes('data-testid="pagination-forward"') ||
      data.html.includes('aria-label="następna strona"');

    const result: ExtractorWorkerResult = {
      success: true,
      offers,
      hasNextPage,
      pageNum: data.pageNum,
      source: "olx",
    };

    parentPort.postMessage(result);
    process.exit(0);
  } catch (error: unknown) {
    const result: ExtractorWorkerResult = {
      success: false,
      offers: [],
      hasNextPage: false,
      error: error instanceof Error ? error.message : "Unknown error",
      pageNum: data.pageNum,
      source: "olx",
    };
    parentPort.postMessage(result);
    process.exit(1);
  }
}
