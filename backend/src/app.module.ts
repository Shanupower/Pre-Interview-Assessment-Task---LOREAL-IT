import { Module } from '@nestjs/common';
import { ClaimsModule } from './claims/claims.module';

@Module({
  imports: [ClaimsModule],
})
export class AppModule {}
