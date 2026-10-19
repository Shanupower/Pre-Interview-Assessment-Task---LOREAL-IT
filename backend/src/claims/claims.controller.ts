import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AssessClaimDto } from './assess.dto';
import { ClaimsService } from './claims.service';

@Controller('claims')
export class ClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  @Post('assess')
  @HttpCode(201)
  assess(@Body() body: AssessClaimDto) {
    return this.claims.assess(body);
  }
}
