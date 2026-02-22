import { Test, TestingModule } from '@nestjs/testing';
import { AdminHealthController } from '../admin-health.controller';

describe('AdminHealthController', () => {
  let controller: AdminHealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminHealthController],
    }).compile();

    controller = module.get<AdminHealthController>(AdminHealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('health', () => {
    it('should return { ok: true }', () => {
      expect(controller.health()).toEqual({ ok: true });
    });
  });
});
