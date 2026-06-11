import { Body, Controller, Get, Global, Injectable, Module, Param, Post, Query } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import type { UserClaims } from '@ubi/types';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { Column, Entity, Repository } from 'typeorm';
import { BaseAppEntity } from '../../common/base.entity';
import { CurrentUser } from '../../common/rbac';

/** One ticketing engine shared by IT helpdesk AND Admin inquiries. */
@Entity('ticket')
export class TicketEntity extends BaseAppEntity {
  @Column({ type: 'varchar' })
  source: 'it' | 'admin';

  @Column()
  category: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', default: 'open' })
  status: 'open' | 'in-progress' | 'done';

  /** Auto-assign pairs tech location with ticket location (IT spec). */
  @Column()
  location: string;

  @Column({ type: 'varchar', nullable: true })
  assignee: string | null;
}

class CreateTicketDto {
  @IsIn(['it', 'admin']) source: 'it' | 'admin';
  @IsString() @MinLength(2) category: string;
  @IsString() @MinLength(4) title: string;
  @IsString() @MinLength(4) body: string;
  @IsString() @MinLength(2) location: string;
}

class MoveTicketDto {
  @IsIn(['open', 'in-progress', 'done']) status: 'open' | 'in-progress' | 'done';
  @IsOptional() @IsString() assignee?: string;
}

@Injectable()
export class TicketingService {
  constructor(@InjectRepository(TicketEntity) private readonly tickets: Repository<TicketEntity>) {}

  create(user: UserClaims, dto: CreateTicketDto): Promise<TicketEntity> {
    return this.tickets.save(
      this.tickets.create({ ...dto, entity: user.entity, createdBy: user.email }),
    );
  }

  list(source?: 'it' | 'admin'): Promise<TicketEntity[]> {
    return this.tickets.find({
      where: source ? { source } : {},
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async move(id: string, dto: MoveTicketDto): Promise<TicketEntity | null> {
    await this.tickets.update(id, { status: dto.status, ...(dto.assignee ? { assignee: dto.assignee } : {}) });
    return this.tickets.findOne({ where: { id } });
  }
}

@Controller('tickets')
export class TicketingController {
  constructor(private readonly svc: TicketingService) {}

  @Post()
  create(@CurrentUser() user: UserClaims, @Body() dto: CreateTicketDto): Promise<TicketEntity> {
    return this.svc.create(user, dto);
  }

  @Get()
  list(@Query('source') source?: 'it' | 'admin'): Promise<TicketEntity[]> {
    return this.svc.list(source);
  }

  @Post(':id/move')
  move(@Param('id') id: string, @Body() dto: MoveTicketDto): Promise<TicketEntity | null> {
    return this.svc.move(id, dto);
  }
}

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([TicketEntity])],
  controllers: [TicketingController],
  providers: [TicketingService],
  exports: [TicketingService],
})
export class TicketingModule {}
