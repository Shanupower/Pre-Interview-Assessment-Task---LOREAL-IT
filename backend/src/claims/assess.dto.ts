import { IsOptional, IsString, MinLength } from 'class-validator';

export class SubmitClaimDto {
  @IsString()
  @MinLength(10)
  claimText: string;

  @IsString()
  @MinLength(1)
  productName: string;

  @IsOptional()
  @IsString()
  formula?: string;
}

export class AttachStudyDto {
  @IsString()
  @MinLength(20)
  evidence: string;
}

export class AssessClaimDto extends SubmitClaimDto {
  @IsString()
  @MinLength(20)
  evidence: string;
}
