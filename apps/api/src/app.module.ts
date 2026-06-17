import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacGuard } from './common/rbac';
import { HealthController } from './health/health.controller';
import { CeoModule } from './modules/ceo/ceo.module';
import { DeptModule } from './modules/dept/dept.module';
import { EngineeringModule } from './modules/engineering/engineering.module';
import { EquipmentModule } from './modules/equipment/equipment.module';
import { ItModule } from './modules/it/it.module';
import { MqcModule } from './modules/mqc/mqc.module';
import { OmegaModule } from './modules/omega/omega.module';
import { OperationsModule } from './modules/operations/operations.module';
import { SurveyModule } from './modules/survey/survey.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { PropertyModule } from './modules/property/property.module';
import { QuantityModule } from './modules/quantity/quantity.module';
import { RecordsModule } from './modules/records/records.module';
import { StubsModule } from './modules/stubs/stubs.module';
import { AiLayerModule } from './pillars/ai-layer/ai-layer.module';
import { AuthModule } from './pillars/auth/auth.module';
import { DocTrackingModule } from './pillars/doc-tracking/doc-tracking.module';
import { SeedModule } from './seed/seed.module';
import { ApprovalsModule } from './shared/approvals/approvals.module';
import { ExpiryModule } from './shared/expiry/expiry.module';
import { FilesModule } from './shared/files/files.module';
import { NotificationsModule } from './shared/notifications/notifications.module';
import { TicketingModule } from './shared/ticketing/ticketing.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    // Stateful endpoints are EXTERNAL from line one (hard rule 6) — even
    // co-located, the API only ever knows host:port from config.
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DB_HOST', '127.0.0.1'),
        port: Number(config.get('DB_PORT', 5432)),
        username: config.get<string>('DB_USER', 'ubi'),
        password: config.get<string>('DB_PASS', 'ubi_dev'),
        database: config.get<string>('DB_NAME', 'ubi_suite'),
        autoLoadEntities: true,
        // Dev convenience; migrations replace this before production.
        synchronize: config.get('DB_SYNC') === 'true',
      }),
    }),
    // Pillars — built before modules, used by all.
    AuthModule,
    AiLayerModule,
    DocTrackingModule,
    // Shared services — build once, reuse everywhere.
    FilesModule,
    ApprovalsModule,
    TicketingModule,
    NotificationsModule,
    ExpiryModule,
    // Department modules (breadth-first; deep work on module branches).
    EngineeringModule,
    QuantityModule,
    EquipmentModule,
    ProcurementModule,
    OperationsModule,
    PropertyModule,
    RecordsModule,
    ItModule,
    OmegaModule,
    SurveyModule,
    MqcModule,
    DeptModule,
    StubsModule,
    CeoModule,
    SeedModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: RbacGuard }],
})
export class AppModule {}
