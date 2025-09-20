import { Test, TestingModule } from '@nestjs/testing';
import { OfferController } from './offer.controller';
import { OfferService } from './offer.service';

describe('OfferController', () => {
  let controller: OfferController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OfferController],
      providers: [OfferService],
    }).compile();

    controller = module.get<OfferController>(OfferController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
