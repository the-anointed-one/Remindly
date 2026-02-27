import { Controller, Get } from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { CurrentUser } from '../../common/decorators';

@Controller('appointments')
export class AppointmentController {
    constructor(private readonly appointmentService: AppointmentService) { }

    @Get()
    findAll(@CurrentUser('tenantId') tenantId: string) {
        return this.appointmentService.findAll(tenantId);
    }
}
