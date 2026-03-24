import { Module } from '@nestjs/common';
import { ChannelStrategyController } from './channel-strategy.controller';
import { ChannelStrategyService } from './channel-strategy.service';

@Module({
  controllers: [ChannelStrategyController],
  providers: [ChannelStrategyService],
  exports: [ChannelStrategyService],
})
export class ChannelStrategyModule {}
