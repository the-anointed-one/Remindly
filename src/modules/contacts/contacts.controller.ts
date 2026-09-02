import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ContactsService } from './contacts.service';
import { ContactImportService } from './contact-import.service';
import {
  CreateContactDto,
  UpdateContactDto,
  ContactQueryDto,
  BulkTagDto,
  BulkDeleteDto,
  CreateGroupDto,
  AddMembersDto,
  CreateTagDto,
  AssignTagDto,
} from './dto/contact.dto';
import { CurrentUser } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(
    private readonly contactsService: ContactsService,
    private readonly importService: ContactImportService,
  ) {}

  // ── Stats ─────────────────────────────────

  @Get('stats')
  getStats(@CurrentUser('tenantId') tenantId: string) {
    return this.contactsService.getStats(tenantId);
  }

  // ── Tags list ─────────────────────────────

  @Get('groups')
  getGroups(@CurrentUser('tenantId') tenantId: string) {
    return this.contactsService.getAllGroups(tenantId);
  }

  @Post('groups')
  createGroup(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateGroupDto,
  ) {
    return this.contactsService.createGroup(tenantId, dto);
  }

  @Post('groups/:id/members')
  addMembersToGroup(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMembersDto,
  ) {
    return this.contactsService.addMembersToGroup(tenantId, id, dto);
  }

  @Delete('groups/:id/members/:contactId')
  removeMemberFromGroup(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.contactsService.removeMemberFromGroup(tenantId, id, contactId);
  }

  @Get('tags')
  getTags(@CurrentUser('tenantId') tenantId: string) {
    return this.contactsService.getAllTags(tenantId);
  }

  @Post('tags')
  createTag(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateTagDto,
  ) {
    return this.contactsService.createTag(tenantId, dto);
  }

  @Post(':id/tags')
  assignTag(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTagDto,
  ) {
    return this.contactsService.assignTagToContact(tenantId, id, dto);
  }

  // ── CRUD ──────────────────────────────────

  @Get()
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: ContactQueryDto,
  ) {
    return this.contactsService.findAll(tenantId, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.contactsService.findOne(tenantId, id);
  }

  @Get(':id/activity')
  getActivity(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.contactsService.getActivity(tenantId, id);
  }

  @Get(':id/reminders')
  getReminders(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.contactsService.getReminders(tenantId, id);
  }

  @Get(':id/messages')
  getMessages(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.contactsService.getMessages(tenantId, id);
  }

  @Get(':id/groups')
  getContactGroups(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.contactsService.getContactGroups(tenantId, id);
  }

  @Post(':id/groups')
  addToGroup(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { groupId?: string; groupName?: string },
  ) {
    return this.contactsService.addContactToGroup(
      tenantId,
      id,
      body.groupId,
      body.groupName,
    );
  }

  @Delete(':id/groups/:groupId')
  @HttpCode(HttpStatus.OK)
  removeFromGroup(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ) {
    return this.contactsService.removeContactFromGroup(tenantId, id, groupId);
  }

  @Post()
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateContactDto,
  ) {
    return this.contactsService.create(tenantId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.contactsService.remove(tenantId, id);
  }

  // ── Bulk operations ───────────────────────

  @Post('bulk/tag')
  bulkTag(@CurrentUser('tenantId') tenantId: string, @Body() dto: BulkTagDto) {
    return this.contactsService.bulkTag(tenantId, dto);
  }

  @Post('bulk/delete')
  @HttpCode(HttpStatus.OK)
  bulkDelete(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: BulkDeleteDto,
  ) {
    return this.contactsService.bulkDelete(tenantId, dto);
  }

  // ── Import ────────────────────────────────

  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'text/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/octet-stream',
        ];
        const allowedExts = ['.csv', '.xlsx', '.xls'];
        const ext = '.' + file.originalname.split('.').pop()?.toLowerCase();
        if (allowed.includes(file.mimetype) || allowedExts.includes(ext)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException('Only CSV and Excel files are allowed'),
            false,
          );
        }
      },
    }),
  )
  async importContacts(
    @CurrentUser('tenantId') tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.importService.uploadCSV(tenantId, file.buffer, file.mimetype);
  }
}
