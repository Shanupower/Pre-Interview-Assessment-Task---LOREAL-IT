import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { AssessClaimDto, AttachStudyDto, SubmitClaimDto } from './assess.dto';
import { ClaimsService } from './claims.service';

@Controller('claims')
export class ClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  @Get('products')
  products() {
    return this.claims.listProducts();
  }

  @Get()
  history(@Query('product') product: string) {
    if (!product) return [];
    return this.claims.history(product);
  }

  @Post()
  @HttpCode(201)
  submit(@Body() body: SubmitClaimDto) {
    return this.claims.submit(body);
  }

  @Post('assess')
  @HttpCode(201)
  assess(@Body() body: AssessClaimDto) {
    return this.claims.assess(body);
  }

  @Post(':id/assess')
  @HttpCode(201)
  attach(@Param('id') id: string, @Body() body: AttachStudyDto) {
    return this.claims.attachStudy(id, body.evidence);
  }
}
