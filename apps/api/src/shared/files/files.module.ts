import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createStorageProvider, type StorageProvider } from '@ubi/storage';
import { FileEntity } from './file.entity';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { STORAGE } from './storage.token';

export { STORAGE } from './storage.token';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([FileEntity])],
  controllers: [FilesController],
  providers: [
    FilesService,
    {
      provide: STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): StorageProvider =>
        createStorageProvider({
          driver: config.get<string>('STORAGE_DRIVER', 'local'),
          root: config.get<string>('STORAGE_ROOT', './uploads'),
        }),
    },
  ],
  exports: [FilesService, STORAGE],
})
export class FilesModule {}
