import { IsOptional, IsString, MinLength } from 'class-validator';

export class AssessClaimDto {
  @IsString()
  @MinLength(10)
  claimText: string;

  @IsString()
  @MinLength(20)
  evidence: string;

  @IsOptional()
  @IsString()
  productName?: string;

  @IsOptional()
  @IsString()
  formula?: string;
}
