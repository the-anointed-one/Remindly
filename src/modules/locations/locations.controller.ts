import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LocationsService } from './locations.service';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';
import { CurrentUser } from '../../common/decorators';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  /** GET /locations — all locations with appointment counts */
  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.locationsService.findAll(tenantId);
  }

  /** GET /locations/slim — id + name only, for dropdowns */
  @Get('slim')
  findAllSlim(@CurrentUser('tenantId') tenantId: string) {
    return this.locationsService.findAllSlim(tenantId);
  }

  /** GET /locations/:id */
  @Get(':id')
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.locationsService.findOne(tenantId, id);
  }

  /** POST /locations */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateLocationDto,
  ) {
    return this.locationsService.create(tenantId, userId, dto);
  }

  /** PATCH /locations/:id */
  @Patch(':id')
  update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.locationsService.update(tenantId, userId, id, dto);
  }

  /** DELETE /locations/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.locationsService.remove(tenantId, userId, id);
  }
}
