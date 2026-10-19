import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { ClaimsController } from './claims.controller';
import { ClaimsService } from './claims.service';

@Module({
  controllers: [ClaimsController],
  providers: [ClaimsService, PrismaService],
})
export class ClaimsModule {}
