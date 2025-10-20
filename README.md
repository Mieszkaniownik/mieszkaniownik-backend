<p align="center">
  <img src="banner.png" alt="Mieszkaniownik Banner" width="100%"/>
</p>

<p align="center">
    <strong>Your key to student housing</strong>
</p>

<p align="center">
<a href="https://discord.com/oauth2/authorize?client_id=1422117898389819532&scope=bot&permissions=268435456">
    <img src="https://img.shields.io/badge/Discord-Bot-5865F2?style=for-the-badge&logo=discord" alt="Discord Bot">
</a>

<a href="https://discord.gg/W2SCjUYXCe">
    <img src="https://img.shields.io/badge/Discord-Server-7289DA?style=for-the-badge&logo=discord" alt="Discord Server">
</a>

<a href="mailto:mieszkaniownik@gmail.com">
    <img src="https://img.shields.io/badge/Gmail-Contact-EA4335?style=for-the-badge&logo=gmail" alt="Gmail Contact">
</a>
</p>

## Tech Stack

<div align="center">

[![NestJS](https://img.shields.io/badge/NestJS-11.x-E0234E?logo=nestjs)](https://nestjs.com/) [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/) [![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js)](https://nodejs.org/) [![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma)](https://www.prisma.io/) [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16.x-4169E1?logo=postgresql)](https://www.postgresql.org/)

[![Puppeteer](https://img.shields.io/badge/Puppeteer-24.x-40B5A4?logo=puppeteer)](https://pptr.dev/) [![BullMQ](https://img.shields.io/badge/BullMQ-5.x-DC382D?logo=bull)](https://docs.bullmq.io/) [![Redis](https://img.shields.io/badge/Redis-7.x-DC382D?logo=redis)](https://redis.io/) [![Cheerio](https://img.shields.io/badge/Cheerio-1.x-E88C1D)](https://cheerio.js.org/)

[![Google Gemini](https://img.shields.io/badge/Google_Gemini-0.x-4285F4?logo=google)](https://ai.google.dev/) [![Google Maps](https://img.shields.io/badge/Google_Maps-3.x-4285F4?logo=googlemaps)](https://developers.google.com/maps) [![Discord.js](https://img.shields.io/badge/Discord.js-14.x-5865F2?logo=discord)](https://discord.js.org/) [![Nodemailer](https://img.shields.io/badge/Nodemailer-7.x-22B8E0)](https://nodemailer.com/)

[![Docker](https://img.shields.io/badge/Docker_Compose-2.x-2496ED?logo=docker)](https://www.docker.com/) [![Kubernetes](https://img.shields.io/badge/Kubernetes-1.x-326CE5?logo=kubernetes)](https://kubernetes.io/) [![Helm](https://img.shields.io/badge/Helm-3.x-0F1689?logo=helm)](https://helm.sh/) [![Nginx](https://img.shields.io/badge/Nginx-1.x-009639?logo=nginx)](https://nginx.org/)

[![Status](https://img.shields.io/badge/Status-Beta-orange)]() [![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

## About the Project

**Mieszkaniownik** is a solution designed for students looking for an apartment or room to rent. With the current turnover of rental offers on platforms like OLX, every second counts. Why spend hours refreshing the website when you can simply create an alert, specify what kind of apartment you're interested in and your budget? Then, as soon as an offer appears, you'll receive a notification via email or Discord with all the most important information.

### Target Audience

Students looking for a room or apartment

### Added Value

- **Time saved** - automatic offer monitoring instead of manual refreshing
- **Faster apartment finding** - instant notifications about new offers
- **More offers to choose from** - aggregation from multiple sources
- **Stress reduction** - no fear or stress associated with apartment hunting

### API Documentation

![API Documentation](api.png)

## System Overview

```mermaid
graph LR


    subgraph NESTJS["NestJS Application"]
        direction LR

        subgraph ORCHESTRATION["Orchestration"]
            SS[ScraperService<br/>Cron Scheduler]
            STM[ScraperThreadManager]
        end

        subgraph BROWSER_POOL["Browser Pool"]
            BP[BrowserSetupService<br/>Pool Manager]
            OLX_BROWSERS[OLX Pool<br/>2 Browsers]
            OTODOM_BROWSERS[Otodom Pool<br/>2 Browsers]
            BP --> OLX_BROWSERS
            BP --> OTODOM_BROWSERS
        end

        subgraph WORKERS["Worker Threads<br/>(Lightweight)"]
            OW[olx-extractor.worker<br/>Regex HTML Parser]
            OTW[otodom-extractor.worker<br/>Regex HTML Parser]
        end

        subgraph QUEUES["BullMQ Queues"]
            OEQ[(olx-existing<br/>Priority: 5)]
            ONQ[(olx-new<br/>Priority: 1 HIGH)]
            OTEQ[(otodom-existing<br/>Priority: 5)]
            OTNQ[(otodom-new<br/>Priority: 1 HIGH)]
        end

        subgraph PROCESSORS["Queue Processors"]
            SYS_OEP[OlxExisting<br/>Processor<br/>Concurrency: 2]
            SYS_ONP[OlxNew<br/>Processor<br/>Concurrency: 2]
            SYS_OTEP[OtodomExisting<br/>Processor<br/>Concurrency: 2]
            SYS_OTNP[OtodomNew<br/>Processor<br/>Concurrency: 2]
            SYS_SP[Scraper<br/>Processor<br/>Core Logic]
        end

        subgraph SERVICES["Support Services"]
            AI[AI Address<br/>Extractor]
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
        direction TB
        REDIS[(Redis)]
        POSTGRES[(PostgreSQL)]
        GOOGLE[Google AI<br/>Gemini]
        NOMINATIM[Nominatim<br/>OSM]
        GMAPS[Google<br/>Maps]
        EMAIL[Gmail<br/>SMTP]
        DISCORD[Discord<br/>API]
    end

        subgraph WEBSITES["Target Websites"]
                direction TB
        OLX[OLX.pl]
        OTODOM[Otodom.pl]
    end

    %% Flow connections
    WEBSITES ~~~ NESTJS
    NESTJS ~~~ EXTERNAL

    SS --> STM
    STM --> BP

    OLX_BROWSERS -.->|fetch HTML| OLX
    OTODOM_BROWSERS -.->|fetch HTML| OTODOM

    BP -.->|HTML string| STM
    STM -.->|spawn with HTML| OW & OTW
    OW & OTW -.->|URLs| STM

    STM --> OEQ & ONQ & OTEQ & OTNQ

    OEQ --> SYS_OEP
    ONQ --> SYS_ONP
    OTEQ --> SYS_OTEP
    OTNQ --> SYS_OTNP

    SYS_OEP & SYS_ONP & SYS_OTEP & SYS_OTNP --> SYS_SP

    SYS_SP --> AI & PP & OA & BP

    AI --> GOOGLE
    OA -.->|auth cookies| OTODOM_BROWSERS
    BP -.->|browser from pool| SYS_SP
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
    participant BP as Browser Pool<br/>(2 OLX + 2 Otodom)
    participant EW as Extractor Workers<br/>(Lightweight)
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

        par Parallel Scraping with Browser Pool
            STM->>BP: Get OLX browser
            BP->>OLX: Fetch HTML (pages 1-10)
            OLX-->>BP: HTML content
            BP-->>STM: HTML content
            STM->>EW: Spawn olx-extractor.worker
            Note over EW: Parse HTML with regex<br/>Extract offer URLs<br/>(< 1 second)
            EW-->>STM: Offer URLs
            STM->>QE: Queue URLs (olx-existing)
            QE->>PROC: Consume (P:5)
            PROC->>SP: Process offers
            SP-->>DB: Save (isNew: false)
        and
            STM->>BP: Get Otodom browser
            BP->>OTODOM: Fetch HTML (pages 1-10)
            OTODOM-->>BP: HTML content
            BP-->>STM: HTML content
            STM->>EW: Spawn otodom-extractor.worker
            Note over EW: Parse HTML with regex<br/>Extract offer URLs<br/>(< 1 second)
            EW-->>STM: Offer URLs
            STM->>QE: Queue URLs (otodom-existing)
            QE->>PROC: Consume (P:5)
            PROC->>SP: Process offers
            SP-->>DB: Save (isNew: false)
        end

    Note over User,DB: Phase 2: Continuous - New Offers (Every Second)
        SS->>STM: startNewOffersWorkers()

        par High Priority Scraping with Browser Pool
            STM->>BP: Get OLX browser
            BP->>OLX: Fetch HTML (PAGE 1 ONLY)
            OLX-->>BP: Latest HTML
            BP-->>STM: HTML content
            STM->>EW: Spawn olx-extractor.worker
            EW-->>STM: Latest URLs
            STM->>QN: Queue (olx-new, P:1 HIGH)
            QN->>PROC: Consume (P:1)
            PROC->>SP: Process offers
            SP-->>DB: Save (isNew: true)
        and
            STM->>BP: Get Otodom browser
            BP->>OTODOM: Fetch HTML (PAGE 1 ONLY)
            OTODOM-->>BP: Latest HTML
            BP-->>STM: HTML content
            STM->>EW: Spawn otodom-extractor.worker
            EW-->>STM: Latest URLs
            STM->>QN: Queue (otodom-new, P:1 HIGH)
            QN->>PROC: Consume (P:1)
            PROC->>SP: Process offers
            SP-->>DB: Save (isNew: true)
        end

    Note over User,DB: Phase 3: Full Refresh (Every Hour)
        SS->>STM: startExistingOffersWorkers()
        SS->>STM: startNewOffersWorkers()
        Note over STM: Triggers complete scraping cycle<br/>using browser pools
```

## Scraping Algorithm

```mermaid
flowchart TB
    START([App Start<br/>+5s delay])
    START --> INIT[Init Service<br/>startExistingWorkers]
    INIT --> BROWSER_POOL[Browser Pool Init<br/>2 OLX + 2 Otodom browsers]

    BROWSER_POOL --> SPLIT_EXIST{ }
    SPLIT_EXIST --> OLX_EXIST[OLX Main Thread]
    SPLIT_EXIST --> OTDM_EXIST[Otodom Main Thread]

    OLX_EXIST --> OLX_FETCH[Fetch HTML via Browser Pool<br/>Pages 1-10]
    OTDM_EXIST --> OTDM_FETCH[Fetch HTML via Browser Pool<br/>Pages 1-10]

    OLX_FETCH --> OLX_WORKER[Spawn olx-extractor.worker<br/>Parse HTML with regex]
    OTDM_FETCH --> OTDM_WORKER[Spawn otodom-extractor.worker<br/>Parse HTML with regex]

    OLX_WORKER --> OLX_Q[olx-existing<br/>P:5]
    OTDM_WORKER --> OTDM_Q[otodom-existing<br/>P:5]

    OLX_Q --> OLX_PROC[OlxExistingProc]
    OTDM_Q --> OTDM_PROC[OtodomExistingProc]

    OLX_PROC --> MERGE_EXIST{ }
    OTDM_PROC --> MERGE_EXIST

    MERGE_EXIST --> CRON_SEC([Every Second<br/>Cron Job])
    CRON_SEC --> NEW_INIT[Start New Workers]
    NEW_INIT --> SPLIT_NEW{ }

    SPLIT_NEW --> OLX_NEW[OLX Main Thread]
    SPLIT_NEW --> OTDM_NEW[Otodom Main Thread]

    OLX_NEW --> OLX_NEW_FETCH[Fetch HTML via Browser Pool<br/>PAGE 1 ONLY]
    OTDM_NEW --> OTDM_NEW_FETCH[Fetch HTML via Browser Pool<br/>PAGE 1 ONLY]

    OLX_NEW_FETCH --> OLX_NEW_WORKER[Spawn olx-extractor.worker]
    OTDM_NEW_FETCH --> OTDM_NEW_WORKER[Spawn otodom-extractor.worker]

    OLX_NEW_WORKER --> OLX_NEW_Q[olx-new<br/>P:1 HIGH]
    OTDM_NEW_WORKER --> OTDM_NEW_Q[otodom-new<br/>P:1 HIGH]

    OLX_NEW_Q --> OLX_NEW_PROC[OlxNewProc]
    OTDM_NEW_Q --> OTDM_NEW_PROC[OtodomNewProc]

    OLX_NEW_PROC --> MERGE_NEW{ }
    OTDM_NEW_PROC --> MERGE_NEW

    MERGE_NEW --> MAIN_PROC[ScraperProcessor<br/>Main Logic]

    MAIN_PROC --> BROWSER[Browser Setup<br/>From Pool]
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
    CRON_HOUR --> FULL[Run Both Workers<br/>Existing + New]
    FULL --> BROWSER_POOL
    END --> CRON_SEC
```

## Worker Thread

```mermaid
graph TB
    subgraph MAIN["Main Thread - NestJS Application"]
        direction TB
        SS[ScraperService<br/>Cron Orchestrator]
        STM[ThreadManager<br/>Worker Management]
        BP[BrowserSetupService<br/>Browser Pool Manager]

        SS --> STM
        STM --> BP

        subgraph BROWSER_POOLS["Browser Pools (Separate)"]
            direction LR
            OLX_POOL[OLX Pool<br/>2 browsers<br/>Max concurrent: 2]
            OTODOM_POOL[Otodom Pool<br/>2 browsers<br/>Max concurrent: 2]
        end

        BP --> OLX_POOL
        BP --> OTODOM_POOL

        subgraph QUEUES["BullMQ Queue System"]
            direction LR
            OEQ[(olx-existing<br/>P:5)]
            ONQ[(olx-new<br/>P:1)]
            OTEQ[(otodom-existing<br/>P:5)]
            OTNQ[(otodom-new<br/>P:1)]
        end

        subgraph PROCESSORS["Queue Processors"]
            direction TB
            OEP[OlxExisting<br/>Concurrency: 2]
            ONP[OlxNew<br/>Concurrency: 2]
            OTEP[OtodomExisting<br/>Concurrency: 2]
            OTNP[OtodomNew<br/>Concurrency: 2]
            SP[ScraperProcessor<br/>Core Logic<br/><i>Shared by all processors</i>]

            OEP --> SP
            ONP --> SP
            OTEP --> SP
            OTNP --> SP
        end
    end

    subgraph WT1["Worker Thread 1: olx-extractor.worker.ts"]
        direction TB
        OW[Entry Point]
        OW_DATA[Worker Data<br/>• pageNum<br/>• html string<br/>• isNewOffersOnly]
        OW_REGEX[Regex Extraction<br/>No Puppeteer<br/>Pure HTML parsing]
        OW_RETURN[Return URLs<br/>< 1 second]

        OW --> OW_DATA
        OW_DATA --> OW_REGEX
        OW_REGEX --> OW_RETURN
    end

    subgraph WT2["Worker Thread 2: otodom-extractor.worker.ts"]
        direction TB
        OTW[Entry Point]
        OTW_DATA[Worker Data<br/>• pageNum<br/>• html string<br/>• isNewOffersOnly]
        OTW_REGEX[Regex Extraction<br/>No Puppeteer<br/>Pure HTML parsing]
        OTW_RETURN[Return URLs<br/>< 1 second]

        OTW --> OTW_DATA
        OTW_DATA --> OTW_REGEX
        OTW_REGEX --> OTW_RETURN
    end

    subgraph WEBSITES["Target Websites"]
        OLX[OLX.pl]
        OTODOM[Otodom.pl]
    end

    %% Browser Pool fetches HTML
    OLX_POOL -.->|fetch HTML| OLX
    OTODOM_POOL -.->|fetch HTML| OTODOM

    %% Main Thread spawns Workers with HTML
    STM -.->|spawn with HTML| OW
    STM -.->|spawn with HTML| OTW

    %% Workers return URLs to Main Thread
    OW_RETURN -.->|URLs| STM
    OTW_RETURN -.->|URLs| STM

    %% Main Thread queues URLs
    STM --> OEQ & ONQ & OTEQ & OTNQ

    %% Queues to Processors
    OEQ --> OEP
    ONQ --> ONP
    OTEQ --> OTEP
    OTNQ --> OTNP

    %% Processors use Browser Pool
    SP --> BP
```

## Database Schema

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
