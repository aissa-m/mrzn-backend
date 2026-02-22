import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateMeDto } from './update-me.dto';
import { BadRequestException } from '@nestjs/common';

describe('UpdateMeDto', () => {
  it('should pass with valid email', async () => {
    const dto = plainToInstance(UpdateMeDto, {
      email: 'user@example.com',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should result in 400 with code INVALID_EMAIL for invalid email', async () => {
    const dto = plainToInstance(UpdateMeDto, {
      email: 'not-an-email',
    });
    try {
      await validate(dto);
    } catch (e: any) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect(e.response?.code).toBe('INVALID_EMAIL');
      expect(e.response?.message).toBeDefined();
      return;
    }
    throw new Error('Expected validate() to throw');
  });
});
