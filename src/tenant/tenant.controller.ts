import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { TenantService } from './tenant.service';
import { Tenant } from './tenant.entity';

class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  async create(@Body() dto: CreateTenantDto): Promise<Tenant> {
    return this.tenantService.createTenant(dto.name);
  }

  @Get()
  async findAll(): Promise<Tenant[]> {
    return this.tenantService.getTenants();
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.tenantService.deleteTenant(id);
  }
}
