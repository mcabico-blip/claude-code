import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { UserClaims } from '@ubi/types';
import { IsOptional, IsString, MinLength } from 'class-validator';
import type { Response } from 'express';
import { CurrentUser } from '../../common/rbac';
import { FileEntity } from './file.entity';
import { FilesService } from './files.service';

class UploadDto {
  @IsString() @MinLength(2) context: string;
  @IsOptional() @IsString() requiresClaim?: string;
}

@Controller('files')
export class FilesController {
  constructor(private readonly svc: FilesService) {}

  /**
   * Edge clients compress BEFORE upload (hard rule 5): field photos <500 KB,
   * DeskGuard screenshots <200 KB. The API enforces a hard ceiling only.
   */
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async upload(
    @CurrentUser() user: UserClaims,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadDto,
  ): Promise<FileEntity> {
    if (!file) throw new BadRequestException('multipart field "file" is required');
    return this.svc.store(user, {
      buffer: file.buffer,
      filename: file.originalname,
      contentType: file.mimetype,
      context: dto.context,
      requiresClaim: dto.requiresClaim,
    });
  }

  /** RBAC-checked at fetch time; no raw paths, no public links (hard rule 4). */
  @Get(':id')
  async download(
    @CurrentUser() user: UserClaims,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { meta, stream } = await this.svc.open(user, id);
    res.setHeader('Content-Type', meta.contentType);
    res.setHeader('Content-Length', String(meta.size));
    res.setHeader('Content-Disposition', `inline; filename="${meta.filename}"`);
    stream.pipe(res);
  }
}
