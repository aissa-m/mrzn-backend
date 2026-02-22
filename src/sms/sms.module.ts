import { Module } from '@nestjs/common';
import { ISmsService, SMS_SERVICE } from './sms.interface';
import { SmsStubService } from './sms-stub.service';

@Module({
  providers: [
    {
      provide: SMS_SERVICE,
      useClass: SmsStubService,
    },
  ],
  exports: [SMS_SERVICE],
})
export class SmsModule {}
