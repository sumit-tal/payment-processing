import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as AuthorizeNet from 'authorizenet';
import { PaymentMethod } from '@/database/entities/payment-method.entity';
import {
  CreatePaymentMethodDto,
  UpdatePaymentMethodDto,
  PaymentMethodResponseDto,
} from '../dto/payment-method.dto';

@Injectable()
export class PaymentMethodService {
  private readonly logger = new Logger(PaymentMethodService.name);
  private readonly apiContracts: typeof AuthorizeNet.APIContracts;
  private readonly apiControllers: typeof AuthorizeNet.APIControllers;
  private readonly config: {
    apiLoginId: string;
    transactionKey: string;
    environment: 'sandbox' | 'production';
  };

  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    private readonly configService: ConfigService,
  ) {
    this.apiContracts = AuthorizeNet.APIContracts;
    this.apiControllers = AuthorizeNet.APIControllers;

    this.config = {
      apiLoginId: this.configService.get<string>('AUTHORIZENET_API_LOGIN_ID'),
      transactionKey: this.configService.get<string>(
        'AUTHORIZENET_TRANSACTION_KEY',
      ),
      environment: this.configService.get<string>(
        'AUTHORIZENET_ENVIRONMENT',
      ) as 'sandbox' | 'production',
    };

    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.config.apiLoginId || !this.config.transactionKey) {
      throw new Error('Authorize.Net API credentials are required');
    }
  }

  private createMerchantAuth(): any {
    const merchantAuthenticationType =
      new this.apiContracts.MerchantAuthenticationType();
    merchantAuthenticationType.setName(this.config.apiLoginId);
    merchantAuthenticationType.setTransactionKey(this.config.transactionKey);
    return merchantAuthenticationType;
  }

  private detectCardBrand(cardNumber: string): string {
    // Basic card brand detection based on first digits
    if (!cardNumber) return 'Unknown';

    const firstDigit = cardNumber.charAt(0);
    const firstTwoDigits = parseInt(cardNumber.substring(0, 2), 10);
    const firstFourDigits = parseInt(cardNumber.substring(0, 4), 10);

    if (firstDigit === '4') return 'Visa';
    if (firstTwoDigits >= 51 && firstTwoDigits <= 55) return 'Mastercard';
    if (firstTwoDigits === 34 || firstTwoDigits === 37)
      return 'American Express';
    if (firstFourDigits === 6011) return 'Discover';

    return 'Unknown';
  }

  /**
   * Create customer profile in Authorize.Net
   */
  private async createCustomerProfile(customerId: string): Promise<string> {
    const merchantAuthenticationType = this.createMerchantAuth();

    const createRequest = new this.apiContracts.CreateCustomerProfileRequest();
    createRequest.setMerchantAuthentication(merchantAuthenticationType);

    // Create a customer profile with minimal information
    const profile = new this.apiContracts.CustomerProfileType();
    // Use a shortened version of the customerId to meet Authorize.Net's length requirements
    const shortId = customerId.replace(/-/g, '').substring(0, 20);
    profile.setMerchantCustomerId(shortId);
    profile.setDescription(`Customer profile for ${shortId}`);
    profile.setEmail(`customer-${shortId}@example.com`); // Optional, can be updated later

    createRequest.setProfile(profile);

    return new Promise((resolve, reject) => {
      const ctrl = new this.apiControllers.CreateCustomerProfileController(
        createRequest.getJSON(),
      );

      if (this.config.environment === 'sandbox') {
        ctrl.setEnvironment(AuthorizeNet.Constants.endpoint.sandbox);
      } else {
        ctrl.setEnvironment(AuthorizeNet.Constants.endpoint.production);
      }

      ctrl.execute(() => {
        const apiResponse = ctrl.getResponse();
        const response = new this.apiContracts.CreateCustomerProfileResponse(
          apiResponse,
        );

        if (
          response.getMessages().getResultCode() ===
          this.apiContracts.MessageTypeEnum.OK
        ) {
          resolve(response.getCustomerProfileId());
        } else {
          const errorMessage = response.getMessages().getMessage()[0].getText();
          reject(
            new BadRequestException(
              `Failed to create customer profile: ${errorMessage}`,
            ),
          );
        }
      });
    });
  }

  /**
   * Get customer profile from Authorize.Net
   */
  private async getCustomerProfile(customerId: string): Promise<string> {
    try {
      // First, check if we already have a payment method for this customer
      const existingMethod = await this.paymentMethodRepository.findOne({
        where: { customerId },
      });

      if (existingMethod) {
        // Extract customer profile ID from the gateway ID format
        const parts = existingMethod.gatewayPaymentMethodId.split('|');
        if (parts.length >= 1) {
          return parts[0];
        }
      }

      // If no existing method or couldn't extract profile ID, create a new profile
      return await this.createCustomerProfile(customerId);
    } catch (error) {
      this.logger.error(`Error getting customer profile: ${error.message}`);
      return await this.createCustomerProfile(customerId);
    }
  }

  /**
   * Create payment method in Authorize.Net and save to database
   */
  async createPaymentMethod(
    createDto: CreatePaymentMethodDto,
  ): Promise<PaymentMethodResponseDto> {
    this.logger.log(
      `Creating payment method for customer: ${createDto.customerId}`,
    );

    try {
      // Get or create customer profile in Authorize.Net
      const customerProfileId = await this.getCustomerProfile(
        createDto.customerId,
      );

      // Create payment profile
      const gatewayPaymentMethodId = await this.createCustomerPaymentProfile(
        customerProfileId,
        createDto,
      );

      // If this is the default payment method, update all other methods
      if (createDto.isDefault) {
        await this.paymentMethodRepository.update(
          { customerId: createDto.customerId, isDefault: true },
          { isDefault: false },
        );
      }

      // Create payment method entity
      const paymentMethod = new PaymentMethod({
        customerId: createDto.customerId,
        gatewayPaymentMethodId,
        cardLastFour: createDto.cardNumber.slice(-4),
        cardBrand: this.detectCardBrand(createDto.cardNumber),
        cardExpiryMonth: createDto.expiryMonth,
        cardExpiryYear: createDto.expiryYear,
        billingAddress: createDto.billingAddress,
        isDefault: createDto.isDefault || false,
        isActive: true,
      });

      const savedPaymentMethod =
        await this.paymentMethodRepository.save(paymentMethod);

      return this.mapToResponseDto(savedPaymentMethod);
    } catch (error) {
      this.logger.error(
        `Failed to create payment method: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Create customer payment profile in Authorize.Net
   */
  private async createCustomerPaymentProfile(
    customerProfileId: string,
    paymentData: CreatePaymentMethodDto,
  ): Promise<string> {
    const merchantAuthenticationType = this.createMerchantAuth();

    // Format expiration date as YYYY-MM
    const expirationDate = `${paymentData.expiryYear}-${paymentData.expiryMonth.toString().padStart(2, '0')}`;

    // Create credit card
    const creditCard = new this.apiContracts.CreditCardType();
    creditCard.setCardNumber(paymentData.cardNumber);
    creditCard.setExpirationDate(expirationDate);

    // Don't include CVV for customer profile creation (PCI compliance)
    // creditCard.setCardCode(paymentData.cardCode);

    // Create payment
    const payment = new this.apiContracts.PaymentType();
    payment.setCreditCard(creditCard);

    // Create billing address if provided
    let billTo;
    if (paymentData.billingAddress) {
      billTo = new this.apiContracts.CustomerAddressType();

      // Split cardholder name for first/last name if not provided
      const nameParts = paymentData.cardholderName.split(' ');
      const firstName =
        paymentData.billingAddress.firstName || nameParts[0] || '';
      const lastName =
        paymentData.billingAddress.lastName ||
        (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');

      billTo.setFirstName(firstName);
      billTo.setLastName(lastName);

      if (paymentData.billingAddress.company) {
        billTo.setCompany(paymentData.billingAddress.company);
      }
      if (paymentData.billingAddress.address) {
        billTo.setAddress(paymentData.billingAddress.address);
      }
      if (paymentData.billingAddress.city) {
        billTo.setCity(paymentData.billingAddress.city);
      }
      if (paymentData.billingAddress.state) {
        billTo.setState(paymentData.billingAddress.state);
      }
      if (paymentData.billingAddress.zip) {
        billTo.setZip(paymentData.billingAddress.zip);
      }
      if (paymentData.billingAddress.country) {
        billTo.setCountry(paymentData.billingAddress.country);
      }
    }

    // Create payment profile
    const paymentProfile = new this.apiContracts.CustomerPaymentProfileType();
    paymentProfile.setPayment(payment);

    if (billTo) {
      paymentProfile.setBillTo(billTo);
    }

    // Create request
    const createRequest =
      new this.apiContracts.CreateCustomerPaymentProfileRequest();
    createRequest.setMerchantAuthentication(merchantAuthenticationType);
    createRequest.setCustomerProfileId(customerProfileId);
    createRequest.setPaymentProfile(paymentProfile);
    createRequest.setValidationMode(
      this.apiContracts.ValidationModeEnum.LIVEMODE,
    );

    return new Promise((resolve, reject) => {
      const ctrl =
        new this.apiControllers.CreateCustomerPaymentProfileController(
          createRequest.getJSON(),
        );

      if (this.config.environment === 'sandbox') {
        ctrl.setEnvironment(AuthorizeNet.Constants.endpoint.sandbox);
      } else {
        ctrl.setEnvironment(AuthorizeNet.Constants.endpoint.production);
      }

      ctrl.execute(() => {
        const apiResponse = ctrl.getResponse();
        const response =
          new this.apiContracts.CreateCustomerPaymentProfileResponse(
            apiResponse,
          );

        if (
          response.getMessages().getResultCode() ===
          this.apiContracts.MessageTypeEnum.OK
        ) {
          // Format: customerProfileId|customerPaymentProfileId
          const paymentProfileId = `${customerProfileId}|${response.getCustomerPaymentProfileId()}`;
          resolve(paymentProfileId);
        } else {
          const errorMessage = response.getMessages().getMessage()[0].getText();
          reject(
            new BadRequestException(
              `Failed to create payment method: ${errorMessage}`,
            ),
          );
        }
      });
    });
  }

  /**
   * Get payment method by ID
   */
  async getPaymentMethodById(id: string): Promise<PaymentMethodResponseDto> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id },
    });

    if (!paymentMethod) {
      throw new NotFoundException(`Payment method with ID ${id} not found`);
    }

    return this.mapToResponseDto(paymentMethod);
  }

  /**
   * Get payment methods by customer ID
   */
  async getPaymentMethodsByCustomer(
    customerId: string,
  ): Promise<PaymentMethodResponseDto[]> {
    const paymentMethods = await this.paymentMethodRepository.find({
      where: { customerId, isActive: true },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });

    return paymentMethods.map(method => this.mapToResponseDto(method));
  }

  /**
   * Update payment method (currently only supports updating default status)
   */
  async updatePaymentMethod(
    id: string,
    updateDto: UpdatePaymentMethodDto,
  ): Promise<PaymentMethodResponseDto> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id },
    });

    if (!paymentMethod) {
      throw new NotFoundException(`Payment method with ID ${id} not found`);
    }

    // If setting as default, update all other payment methods for this customer
    if (updateDto.isDefault && !paymentMethod.isDefault) {
      await this.paymentMethodRepository.update(
        { customerId: paymentMethod.customerId, isDefault: true },
        { isDefault: false },
      );
    }

    paymentMethod.isDefault = updateDto.isDefault;

    const updatedPaymentMethod =
      await this.paymentMethodRepository.save(paymentMethod);
    return this.mapToResponseDto(updatedPaymentMethod);
  }

  /**
   * Delete payment method (soft delete by setting isActive to false)
   */
  async deletePaymentMethod(id: string): Promise<void> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id },
    });

    if (!paymentMethod) {
      throw new NotFoundException(`Payment method with ID ${id} not found`);
    }

    if (paymentMethod.isDefault) {
      throw new BadRequestException(
        'Cannot delete default payment method. Set another payment method as default first.',
      );
    }

    paymentMethod.isActive = false;
    await this.paymentMethodRepository.save(paymentMethod);
  }

  /**
   * Map entity to response DTO
   */
  private mapToResponseDto(entity: PaymentMethod): PaymentMethodResponseDto {
    return {
      id: entity.id,
      customerId: entity.customerId,
      cardLastFour: entity.cardLastFour,
      cardBrand: entity.cardBrand,
      cardExpiryMonth: entity.cardExpiryMonth,
      cardExpiryYear: entity.cardExpiryYear,
      billingAddress: entity.billingAddress,
      isDefault: entity.isDefault,
      isActive: entity.isActive,
      createdAt: entity.createdAt,
    };
  }
}
