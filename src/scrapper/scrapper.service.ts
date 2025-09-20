import axios from "axios";
import { extract_data, OLXListing } from "./utils/OLX_listing";
import { CronExpression } from "@nestjs/schedule";
export class ScrapperService {
  private readonly apiUrl = 'https://www.olx.pl/apigateway/graphql';
  private getHeaders() {
    return {
      'Accept': 'application/json',
      'Accept-Language': 'pl',
      'Content-Type': 'application/json',
      'Origin': 'https://www.olx.pl',
      'Referer': 'https://www.olx.pl/nieruchomosci/mieszkania/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0',
      'Sec-Ch-Ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Opera GX";v="119"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
    };
  }

  private readonly query = `
    query ListingSearchQuery($searchParameters: [SearchParameter!] = {key: "", value: ""}) {
      clientCompatibleListings(searchParameters: $searchParameters) {
        __typename
        ... on ListingSuccess {
          data {
            id
            title
            description
            url
            created_time
            location {
              city { name }
              district { name }
              region { name }
            }
            params {
              key
              name
              value {
                __typename
                ... on PriceParam {
                  value
                  currency
                  label
                  negotiable
                  arranged
                }
                ... on GenericParam {
                  label
                }
              }
            }
            photos {
              link
              width  
              height
            }
            user {
              name
              is_online
            }
          }
          metadata {
            total_elements
            visible_total_count
          }
          links {
            next { href }
            previous { href }
          }
        }
        ... on ListingError {
          error {
            code
            detail
            title
          }
        }
      }
    }
  `;

  async searchApartments(options: {
    categoryId?: string;
    offset?: number;
    limit?: number;
    cityId?: string;
    priceFrom?: string;
    priceTo?: string;
  } = {}) {
    
    const {
      categoryId = '1307', 
      offset = 0,
      limit = 40,
      cityId,
      priceFrom,
      priceTo
    } = options;

    const variables = {
      searchParameters: [
        { key: "offset", value: offset.toString() },
        { key: "limit", value: limit.toString() },
        { key: "category_id", value: categoryId },
        { key: "filter_refiners", value: "spell_checker" },
        { key: "sort_by", value: "created_at:desc" },
        ...(cityId ? [{ key: "city_id", value: cityId }] : []),
        ...(priceFrom ? [{ key: "filter_float_price:from", value: priceFrom }] : []),
        ...(priceTo ? [{ key: "filter_float_price:to", value: priceTo }] : []),
      ]
    };

    try {
      console.log(`🔍 Szukam mieszkań... offset: ${offset}, limit: ${limit}`);
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          query: this.query,
          variables: variables
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        console.error(' GraphQL Errors:', result.errors);
        throw new Error('GraphQL query failed');
      }

      const listingData = result.data.clientCompatibleListings;
      
      if (listingData.__typename === 'ListingError') {
        console.error(' OLX API Error:', listingData.error);
        throw new Error(`OLX Error: ${listingData.error.title}`);
      }

      const olxlistings= listingData.data as OLXListing[]; 
      return extract_data(olxlistings); 

    } catch (error) {
      console.error(' Błąd podczas pobierania danych z OLX:', error);
      throw error;
    }
  }

}
