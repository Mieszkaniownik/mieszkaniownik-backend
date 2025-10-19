import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";

describe("AppController", () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe("root", () => {
    it("should return health check", () => {
      const result = appController.healthCheck();
      expect(result).toHaveProperty("status", "ok");
      expect(result).toHaveProperty("timestamp");
      expect(result).toHaveProperty("uptime");
      expect(typeof result.timestamp).toBe("string");
      expect(typeof result.uptime).toBe("number");
    });
  });
});
