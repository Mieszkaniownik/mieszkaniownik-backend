export interface MatchNotificationData {
  userName: string;
  alertName: string;
  offer: {
    title: string;
    price: number;
    city: string;
    district: string | null;
    street: string | null;
    streetNumber: string | null;
    footage: number | null;
    rooms: number | null;
    link: string;
    buildingType: string | null;
    ownerType: string | null;
    parkingType: string | null;
    floor: number | null;
    furniture: boolean | null;
    elevator: boolean | null;
    pets: boolean | null;
    negotiable: boolean | null;
    rentAdditional: number | null;
    views: number;
    summary: string | null;
    contact: string | null;
    createdAt: Date;
    images: string[];
    source: string;
    isNew: boolean;
    latitude?: number | null;
    longitude?: number | null;
    infoAdditional?: string | null;
    furnishing?: string | null;
    media?: string | null;
  };
  mapsUrl: string;
  staticMapUrl: string;
}

export function generateMatchNotificationTemplate(
  data: MatchNotificationData,
): { subject: string; html: string } {
  const { userName, alertName, offer, mapsUrl, staticMapUrl } = data;

  const subject = `${offer.isNew ? 'NOWA OFERTA' : 'Dopasowanie'}: ${offer.title}`;

  const formatPrice = (price: number) => price.toLocaleString('pl-PL');
  const formatDate = (date: Date) => date.toLocaleDateString('pl-PL');

  const getBuildingTypeDisplay = (type: string | null) => {
    const types = {
      BLOCK_OF_FLATS: 'Blok mieszkalny',
      TENEMENT: 'Kamienica',
      DETACHED: 'Dom wolnostojący',
      TERRACED: 'Dom szeregowy',
      APARTMENT: 'Mieszkanie',
      LOFT: 'Loft',
      OTHER: 'Inne',
    };
    return type ? types[type as keyof typeof types] || type : 'Nie podano';
  };

  const getOwnerTypeDisplay = (type: string | null) => {
    const types = {
      PRIVATE: 'Prywatny',
      COMPANY: 'Firma',
      ALL: 'Wszyscy',
    };
    return type ? types[type as keyof typeof types] || type : 'Nie podano';
  };

  const getParkingTypeDisplay = (type: string | null) => {
    const types = {
      NONE: 'Brak',
      STREET: 'Na ulicy',
      SECURED: 'Strzeżony',
      GARAGE: 'Garaż',
      IDENTIFICATOR_FOR_PAID_PARKING: 'Płatny parking',
    };
    return type ? types[type as keyof typeof types] || type : 'Nie podano';
  };

  const getBooleanDisplay = (value: boolean | null) => {
    if (value === null) return 'Nie podano';
    return value ? 'Tak' : 'Nie';
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f3f4f6; }
        .container { max-width: 700px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header h1 { margin: 0 0 10px 0; font-size: 28px; font-weight: bold; }
        .header p { margin: 0; font-size: 16px; opacity: 0.95; }
        .content { background: white; padding: 30px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .property-info { background: #f9fafb; padding: 24px; margin: 20px 0; border-left: 4px solid #EAB308; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .property-info h3 { color: #1E3A8A; margin-top: 0; font-size: 22px; }
        .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .detail-item { padding: 8px; background: white; border-radius: 6px; vertical-align: top; }
        .detail-label { font-weight: bold; color: #3B82F6; font-size: 13px; margin-bottom: 4px; display: block; }
        .detail-value { color: #374151; font-size: 14px; }
        .cta-button { background: #EAB308; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: bold; transition: background 0.3s; box-shadow: 0 2px 4px rgba(234,179,8,0.3); }
        .cta-button:hover { background: #CA8A04; }
        .description { background: #eff6ff; padding: 16px; border-radius: 8px; margin: 15px 0; border-left: 3px solid #3B82F6; }
        .description .detail-label { color: #1E3A8A; }
        .stats-contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 0 0 20px 0; }
        .stats-contact-item { background: #fef9e7; padding: 12px; border-radius: 8px; font-size: 14px; border: 1px solid #fde68a; }
        .footer { text-align: center; margin-top: 30px; padding: 20px; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; }
        .badge-new { background: #EAB308; color: white; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: bold; text-transform: uppercase; display: inline-block; margin-left: 8px; }
        .map-link { background: #eff6ff; padding: 14px; border-radius: 8px; margin: 15px 0; text-align: center; border: 1px solid #bfdbfe; }
        .map-button { background: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; }
        .map-button:hover { background: #2563EB; }
        @media (max-width: 600px) {
          .details-table td { display: block; width: 100% !important; }
          .stats-contact-grid { grid-template-columns: 1fr; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://i.imgur.com/eFM8uPl.png" alt="Mieszkaniownik Logo" style="width: 60px; height: 60px; margin-bottom: 10px; display: inline-block;" />
          <h1>Mieszkaniownik</h1>
        </div>
        <div class="content">
          <h2>Cześć ${userName}!</h2>
          <p>Twój alert "<strong>${alertName}</strong>" znalazł ${offer.isNew ? '<strong style="color: #EAB308;">NOWĄ OFERTĘ</strong>' : 'dopasowanie'}:</p>
          
          <div class="property-info">
            <h3>${offer.title}${offer.isNew ? '<span class="badge-new">Nowa</span>' : ''}</h3>
            
            <table class="details-table" cellpadding="8" cellspacing="8">
              <tr>
                <td class="detail-item" width="33%">
                  <span class="detail-label">Cena:</span>
                  <div class="detail-value">${formatPrice(offer.price)} PLN ${offer.negotiable ? '(do negocjacji)' : ''}</div>
                </td>
                <td class="detail-item" width="33%">
                  <span class="detail-label">Lokalizacja:</span>
                  <div class="detail-value">${offer.city}${offer.district ? `, ${offer.district}` : ''}</div>
                </td>
                ${
                  offer.street || offer.streetNumber
                    ? `
                <td class="detail-item" width="33%">
                  <span class="detail-label">Adres:</span>
                  <div class="detail-value">
                    ${offer.street ? offer.street : ''}${offer.streetNumber ? ` ${offer.streetNumber}` : ''}
                  </div>
                </td>
                `
                    : `
                <td class="detail-item" width="33%">
                  <span class="detail-label">Powierzchnia:</span>
                  <div class="detail-value">${offer.footage} m²</div>
                </td>
                `
                }
              </tr>
              <tr>
                ${
                  offer.street || offer.streetNumber
                    ? `
                <td class="detail-item" width="33%">
                  <span class="detail-label">Powierzchnia:</span>
                  <div class="detail-value">${offer.footage} m²</div>
                </td>
                `
                    : ''
                }
                ${
                  offer.rooms
                    ? `
                <td class="detail-item" width="33%">
                  <span class="detail-label">Liczba pokoi:</span>
                  <div class="detail-value">${offer.rooms}</div>
                </td>
                `
                    : ''
                }
                ${
                  offer.floor !== null
                    ? `
                <td class="detail-item" width="33%">
                  <span class="detail-label">Piętro:</span>
                  <div class="detail-value">${offer.floor === 0 ? 'Parter' : offer.floor}</div>
                </td>
                `
                    : ''
                }
                ${
                  !offer.rooms && offer.floor === null
                    ? `
                <td class="detail-item" width="33%">
                  <span class="detail-label">Typ budynku:</span>
                  <div class="detail-value">${getBuildingTypeDisplay(offer.buildingType)}</div>
                </td>
                `
                    : ''
                }
              </tr>
              <tr>
                ${
                  offer.rooms || offer.floor !== null
                    ? `
                <td class="detail-item" width="33%">
                  <span class="detail-label">Typ budynku:</span>
                  <div class="detail-value">${getBuildingTypeDisplay(offer.buildingType)}</div>
                </td>
                `
                    : ''
                }
                <td class="detail-item" width="33%">
                  <span class="detail-label">Typ właściciela:</span>
                  <div class="detail-value">${getOwnerTypeDisplay(offer.ownerType)}</div>
                </td>
                ${
                  offer.source !== 'otodom'
                    ? `
                <td class="detail-item" width="33%">
                  <span class="detail-label">Parking:</span>
                  <div class="detail-value">${getParkingTypeDisplay(offer.parkingType)}</div>
                </td>
                `
                    : `
                <td class="detail-item" width="33%">
                  <span class="detail-label">Umeblowane:</span>
                  <div class="detail-value">${getBooleanDisplay(offer.furniture)}</div>
                </td>
                `
                }
              </tr>
              <tr>
                <td class="detail-item" width="33%">
                  <span class="detail-label">Umeblowane:</span>
                  <div class="detail-value">${getBooleanDisplay(offer.furniture)}</div>
                </td>
                <td class="detail-item" width="33%">
                  <span class="detail-label">Winda:</span>
                  <div class="detail-value">${getBooleanDisplay(offer.elevator)}</div>
                </td>
                ${
                  offer.source !== 'otodom'
                    ? `
                <td class="detail-item" width="33%">
                  <span class="detail-label">Zwierzęta:</span>
                  <div class="detail-value">${getBooleanDisplay(offer.pets)}</div>
                </td>
                `
                    : `
                <td class="detail-item" width="33%">
                  <span class="detail-label">Źródło:</span>
                  <div class="detail-value" style="font-weight: bold; color: #3B82F6; text-transform: uppercase;">Otodom</div>
                </td>
                `
                }
              </tr>
              <tr>
                ${
                  offer.source !== 'otodom'
                    ? `
                <td class="detail-item" width="33%">
                  <span class="detail-label">Źródło:</span>
                  <div class="detail-value" style="font-weight: bold; color: #1E3A8A; text-transform: uppercase;">OLX</div>
                </td>
                `
                    : ''
                }
                ${
                  offer.rentAdditional
                    ? `
                <td class="detail-item" width="33%">
                  <span class="detail-label">Czynsz dodatkowy:</span>
                  <div class="detail-value">${formatPrice(offer.rentAdditional)} PLN</div>
                </td>
                `
                    : ''
                }
              </tr>
            </table>

            ${
              offer.summary
                ? `
            <div style="background: #fef9e7; padding: 12px; border-radius: 8px; font-size: 14px; border: 1px solid #fde68a; margin: 15px 0 0 0;">
              <div class="detail-label">Opis:</div>
              <div style="margin-top: 4px;">${offer.summary}</div>
            </div>
            `
                : ''
            }

            ${
              offer.infoAdditional
                ? `
            <div style="background: #fef9e7; padding: 12px; border-radius: 8px; font-size: 14px; border: 1px solid #fde68a; margin: 0;">
              <div class="detail-label">Informacje dodatkowe:</div>
              <div style="margin-top: 4px;">${offer.infoAdditional}</div>
            </div>
            `
                : ''
            }

            ${
              offer.furnishing
                ? `
            <div style="background: #fef9e7; padding: 12px; border-radius: 8px; font-size: 14px; border: 1px solid #fde68a; margin: 0;">
              <div class="detail-label">Wyposażenie:</div>
              <div style="margin-top: 4px;">${offer.furnishing}</div>
            </div>
            `
                : ''
            }

            ${
              offer.media
                ? `
            <div style="background: #fef9e7; padding: 12px; border-radius: 8px; font-size: 14px; border: 1px solid #fde68a; margin: 0;">
              <div class="detail-label">Media:</div>
              <div style="margin-top: 4px;">${offer.media}</div>
            </div>
            `
                : ''
            }

            <div class="stats-contact-grid">
              <div class="stats-contact-item">
                <div class="detail-label">Statystyki:</div>
                <div>${offer.views} wyświetleń<br>Dodano: ${formatDate(offer.createdAt)}</div>
              </div>
              ${
                offer.contact
                  ? `
              <div class="stats-contact-item">
                <div class="detail-label">Kontakt:</div>
                <div>${offer.contact}</div>
              </div>
              `
                  : '<div></div>'
              }
            </div>

            ${
              offer.images && offer.images.length > 0
                ? `
            <div style="margin: 20px 0;">
              <table cellpadding="5" cellspacing="5" style="width: 100%;">
                ${(() => {
                  const images = offer.images.slice(0, 8);
                  let rows = '';
                  for (let i = 0; i < images.length; i += 2) {
                    rows += '<tr>';
                    rows += `<td width="50%" style="padding: 5px;"><img src="${images[i]}" alt="Zdjęcie mieszkania" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; border: 2px solid #e5e7eb; display: block;"></td>`;
                    if (images[i + 1]) {
                      rows += `<td width="50%" style="padding: 5px;"><img src="${images[i + 1]}" alt="Zdjęcie mieszkania" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; border: 2px solid #e5e7eb; display: block;"></td>`;
                    } else {
                      rows += '<td width="50%"></td>';
                    }
                    rows += '</tr>';
                  }
                  return rows;
                })()}
              </table>
              ${
                offer.images.length > 8
                  ? `<p style="font-size: 12px; color: #6b7280; margin-top: 10px; text-align: center;">I ${offer.images.length - 8} więcej zdjęć w pełnym ogłoszeniu...</p>`
                  : ''
              }
            </div>
            `
                : ''
            }

            ${
              mapsUrl && staticMapUrl
                ? `
            <div style="margin: 20px 0; text-align: center;">
              <img src="${staticMapUrl}" alt="Mapa lokalizacji" style="border-radius: 8px; max-width: 100%; height: auto; border: 2px solid #bfdbfe;" />
            </div>
            `
                : ''
            }
          </div>

          <table cellpadding="0" cellspacing="0" style="width: 100%; margin: 20px 0;">
            <tr>
              <td style="text-align: center; padding: 10px;" width="50%">
                <a href="${offer.link}" class="cta-button" style="display: inline-block; background: #EAB308; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; box-shadow: 0 2px 4px rgba(234,179,8,0.3);">Zobacz ogłoszenie</a>
              </td>
              ${
                mapsUrl
                  ? `
              <td style="text-align: center; padding: 10px;" width="50%">
                <a href="${mapsUrl}" target="_blank" class="map-button" style="display: inline-block; background: #3B82F6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; box-shadow: 0 2px 4px rgba(59,130,246,0.3);">Zobacz mapę</a>
              </td>
              `
                  : ''
              }
            </tr>
          </table>
        </div>
        <div class="footer">
          <p>To jest automatyczne powiadomienie z systemu Mieszkaniownik.<br>
          Jeśli nie chcesz otrzymywać takich wiadomości, możesz wyłączyć alert w panelu użytkownika.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}
