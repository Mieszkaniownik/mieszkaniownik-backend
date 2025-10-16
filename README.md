<p align="center">
  <img src="banner.png" alt="Mieszkaniownik Banner" width="100%"/>
</p>

> **Twój klucz do studenckiego mieszkania**

### Backend: [![NestJS](https://img.shields.io/badge/NestJS-11.0-E0234E?logo=nestjs)](https://nestjs.com/) [![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org/) [![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js)](https://nodejs.org/) [![Prisma](https://img.shields.io/badge/Prisma-6.16-2D3748?logo=prisma)](https://www.prisma.io/) [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://www.postgresql.org/)

### Scraping & Automation: [![Puppeteer](https://img.shields.io/badge/Puppeteer-24.22-40B5A4?logo=puppeteer)](https://pptr.dev/) [![BullMQ](https://img.shields.io/badge/BullMQ-5.58-DC382D?logo=bull)](https://docs.bullmq.io/) [![Redis](https://img.shields.io/badge/Redis-7+-DC382D?logo=redis)](https://redis.io/) [![Cheerio](https://img.shields.io/badge/Cheerio-1.1-E88C1D)](https://cheerio.js.org/)

### AI & Services: [![Google Gemini](https://img.shields.io/badge/Google_Gemini-0.24-4285F4?logo=google)](https://ai.google.dev/) [![Google Maps](https://img.shields.io/badge/Google_Maps-API-4285F4?logo=googlemaps)](https://developers.google.com/maps) [![Discord.js](https://img.shields.io/badge/Discord.js-14.22-5865F2?logo=discord)](https://discord.js.org/) [![Nodemailer](https://img.shields.io/badge/Nodemailer-7.0-22B8E0)](https://nodemailer.com/)

### DevOps: [![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://www.docker.com/) [![Kubernetes](https://img.shields.io/badge/Kubernetes-Helm-326CE5?logo=kubernetes)](https://kubernetes.io/) [![Nginx](https://img.shields.io/badge/Nginx-Latest-009639?logo=nginx)](https://nginx.org/)

### Status: [![Status](https://img.shields.io/badge/Status-Beta-orange)]() [![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

## O Projekcie

**Mieszkaniownik** to rozwiązanie skierowane dla studentów poszukujących mieszkania lub pokoju na wynajem. Przy obecnej rotacji ofert wynajmu np. na OLX każda sekunda jest na wagę złota. Po co przepatrywać godzinami odświeżając stronę internetową, jeśli możemy po prostu utworzyć alert, wpisać jakie mieszkanie nas interesuje i jaki mamy budżet? Następnie od razu po pokazaniu się oferty dostajesz powiadomienie na maila lub Discorda z wszystkimi najważniejszymi informacjami.

### Grupa Docelowa

Studenci poszukujący pokoju lub mieszkania

### Wartość Dodana

- **Zaoszczędzony czas** - automatyczne monitorowanie ofert zamiast ręcznego odświeżania
- **Szybsze znalezienie mieszkania** - natychmiastowe powiadomienia o nowych ofertach
- **Więcej ofert do wyboru** - agregacja z wielu źródeł
- **Redukcja stresu** - żadnego strachu i stresu związanego z poszukiwaniem mieszkania

## System Overview

```mermaid
graph LR
    subgraph WEBSITES["Target Websites"]
        OLX[OLX.pl]
        OTODOM[Otodom.pl]
    end

    subgraph NESTJS["NestJS Application"]
        direction LR

        subgraph ORCHESTRATION["Orchestration"]
            SS[ScraperService<br/>Cron Scheduler]
            STM[ScraperThreadManager]
        end

        subgraph WORKERS["Worker Threads"]
            OW[OLX Worker<br/>Puppeteer]
            OTW[Otodom Worker<br/>Puppeteer]
        end

        subgraph QUEUES["BullMQ Queues"]
            OEQ[(olx-existing<br/>Priority: 5)]
            ONQ[(olx-new<br/>Priority: 1 HIGH)]
            OTEQ[(otodom-existing<br/>Priority: 5)]
            OTNQ[(otodom-new<br/>Priority: 1 HIGH)]
        end

        subgraph PROCESSORS["Queue Processors"]
            SYS_OEP[OlxExisting<br/>Processor]
            SYS_ONP[OlxNew<br/>Processor]
            SYS_OTEP[OtodomExisting<br/>Processor]
            SYS_OTNP[OtodomNew<br/>Processor]
            SYS_SP[Scraper<br/>Processor<br/>Core Logic]
        end

        subgraph SERVICES["Support Services"]
            AI[AI Address<br/>Extractor]
            BS[Browser<br/>Setup]
            PP[Parameter<br/>Parser]
            OA[Otodom<br/>Auth Service]
        end

        subgraph CORE["Core Modules"]
            DM[Database<br/>Prisma ORM]
            MM[Match<br/>Module]
            NM[Notification<br/>Module]
            HM[Heatmap<br/>Module]
            AM[Auth<br/>JWT/OAuth]
            UM[User<br/>Module]
        end
    end

    subgraph EXTERNAL["External Services"]
        REDIS[(Redis)]
        POSTGRES[(PostgreSQL)]
        GOOGLE[Google AI<br/>Gemini]
        NOMINATIM[Nominatim<br/>OSM]
        GMAPS[Google<br/>Maps]
        EMAIL[Gmail<br/>SMTP]
        DISCORD[Discord<br/>API]
    end

    %% Flow connections
    SS --> STM
    STM --> OW
    STM --> OTW

    OW -.->|scrape| OLX
    OTW -.->|scrape| OTODOM

    OW --> OEQ & ONQ
    OTW --> OTEQ & OTNQ

    OEQ --> SYS_OEP
    ONQ --> SYS_ONP
    OTEQ --> SYS_OTEP
    OTNQ --> SYS_OTNP

    SYS_OEP & SYS_ONP & SYS_OTEP & SYS_OTNP --> SYS_SP

    SYS_SP --> AI & BS & PP & OA

    AI --> GOOGLE
    OA -.->|auth cookies| OTODOM
    BS -.->|retry| OLX & OTODOM
    SYS_SP --> NOMINATIM
    SYS_SP --> DM

    DM --> POSTGRES
    MM --> POSTGRES
    MM --> NM
    NM --> EMAIL & DISCORD & GMAPS

    OEQ & ONQ & OTEQ & OTNQ -.->|store| REDIS
```

## Multi-Threading Architecture

```mermaid
sequenceDiagram
    autonumber
    actor User as App Start
    participant SS as ScraperService
    participant STM as ThreadManager
    participant OW as OLX Worker
    participant OTW as Otodom Worker
    participant OLX as OLX.pl
    participant OTODOM as Otodom.pl
    participant QE as Existing Queues<br/>(Priority: 5)
    participant QN as New Queues<br/>(Priority: 1)
    participant PROC as Queue Processors
    participant SP as ScraperProcessor
    participant DB as Database

    Note over User,DB: Phase 1: Startup - Existing Offers (5s delay)
        User->>SS: onModuleInit()
        SS->>STM: startExistingOffersWorkers()

        par Parallel Scraping
            STM->>OW: Spawn Worker (isNew: false)
            OW->>OLX: Scrape pages 1-25
            OLX-->>OW: Offer URLs
            OW->>QE: Queue URLs
            QE->>PROC: Consume (P:5)
            PROC->>SP: Process offers
            SP-->>DB: Save (isNew: false)
        and
            STM->>OTW: Spawn Worker (isNew: false)
            OTW->>OTODOM: Scrape pages 1-500
            OTODOM-->>OTW: Offer URLs
            OTW->>QE: Queue URLs
            QE->>PROC: Consume (P:5)
            PROC->>SP: Process offers
            SP-->>DB: Save (isNew: false)
        end

    Note over User,DB: Phase 2: Continuous - New Offers (Every Second)
        SS->>STM: startNewOffersWorkers()

        par High Priority Scraping
            STM->>OW: Spawn Worker (isNew: true)
            OW->>OLX: Scrape PAGE 1 ONLY
            OLX-->>OW: Latest URLs
            OW->>QN: Queue (HIGH Priority)
            QN->>PROC: Consume (P:1)
            PROC->>SP: Process offers
            SP-->>DB: Save (isNew: true)
        and
            STM->>OTW: Spawn Worker (isNew: true)
            OTW->>OTODOM: Scrape PAGE 1 ONLY
            OTODOM-->>OTW: Latest URLs
            OTW->>QN: Queue (HIGH Priority)
            QN->>PROC: Consume (P:1)
            PROC->>SP: Process offers
            SP-->>DB: Save (isNew: true)
        end

    Note over User,DB: Phase 3: Full Refresh (Every Hour)
        SS->>STM: scrapeWithBothThreads(25, 500)
        Note over STM: Triggers complete scraping cycle
```

## Scraping Algorithm Flow

```mermaid
flowchart TB
    START([App Start<br/>+5s delay])
    START --> INIT[Init Service<br/>startExistingWorkers]
    INIT --> SPAWN_EXIST[Spawn 2 Threads]

    SPAWN_EXIST --> SPLIT_EXIST{ }
    SPLIT_EXIST --> OLX_EXIST[OLX Worker<br/>isNew: false]
    SPLIT_EXIST --> OTDM_EXIST[Otodom Worker<br/>isNew: false]

    OLX_EXIST --> OLX_SCRAPE[Scrape 25 pages<br/>Extract URLs]
    OTDM_EXIST --> OTDM_SCRAPE[Scrape 500 pages<br/>Extract URLs]

    OLX_SCRAPE --> OLX_Q[olx-existing<br/>P:5]
    OTDM_SCRAPE --> OTDM_Q[otodom-existing<br/>P:5]

    OLX_Q --> OLX_PROC[OlxExistingProc]
    OTDM_Q --> OTDM_PROC[OtodomExistingProc]

    OLX_PROC --> MERGE_EXIST{ }
    OTDM_PROC --> MERGE_EXIST

    MERGE_EXIST --> CRON_SEC([Every Second<br/>Cron Job])
    CRON_SEC --> NEW_INIT[Start New Workers]
    NEW_INIT --> SPAWN_NEW[Spawn 2 Threads]

    SPAWN_NEW --> SPLIT_NEW{ }
    SPLIT_NEW --> OLX_NEW[OLX Worker<br/>isNew: true]
    SPLIT_NEW --> OTDM_NEW[Otodom Worker<br/>isNew: true]

    OLX_NEW --> OLX_NEW_SCRAPE[Scrape PAGE 1<br/>Latest URLs]
    OTDM_NEW --> OTDM_NEW_SCRAPE[Scrape PAGE 1<br/>Latest URLs]

    OLX_NEW_SCRAPE --> OLX_NEW_Q[olx-new<br/>P:1 HIGH]
    OTDM_NEW_SCRAPE --> OTDM_NEW_Q[otodom-new<br/>P:1 HIGH]

    OLX_NEW_Q --> OLX_NEW_PROC[OlxNewProc]
    OTDM_NEW_Q --> OTDM_NEW_PROC[OtodomNewProc]

    OLX_NEW_PROC --> MERGE_NEW{ }
    OTDM_NEW_PROC --> MERGE_NEW

    MERGE_NEW --> MAIN_PROC[ScraperProcessor<br/>Main Logic]

    MAIN_PROC --> BROWSER[Browser Setup<br/>Puppeteer]
    BROWSER --> AUTH{Otodom?}
    AUTH -->|Yes| OTODOM_AUTH[Apply Auth<br/>Cookies]
    AUTH -->|No| PARSE
    OTODOM_AUTH --> PARSE[Parse Parameters<br/>Extract Data]
    PARSE --> AI[AI Extraction<br/>Google Gemini]
    AI --> GEO[Geocoding<br/>Nominatim OSM]
    GEO --> SAVE[Save to DB<br/>PostgreSQL]
    SAVE --> MATCH[Match Check<br/>Score Calculation]
    MATCH --> DECISION{Match Found?}

    DECISION -->|Yes| NOTIFY[Send Notification<br/>Email + Discord]
    DECISION -->|No| END[Job Complete]
    NOTIFY --> END

    CRON_HOUR([Every Hour<br/>Full Refresh])
    CRON_HOUR --> FULL[Full Scrape<br/>scrapeWithBothThreads]
    FULL --> SPAWN_EXIST
    END --> CRON_SEC
```

## Worker Thread Implementation

```mermaid
graph TB
    subgraph MAIN["Main Thread - NestJS Application"]
        direction TB
        SS[ScraperService<br/>Cron Orchestrator]
        STM[ThreadManager<br/>Worker Management]

        SS --> STM

        subgraph QUEUES["BullMQ Queue System"]
            direction LR
            OEQ[(olx-existing<br/>P:5)]
            ONQ[(olx-new<br/>P:1)]
            OTEQ[(otodom-existing<br/>P:5)]
            OTNQ[(otodom-new<br/>P:1)]
        end

        subgraph PROCESSORS["Queue Processors"]
            direction TB
            OEP[OlxExisting]
            ONP[OlxNew]
            OTEP[OtodomExisting]
            OTNP[OtodomNew]
            SP[ScraperProcessor<br/>Core Logic<br/><i>Shared by all processors</i>]

            OEP --> SP
            ONP --> SP
            OTEP --> SP
            OTNP --> SP
        end
    end

    subgraph WT1["Worker Thread 1: olx-worker.ts"]
        direction TB
        OW[Entry Point]
        OW_DATA[Worker Data<br/>• pageNum<br/>• sortOrder<br/>• baseUrl<br/>• userAgents<br/>• isNewOffersOnly]
        OW_PUPPET[Puppeteer<br/>+ Stealth Plugin]
        OW_LOGIC[Scraping Logic<br/>Navigate & Extract]

        OW --> OW_DATA
        OW_DATA --> OW_PUPPET
        OW_PUPPET --> OW_LOGIC
    end

    subgraph WT2["Worker Thread 2: otodom-worker.ts"]
        direction TB
        OTW[Entry Point]
        OTW_DATA[Worker Data<br/>• pageNum<br/>• baseUrl<br/>• userAgents<br/>• isNewOffersOnly]
        OTW_PUPPET[Puppeteer<br/>+ Stealth Plugin]
        OTW_LOGIC[Scraping Logic<br/>Navigate & Extract]

        OTW --> OTW_DATA
        OTW_DATA --> OTW_PUPPET
        OTW_PUPPET --> OTW_LOGIC
    end

    %% Main Thread spawns Workers
    STM -.->|spawn| OW
    STM -.->|spawn| OTW

    %% Workers return to Main Thread
    OW_LOGIC -.->|URLs| STM
    OTW_LOGIC -.->|URLs| STM

    %% Main Thread queues URLs
    STM --> OEQ & ONQ & OTEQ & OTNQ

    %% Queues to Processors
    OEQ --> OEP
    ONQ --> ONP
    OTEQ --> OTEP
    OTNQ --> OTNP
```

## Database Schema & Data Flow

```mermaid
erDiagram
    User ||--o{ Alert : "creates"
    User ||--o{ Notification : "receives"
    Alert ||--o{ Match : "generates"
    Offer ||--o{ Match : "triggers"
    Match ||--o{ Notification : "sends"

    User {
        int id PK "Primary Key"
        string email UK "Unique Email"
        string name "User Name"
        string provider "OAuth Provider"
        datetime createdAt "Created"
        datetime updatedAt "Updated"
        boolean isArchived "Archived Status"
    }

    Alert {
        int id PK "Primary Key"
        int userId FK "User Reference"
        string name "Alert Name"
        string city "City"
        int minPrice "Min Price"
        int maxPrice "Max Price"
        int minRooms "Min Rooms"
        int maxRooms "Max Rooms"
        int minFootage "Min m²"
        int maxFootage "Max m²"
        boolean elevator "Elevator"
        boolean furnished "Furnished"
        boolean pets "Pets Allowed"
        boolean parking "Parking"
        string[] keywords "Keywords"
        boolean isActive "Active Status"
        datetime createdAt "Created"
        datetime updatedAt "Updated"
    }

    Offer {
        int id PK "Primary Key"
        string title "Title"
        string description "Description"
        string link UK "Unique URL"
        int price "Price"
        string city "City"
        string street "Street"
        string streetNumber "Number"
        string district "District"
        string estateName "Estate"
        decimal latitude "GPS Lat"
        decimal longitude "GPS Lng"
        int rooms "Rooms"
        int footage "Area m²"
        string buildingType "Type"
        boolean elevator "Elevator"
        boolean furnished "Furnished"
        boolean pets "Pets"
        boolean parking "Parking"
        string[] images "Image URLs"
        string source "Source Site"
        int views "View Count"
        string viewsMethod "View Method"
        boolean isNew "New Flag"
        boolean available "Available"
        datetime createdAt "Created"
        datetime updatedAt "Updated"
    }

    Match {
        int id PK "Primary Key"
        int alertId FK "Alert Reference"
        int offerId FK "Offer Reference"
        float score "Match Score"
        boolean notified "Notification Sent"
        datetime createdAt "Created"
    }

    Notification {
        int id PK "Primary Key"
        int userId FK "User Reference"
        int matchId FK "Match Reference"
        string type "Type"
        string channel "Channel"
        string status "Status"
        string content "Content"
        datetime sentAt "Sent Time"
        datetime createdAt "Created"
    }
```
