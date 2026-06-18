import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { UserClaims, WhereIsAnswer } from '@ubi/types';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { CurrentUser } from '../../common/rbac';
import { DocTrackingService } from './doc-tracking.service';
import { DocumentEntity } from './document.entity';

class CreateDocDto {
  @IsString() @MinLength(2) type: string;
  @IsString() @MinLength(2) title: string;
  @IsOptional() @IsString() location?: string;
}

class TransmitDto {
  @IsString() @MinLength(2) to: string;
  @IsOptional() @IsString() note?: string;
}

class ReceiveDto {
  @IsOptional() @IsString() location?: string;
}

@Controller('docs')
export class DocTrackingController {
  constructor(private readonly svc: DocTrackingService) {}

  @Post()
  create(@CurrentUser() user: UserClaims, @Body() dto: CreateDocDto): Promise<DocumentEntity> {
    return this.svc.create(user, dto);
  }

  @Get()
  list(): Promise<DocumentEntity[]> {
    return this.svc.list();
  }

  @Get('where/:code')
  whereIs(@Param('code') code: string): Promise<WhereIsAnswer> {
    return this.svc.whereIs(code);
  }

  @Post(':code/transmit')
  transmit(
    @CurrentUser() user: UserClaims,
    @Param('code') code: string,
    @Body() dto: TransmitDto,
  ): Promise<DocumentEntity> {
    return this.svc.transmit(user, code, dto.to, dto.note);
  }

  @Post(':code/receive')
  receive(
    @CurrentUser() user: UserClaims,
    @Param('code') code: string,
    @Body() dto: ReceiveDto,
  ): Promise<DocumentEntity> {
    return this.svc.receive(user, code, dto.location);
  }
}
