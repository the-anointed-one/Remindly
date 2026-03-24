import { Module, Global } from '@nestjs/common';
import { EmailProvider } from './email.provider';

@Global()
@Module({
  providers: [EmailProvider],
  exports: [EmailProvider],
})
export class EmailModule {}
