import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';
import type { Response } from 'express';
import { DriverProfileService } from './driver-profile.service';
import { DocumentType } from './driver-document.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { TenantContextGuard } from '../../tenancy/guards/tenant-context.guard';
import { TenantAccessGuard } from '../../tenancy/guards/tenant-access.guard';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import * as fs from 'fs';

class UpdateDriverProfileDto {
  @IsString()
  @IsOptional()
  idNumber?: string;

  @IsString()
  @IsOptional()
  passportNumber?: string;

  @IsString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  licenseNumber?: string;

  @IsString()
  @IsOptional()
  licenseExpiry?: string;

  @IsString()
  @IsOptional()
  prdpNumber?: string;

  @IsString()
  @IsOptional()
  prdpExpiry?: string;

  @IsString()
  @IsOptional()
  medicalCertificateExpiry?: string;

  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsOptional()
  bankAccountNumber?: string;

  @IsString()
  @IsOptional()
  bankBranchCode?: string;

  @IsString()
  @IsOptional()
  accountHolderName?: string;

  @IsString()
  @IsOptional()
  salary?: number;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  emergencyContactName?: string;

  @IsString()
  @IsOptional()
  emergencyContactPhone?: string;
}

@Controller('tenant/drivers')
@ApiTags('driver-profile')
@UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
export class DriverProfileController {
  constructor(private readonly driverProfileService: DriverProfileService) {}

  @Get('profile')
  @Roles('TENANT_USER')
  getMyProfile(@Req() req: { user: { sub: string } }) {
    return this.driverProfileService.getProfile(req.user.sub);
  }

  @Get(':id/profile')
  @Roles('TENANT_ADMIN')
  getDriverProfile(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.driverProfileService.getProfile(id);
  }

  @Get('profile/expiry-status')
  @Roles('TENANT_USER')
  getMyExpiryStatus(@Req() req: { user: { sub: string } }) {
    return this.driverProfileService.getExpiryStatus(req.user.sub);
  }

  @Post('profile/expiry-update-requests')
  @Roles('TENANT_USER')
  createMyExpiryUpdateRequest(
    @Req() req: { user: { sub: string } },
    @Body() body: { requestedLicenseExpiry?: string; requestedPrdpExpiry?: string; requestedMedicalCertificateExpiry?: string; supportingDocumentIds?: string[] },
  ) {
    return this.driverProfileService.createExpiryUpdateRequest(req.user.sub, body);
  }

  @Get('profile/expiry-update-requests')
  @Roles('TENANT_USER')
  listMyExpiryUpdateRequests(@Req() req: { user: { sub: string } }) {
    return this.driverProfileService.listExpiryUpdateRequestsForDriver(req.user.sub);
  }

  @Put('profile')
  @Roles('TENANT_USER')
  updateMyProfile(
    @Req() req: { user: { sub: string } },
    @Body() dto: UpdateDriverProfileDto,
  ) {
    const data: any = { ...dto };
    if (dto.dateOfBirth) data.dateOfBirth = new Date(dto.dateOfBirth);
    if (dto.licenseExpiry) data.licenseExpiry = new Date(dto.licenseExpiry);
    if (dto.prdpExpiry) data.prdpExpiry = new Date(dto.prdpExpiry);
    if (dto.medicalCertificateExpiry) data.medicalCertificateExpiry = new Date(dto.medicalCertificateExpiry);
    if (dto.salary) data.salary = parseFloat(dto.salary as any);
    return this.driverProfileService.updateProfile(req.user.sub, data, req.user.sub, false);
  }

  @Get('expiry-summary')
  @Roles('TENANT_ADMIN')
  getExpirySummary() {
    return this.driverProfileService.getExpirySummaryForTenant();
  }

  @Get('expiry-update-requests')
  @Roles('TENANT_ADMIN')
  listExpiryUpdateRequests(@Query('status') status?: 'pending' | 'approved' | 'rejected') {
    return this.driverProfileService.listExpiryUpdateRequestsAdmin(status);
  }

  @Get('expiry-update-requests/:requestId')
  @Roles('TENANT_ADMIN')
  async getExpiryUpdateRequest(
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
    @Req() req: { user: { sub: string } },
  ) {
    const req_ = await this.driverProfileService.getExpiryUpdateRequestById(requestId, req.user.sub, true);
    if (!req_) throw new NotFoundException('Expiry update request not found');
    return req_;
  }

  @Patch('expiry-update-requests/:requestId/approve')
  @Roles('TENANT_ADMIN')
  approveExpiryUpdateRequest(
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.driverProfileService.approveExpiryUpdateRequest(requestId, req.user.sub);
  }

  @Patch('expiry-update-requests/:requestId/reject')
  @Roles('TENANT_ADMIN')
  rejectExpiryUpdateRequest(
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
    @Req() req: { user: { sub: string } },
    @Body() body: { reason?: string },
  ) {
    return this.driverProfileService.rejectExpiryUpdateRequest(requestId, req.user.sub, body.reason);
  }

  @Put(':id/profile')
  @Roles('TENANT_ADMIN')
  updateDriverProfile(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDriverProfileDto,
    @Req() req: { user: { sub: string } },
  ) {
    const data: any = { ...dto };
    if (dto.dateOfBirth) data.dateOfBirth = new Date(dto.dateOfBirth);
    if (dto.licenseExpiry) data.licenseExpiry = new Date(dto.licenseExpiry);
    if (dto.prdpExpiry) data.prdpExpiry = new Date(dto.prdpExpiry);
    if (dto.medicalCertificateExpiry) data.medicalCertificateExpiry = new Date(dto.medicalCertificateExpiry);
    if (dto.salary) data.salary = parseFloat(dto.salary as any);
    return this.driverProfileService.updateProfile(id, data, req.user.sub, true);
  }

  @Post('documents')
  @Roles('TENANT_USER')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        documentType: { type: 'string', enum: Object.values(DocumentType) },
        notes: { type: 'string' },
      },
    },
  })
  uploadDocument(
    @UploadedFile() file: { originalname: string; buffer: Buffer; size: number; mimetype: string } | undefined,
    @Body('documentType', new ParseEnumPipe(DocumentType)) documentType: DocumentType,
    @Body('notes') notes: string | undefined,
    @Req() req: { user: { sub: string } },
  ) {
    if (!file) {
      throw new Error('File is required');
    }
    return this.driverProfileService.uploadDocument(
      req.user.sub,
      file,
      documentType,
      notes,
      req.user.sub,
    );
  }

  @Post(':id/documents')
  @Roles('TENANT_ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        documentType: { type: 'string', enum: Object.values(DocumentType) },
        notes: { type: 'string' },
      },
    },
  })
  uploadDriverDocument(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: { originalname: string; buffer: Buffer; size: number; mimetype: string } | undefined,
    @Body('documentType', new ParseEnumPipe(DocumentType)) documentType: DocumentType,
    @Body('notes') notes: string | undefined,
    @Req() req: { user: { sub: string } },
  ) {
    if (!file) {
      throw new Error('File is required');
    }
    return this.driverProfileService.uploadDocument(
      id,
      file,
      documentType,
      notes,
      req.user.sub,
    );
  }

  @Get('documents')
  @Roles('TENANT_USER')
  getMyDocuments(@Req() req: { user: { sub: string } }) {
    return this.driverProfileService.getDocuments(req.user.sub);
  }

  @Get(':id/documents')
  @Roles('TENANT_ADMIN')
  getDriverDocuments(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.driverProfileService.getDocuments(id);
  }

  @Get('documents/:documentId/download')
  @Roles('TENANT_USER')
  async downloadMyDocument(
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Req() req: { user: { sub: string } },
    @Res() res: Response,
  ) {
    const { filePath, fileName, mimeType } = await this.driverProfileService.getDocumentFile(
      documentId,
      req.user.sub,
    );
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.sendFile(filePath);
  }

  @Get(':id/documents/:documentId/download')
  @Roles('TENANT_ADMIN')
  async downloadDriverDocument(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Res() res: Response,
  ) {
    const { filePath, fileName, mimeType } = await this.driverProfileService.getDocumentFile(
      documentId,
      id,
    );
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.sendFile(filePath);
  }

  @Delete('documents/:documentId')
  @Roles('TENANT_USER')
  deleteMyDocument(
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Req() req: { user: { sub: string; role?: string } },
  ) {
    return this.driverProfileService.deleteDocument(documentId, req.user.sub, req.user.role);
  }

  @Delete(':id/documents/:documentId')
  @Roles('TENANT_ADMIN')
  deleteDriverDocument(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Req() req: { user: { role?: string } },
  ) {
    return this.driverProfileService.deleteDocument(documentId, id, req.user.role);
  }

  @Post('profile/picture')
  @Roles('TENANT_USER')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  uploadMyProfilePicture(
    @UploadedFile() file: { originalname: string; buffer: Buffer; size: number; mimetype?: string } | undefined,
    @Req() req: { user: { sub: string } },
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.driverProfileService.uploadProfilePicture(req.user.sub, file, req.user.sub);
  }

  @Post(':id/profile/picture')
  @Roles('TENANT_ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  uploadDriverProfilePicture(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: { originalname: string; buffer: Buffer; size: number; mimetype?: string } | undefined,
    @Req() req: { user: { sub: string } },
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.driverProfileService.uploadProfilePicture(id, file, req.user.sub);
  }

  @Get('profile/picture')
  @Roles('TENANT_USER')
  async getMyProfilePicture(
    @Req() req: { user: { sub: string } },
    @Res() res: Response,
  ) {
    const result = await this.driverProfileService.getProfilePicture(req.user.sub);
    if (!result) {
      return res.status(404).json({ message: 'Profile picture not found' });
    }
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    if ('buffer' in result) {
      return res.send(result.buffer);
    }
    if (!fs.existsSync(result.filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }
    return res.sendFile(result.filePath);
  }

  @Get(':id/profile/picture')
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  async getDriverProfilePicture(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ) {
    const result = await this.driverProfileService.getProfilePicture(id);
    if (!result) {
      return res.status(404).json({ message: 'Profile picture not found' });
    }
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    if ('buffer' in result) {
      return res.send(result.buffer);
    }
    if (!fs.existsSync(result.filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }
    return res.sendFile(result.filePath);
  }

  @Delete('profile/picture')
  @Roles('TENANT_USER')
  deleteMyProfilePicture(
    @Req() req: { user: { sub: string; role?: string } },
  ) {
    return this.driverProfileService.deleteProfilePicture(req.user.sub, req.user.sub, req.user.role);
  }

  @Delete(':id/profile/picture')
  @Roles('TENANT_ADMIN')
  deleteDriverProfilePicture(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { user: { sub: string; role?: string } },
  ) {
    return this.driverProfileService.deleteProfilePicture(id, req.user.sub, req.user.role);
  }
}

