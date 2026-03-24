import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { ContactImportService } from './contact-import.service';

@Module({
  controllers: [ContactsController],
  providers: [ContactsService, ContactImportService],
  exports: [ContactsService],
})
export class ContactsModule {}
