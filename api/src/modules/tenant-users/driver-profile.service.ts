import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { TenantAwareRepository } from '../../tenancy/tenant-aware.repository';
import { TenantUser } from './tenant-user.entity';
import { DriverDocument, DocumentType } from './driver-document.entity';
import { DriverExpiryUpdateRequest, ExpiryUpdateRequestStatus } from './driver-expiry-update-request.entity';
import { TenantScopeService } from '../../tenancy/tenant-scope.service';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

const DATA_URL_PREFIX = 'data:';
const DATA_URL_BASE64 = ';base64,';

@Injectable()
export class DriverProfileService {
  private readonly uploadsDir = path.join(process.cwd(), 'uploads', 'driver-documents');

  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScopeService,
  ) {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async getProfile(userId: string): Promise<TenantUser> {
    const userRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantUser,
    );
    return userRepo.withSchema(async repo => {
      const user = await repo.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('Driver not found');
      }
      return user;
    });
  }

  async updateProfile(
    userId: string,
    data: Partial<TenantUser>,
    actorId?: string,
    allowExpiryUpdate = false,
  ): Promise<TenantUser> {
    const userRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantUser,
    );
    const payload = { ...data };
    if (!allowExpiryUpdate) {
      delete (payload as Partial<TenantUser>).licenseExpiry;
      delete (payload as Partial<TenantUser>).prdpExpiry;
      delete (payload as Partial<TenantUser>).medicalCertificateExpiry;
    }
    return userRepo.withSchema(async repo => {
      const user = await repo.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('Driver not found');
      }
      Object.assign(user, payload);
      return repo.save(user);
    });
  }

  async uploadDocument(
    userId: string,
    file: { originalname: string; buffer: Buffer; size: number; mimetype: string },
    documentType: DocumentType,
    notes?: string,
    uploadedBy?: string,
  ): Promise<DriverDocument> {
    const userRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantUser,
    );
    const docRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      DriverDocument,
    );

    // Verify user exists
    await userRepo.withSchema(async repo => {
      const user = await repo.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('Driver not found');
      }
    });

    // Generate unique filename
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const fileName = `${userId}_${documentType}_${timestamp}${ext}`;

    // Ensure tenant-specific directory exists
    const tenantSchema = this.tenantScope.getTenantSchema();
    const tenantDir = path.join(this.uploadsDir, tenantSchema);
    if (!fs.existsSync(tenantDir)) {
      await mkdir(tenantDir, { recursive: true });
    }
    const tenantFilePath = path.join(tenantDir, fileName);

    // Save file
    await writeFile(tenantFilePath, file.buffer);

    // Save document record
    return docRepo.withSchema(async repo => {
      const document = repo.create({
        userId,
        documentType,
        fileName: file.originalname,
        filePath: tenantFilePath,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedBy: uploadedBy ?? null,
        notes: notes ?? null,
      });
      return repo.save(document);
    });
  }

  async getDocuments(userId: string): Promise<DriverDocument[]> {
    const docRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      DriverDocument,
    );
    return docRepo.withSchema(async repo => {
      return repo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
    });
  }

  async getDocumentFile(documentId: string, userId: string): Promise<{ filePath: string; fileName: string; mimeType: string }> {
    const docRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      DriverDocument,
    );
    const document = await docRepo.withSchema(async repo => {
      return repo.findOne({ where: { id: documentId, userId } });
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    return {
      filePath: document.filePath,
      fileName: document.fileName,
      mimeType: document.mimeType,
    };
  }

  async deleteDocument(documentId: string, userId: string, actorRole?: string): Promise<void> {
    const docRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      DriverDocument,
    );
    const document = await docRepo.withSchema(async repo => {
      return repo.findOne({ where: { id: documentId, userId } });
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Only admins or the document owner can delete
    if (actorRole !== 'TENANT_ADMIN' && document.userId !== userId) {
      throw new UnauthorizedException('Not authorized to delete this document');
    }

    // Delete file
    if (fs.existsSync(document.filePath)) {
      await unlink(document.filePath);
    }

    // Delete record
    await docRepo.withSchema(async repo => {
      await repo.remove(document);
    });
  }

  async uploadProfilePicture(
    userId: string,
    file: { originalname: string; buffer: Buffer; size: number; mimetype?: string },
    actorId?: string,
  ): Promise<TenantUser> {
    const userRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantUser,
    );

    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException('File is required and must not be empty');
    }

    const user = await userRepo.withSchema(async repo => {
      return repo.findOne({ where: { id: userId } });
    });

    if (!user) {
      throw new NotFoundException('Driver not found');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const ext = (path.extname(file.originalname || '') || '.jpg').toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const mimeOk = file.mimetype ? allowedMimeTypes.includes(file.mimetype) : allowedExtensions.includes(ext);
    if (!mimeOk) {
      throw new BadRequestException('Only image files are allowed (JPEG, PNG, GIF, WebP)');
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size must be less than 5MB');
    }

    const mimeType = file.mimetype || (allowedExtensions.includes(ext) ? (ext === '.jpg' ? 'image/jpeg' : `image/${ext.slice(1)}`) : 'image/jpeg');
    const base64 = file.buffer.toString('base64');
    user.profilePicture = `${DATA_URL_PREFIX}${mimeType}${DATA_URL_BASE64}${base64}`;
    return userRepo.withSchema(async repo => {
      return repo.save(user);
    });
  }

  async deleteProfilePicture(userId: string, actorId?: string, actorRole?: string): Promise<TenantUser> {
    const userRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantUser,
    );

    const user = await userRepo.withSchema(async repo => {
      return repo.findOne({ where: { id: userId } });
    });

    if (!user) {
      throw new NotFoundException('Driver not found');
    }

    // Only admins or the user themselves can delete
    if (actorRole !== 'TENANT_ADMIN' && actorId !== userId) {
      throw new UnauthorizedException('Not authorized to delete this profile picture');
    }

    user.profilePicture = null;
    return userRepo.withSchema(async repo => {
      return repo.save(user);
    });
  }

  async getProfilePicture(
    userId: string,
  ): Promise<{ buffer: Buffer; mimeType: string } | { filePath: string; mimeType: string } | null> {
    const userRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantUser,
    );

    const user = await userRepo.withSchema(async repo => {
      return repo.findOne({ where: { id: userId } });
    });

    if (!user || !user.profilePicture) {
      return null;
    }

    const raw = user.profilePicture;
    if (raw.startsWith(DATA_URL_PREFIX) && raw.includes(DATA_URL_BASE64)) {
      const base64Index = raw.indexOf(DATA_URL_BASE64);
      const mimeType = raw.slice(DATA_URL_PREFIX.length, base64Index).split(';')[0].trim() || 'image/jpeg';
      const base64 = raw.slice(base64Index + DATA_URL_BASE64.length);
      const buffer = Buffer.from(base64, 'base64');
      return { buffer, mimeType };
    }

    // Legacy: stored as filename on disk
    const legacyDir = path.join(process.cwd(), 'uploads', 'profile-pictures');
    const filePath = path.join(legacyDir, raw);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(raw).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
      };
      return { filePath, mimeType: mimeTypes[ext] || 'image/jpeg' };
    }
    return null;
  }

  private static isExpiringOrExpired(date: Date | null): boolean {
    if (!date) return false;
    const now = new Date();
    const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    return date <= in60Days;
  }

  async getExpiryStatus(userId: string): Promise<{
    expiringCount: number;
    hasPendingRequest: boolean;
    showExpiryBadge: boolean;
  }> {
    const userRepo = new TenantAwareRepository(this.dataSource, this.tenantScope, TenantUser);
    const requestRepo = new TenantAwareRepository(this.dataSource, this.tenantScope, DriverExpiryUpdateRequest);

    const profile = await userRepo.withSchema(async repo => repo.findOne({ where: { id: userId } }));
    if (!profile) {
      return { expiringCount: 0, hasPendingRequest: false, showExpiryBadge: false };
    }

    let expiringCount = 0;
    if (DriverProfileService.isExpiringOrExpired(profile.licenseExpiry)) expiringCount++;
    if (DriverProfileService.isExpiringOrExpired(profile.prdpExpiry)) expiringCount++;
    if (DriverProfileService.isExpiringOrExpired(profile.medicalCertificateExpiry)) expiringCount++;

    const requests = await requestRepo.withSchema(async repo =>
      repo.find({ where: { userId }, order: { submittedAt: 'DESC' } }),
    );
    const hasPendingRequest = requests.some(r => r.status === 'pending');
    const hasApprovedRequest = requests.some(r => r.status === 'approved');

    const showExpiryBadge = expiringCount > 0 && !hasApprovedRequest;

    return { expiringCount, hasPendingRequest, showExpiryBadge };
  }

  /** Count of drivers in the tenant with at least one document (licence, PRDP, medical) expiring within 60 days. */
  async getExpirySummaryForTenant(): Promise<{ driversExpiringSoon: number }> {
    const userRepo = new TenantAwareRepository(this.dataSource, this.tenantScope, TenantUser);
    const drivers = await userRepo.withSchema(repo =>
      repo.find({ select: ['id', 'licenseExpiry', 'prdpExpiry', 'medicalCertificateExpiry'] }),
    );
    let count = 0;
    for (const d of drivers) {
      if (
        DriverProfileService.isExpiringOrExpired(d.licenseExpiry) ||
        DriverProfileService.isExpiringOrExpired(d.prdpExpiry) ||
        DriverProfileService.isExpiringOrExpired(d.medicalCertificateExpiry)
      ) {
        count++;
      }
    }
    return { driversExpiringSoon: count };
  }

  async createExpiryUpdateRequest(
    userId: string,
    payload: {
      requestedLicenseExpiry?: string;
      requestedPrdpExpiry?: string;
      requestedMedicalCertificateExpiry?: string;
      supportingDocumentIds?: string[];
    },
  ): Promise<DriverExpiryUpdateRequest> {
    const hasLicense = payload.requestedLicenseExpiry != null && payload.requestedLicenseExpiry !== '';
    const hasPrdp = payload.requestedPrdpExpiry != null && payload.requestedPrdpExpiry !== '';
    const hasMedical = payload.requestedMedicalCertificateExpiry != null && payload.requestedMedicalCertificateExpiry !== '';
    if (!hasLicense && !hasPrdp && !hasMedical) {
      throw new BadRequestException('At least one expiry date (licence, PRDP, or medical) is required');
    }

    const docRepo = new TenantAwareRepository(this.dataSource, this.tenantScope, DriverDocument);
    const ids = payload.supportingDocumentIds ?? [];
    if (ids.length > 0) {
      const docs = await docRepo.withSchema(async repo =>
        repo.find({ where: { userId, id: In(ids) } }),
      );
      if (docs.length !== ids.length) {
        throw new BadRequestException('All supporting document IDs must belong to you');
      }
    }

    const requestRepo = new TenantAwareRepository(this.dataSource, this.tenantScope, DriverExpiryUpdateRequest);
    const existingPending = await requestRepo.withSchema(async repo =>
      repo.findOne({ where: { userId, status: 'pending' } }),
    );
    if (existingPending) {
      throw new BadRequestException('You already have a pending expiry update request');
    }

    return requestRepo.withSchema(async repo => {
      const req = repo.create({
        userId,
        status: 'pending',
        requestedLicenseExpiry: hasLicense ? new Date(payload.requestedLicenseExpiry!) : null,
        requestedPrdpExpiry: hasPrdp ? new Date(payload.requestedPrdpExpiry!) : null,
        requestedMedicalCertificateExpiry: hasMedical ? new Date(payload.requestedMedicalCertificateExpiry!) : null,
        supportingDocumentIds: ids.length > 0 ? ids : null,
      });
      return repo.save(req);
    });
  }

  async listExpiryUpdateRequestsForDriver(userId: string): Promise<DriverExpiryUpdateRequest[]> {
    const requestRepo = new TenantAwareRepository(this.dataSource, this.tenantScope, DriverExpiryUpdateRequest);
    return requestRepo.withSchema(async repo =>
      repo.find({ where: { userId }, order: { submittedAt: 'DESC' } }),
    );
  }

  async listExpiryUpdateRequestsAdmin(status?: ExpiryUpdateRequestStatus): Promise<(DriverExpiryUpdateRequest & { driverName?: string })[]> {
    const requestRepo = new TenantAwareRepository(this.dataSource, this.tenantScope, DriverExpiryUpdateRequest);
    const userRepo = new TenantAwareRepository(this.dataSource, this.tenantScope, TenantUser);
    const list = await requestRepo.withSchema(async repo => {
      const where: any = status ? { status } : {};
      return repo.find({ where, order: { submittedAt: 'DESC' } });
    });
    const withNames = await Promise.all(list.map(async (req) => {
      const user = await userRepo.withSchema(async repo => repo.findOne({ where: { id: req.userId } }));
      return { ...req, driverName: user ? `${user.firstName} ${user.lastName}`.trim() : req.userId };
    }));
    return withNames;
  }

  async getExpiryUpdateRequestById(requestId: string, adminOrUserId: string, isAdmin: boolean): Promise<DriverExpiryUpdateRequest | null> {
    const requestRepo = new TenantAwareRepository(this.dataSource, this.tenantScope, DriverExpiryUpdateRequest);
    const req = await requestRepo.withSchema(async repo => repo.findOne({ where: { id: requestId } }));
    if (!req) return null;
    if (!isAdmin && req.userId !== adminOrUserId) return null;
    return req;
  }

  async approveExpiryUpdateRequest(requestId: string, adminId: string): Promise<DriverExpiryUpdateRequest> {
    const requestRepo = new TenantAwareRepository(this.dataSource, this.tenantScope, DriverExpiryUpdateRequest);
    const req = await requestRepo.withSchema(async repo => repo.findOne({ where: { id: requestId } }));
    if (!req) throw new NotFoundException('Expiry update request not found');
    if (req.status !== 'pending') {
      throw new BadRequestException('Request is not pending');
    }
    await this.updateProfile(
      req.userId,
      {
        licenseExpiry: req.requestedLicenseExpiry ?? undefined,
        prdpExpiry: req.requestedPrdpExpiry ?? undefined,
        medicalCertificateExpiry: req.requestedMedicalCertificateExpiry ?? undefined,
      },
      adminId,
      true,
    );
    req.status = 'approved';
    req.reviewedAt = new Date();
    req.reviewedBy = adminId;
    return requestRepo.withSchema(async repo => repo.save(req));
  }

  async rejectExpiryUpdateRequest(requestId: string, adminId: string, reason?: string): Promise<DriverExpiryUpdateRequest> {
    const requestRepo = new TenantAwareRepository(this.dataSource, this.tenantScope, DriverExpiryUpdateRequest);
    const req = await requestRepo.withSchema(async repo => repo.findOne({ where: { id: requestId } }));
    if (!req) throw new NotFoundException('Expiry update request not found');
    if (req.status !== 'pending') throw new BadRequestException('Request is not pending');
    req.status = 'rejected';
    req.reviewedAt = new Date();
    req.reviewedBy = adminId;
    req.rejectionReason = reason ?? null;
    return requestRepo.withSchema(async repo => repo.save(req));
  }
}

