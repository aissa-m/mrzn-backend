import { IsNumber, Min } from 'class-validator';

export class WalletTopupDto {
  @IsNumber()
  @Min(100, { message: 'El importe mínimo es 100 MRU' })
  amount!: number; // en MRU (ouguiya)
}
