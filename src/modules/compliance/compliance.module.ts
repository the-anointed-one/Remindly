import { Module } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { ReminderModule } from '../reminder/reminder.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [ReminderModule, AuditModule],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
