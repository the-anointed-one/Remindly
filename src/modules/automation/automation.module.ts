import { Module } from '@nestjs/common';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowProcessorService } from './workflow-processor.service';
import { MessagingModule } from '../messaging/messaging.module';
import { BillingModule } from '../billing/billing.module';
import { WorkflowWorker } from '../../workers/workflow.worker';
import { AutomationExecutionTracker } from './automation-execution-tracker.service';

@Module({
  // BillingModule: WorkflowWorker uses CouponService to mint incentive codes.
  imports: [MessagingModule, BillingModule],
  controllers: [AutomationController],
  providers: [
    AutomationService,
    WorkflowEngineService,
    WorkflowProcessorService,
    WorkflowWorker,
    AutomationExecutionTracker,
  ],
  exports: [WorkflowEngineService, WorkflowWorker, AutomationExecutionTracker],
})
export class AutomationModule {}
