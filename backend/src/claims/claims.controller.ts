import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { AssessClaimDto } from './assess.dto';
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

  @Post('assess')
  @HttpCode(201)
  assess(@Body() body: AssessClaimDto) {
    return this.claims.assess(body);
  }
}
