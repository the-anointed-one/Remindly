import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { ContactImportService } from './contact-import.service';
import { FormController } from './form.controller';
import { FormService } from './form.service';

@Module({
  controllers: [ContactsController, FormController],
  providers: [ContactsService, ContactImportService, FormService],
  exports: [ContactsService, FormService],
})
export class ContactsModule {}
