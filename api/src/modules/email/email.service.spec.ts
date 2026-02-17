import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

describe('EmailService', () => {
  describe('when email is not configured', () => {
    let service: EmailService;
    let sendSpy: jest.SpyInstance;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          {
            provide: ConfigService,
useValue: {
                get: jest.fn((key: string) => {
                if (key === 'email.user' || key === 'email.password') return undefined;
                if (key === 'email.mailgunApiKey' || key === 'email.mailgunDomain') return undefined;
                if (key === 'email.from') return 'noreply@test.com';
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      service = module.get<EmailService>(EmailService);
    });

    it('sendMonthlyReport returns { sent: false } without throwing', async () => {
      const result = await service.sendMonthlyReport('a@b.com', 'Tenant', {
        period: { startDate: new Date(), endDate: new Date() },
        summary: {
          totalIncome: 0,
          totalExpenses: 0,
          totalPetrolCost: 0,
          netIncome: 0,
          trips: 0,
        },
        topVehicles: [],
        topDrivers: [],
        fuelEfficiency: [],
      });
      expect(result.sent).toBe(false);
    });

    it('sendEmailOtp returns { sent: false } when not configured', async () => {
      const result = await service.sendEmailOtp('a@b.com', '123456', 'Tenant');
      expect(result.sent).toBe(false);
    });
  });
});
