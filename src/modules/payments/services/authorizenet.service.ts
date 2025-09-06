import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AuthorizeNet from 'authorizenet';
import { CreatePaymentDto, CapturePaymentDto, RefundPaymentDto, CancelPaymentDto } from '../dto';
import { TransactionType } from '../entities';

export interface AuthorizeNetConfig {
  apiLoginId: string;
  transactionKey: string;
  environment: 'sandbox' | 'production';
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  authCode?: string;
  responseCode?: string;
  responseText?: string;
  avsResult?: string;
  cvvResult?: string;
  rawResponse?: any;
  errorMessage?: string;
}

@Injectable()
export class AuthorizeNetService {
  private readonly logger = new Logger(AuthorizeNetService.name);
  private readonly apiContracts: typeof AuthorizeNet.APIContracts;
  private readonly apiControllers: typeof AuthorizeNet.APIControllers;
  private readonly config: AuthorizeNetConfig;

  constructor(private readonly configService: ConfigService) {
    this.apiContracts = AuthorizeNet.APIContracts;
    this.apiControllers = AuthorizeNet.APIControllers;
    
    this.config = {
      apiLoginId: this.configService.get<string>('AUTHORIZENET_API_LOGIN_ID'),
      transactionKey: this.configService.get<string>('AUTHORIZENET_TRANSACTION_KEY'),
      environment: this.configService.get<string>('AUTHORIZENET_ENVIRONMENT') as 'sandbox' | 'production',
    };

    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.config.apiLoginId || !this.config.transactionKey) {
      throw new Error('Authorize.Net API credentials are required');
    }
  }

  private createMerchantAuth(): any {
    const merchantAuthenticationType = new this.apiContracts.MerchantAuthenticationType();
    merchantAuthenticationType.setName(this.config.apiLoginId);
    merchantAuthenticationType.setTransactionKey(this.config.transactionKey);
    return merchantAuthenticationType;
  }

  private createCreditCard(creditCardData: CreatePaymentDto['creditCard']): any {
    const creditCard = new this.apiContracts.CreditCardType();
    creditCard.setCardNumber(creditCardData.cardNumber);
    creditCard.setExpirationDate(
      `${creditCardData.expiryMonth.toString().padStart(2, '0')}${creditCardData.expiryYear}`
    );
    creditCard.setCardCode(creditCardData.cvv);
    return creditCard;
  }

  private createBillingAddress(billingData: CreatePaymentDto['creditCard']['billingAddress']): any {
    const billTo = new this.apiContracts.CustomerAddressType();
    billTo.setFirstName(billingData.firstName || '');
    billTo.setLastName(billingData.lastName || '');
    billTo.setCompany(billingData.company || '');
    billTo.setAddress(billingData.address);
    billTo.setCity(billingData.city);
    billTo.setState(billingData.state);
    billTo.setZip(billingData.zip);
    billTo.setCountry(billingData.country);
    return billTo;
  }

  private executeTransaction(request: any): Promise<PaymentResult> {
    return new Promise((resolve) => {
      const ctrl = new this.apiControllers.CreateTransactionController(request.getJSON());
      
      if (this.config.environment === 'sandbox') {
        ctrl.setEnvironment(AuthorizeNet.Constants.endpoint.sandbox);
      } else {
        ctrl.setEnvironment(AuthorizeNet.Constants.endpoint.production);
      }

      ctrl.execute(() => {
        const apiResponse = ctrl.getResponse();
        const response = new this.apiContracts.CreateTransactionResponse(apiResponse);
        
        this.logger.debug('Authorize.Net Response', { response: apiResponse });

        if (response.getMessages().getResultCode() === this.apiContracts.MessageTypeEnum.OK) {
          const transactionResponse = response.getTransactionResponse();
          
          if (transactionResponse.getMessages() !== null) {
            resolve({
              success: true,
              transactionId: transactionResponse.getTransId(),
              authCode: transactionResponse.getAuthCode(),
              responseCode: transactionResponse.getResponseCode(),
              responseText: transactionResponse.getMessages().getMessage()[0].getDescription(),
              avsResult: transactionResponse.getAvsResultCode(),
              cvvResult: transactionResponse.getCvvResultCode(),
              rawResponse: apiResponse,
            });
          } else {
            const errorMessage = transactionResponse.getErrors() 
              ? transactionResponse.getErrors().getError()[0].getErrorText()
              : 'Transaction failed';
            
            resolve({
              success: false,
              errorMessage,
              responseCode: transactionResponse.getResponseCode(),
              rawResponse: apiResponse,
            });
          }
        } else {
          const errorMessage = response.getMessages().getMessage()[0].getText();
          resolve({
            success: false,
            errorMessage,
            rawResponse: apiResponse,
          });
        }
      });
    });
  }

  async createPurchaseTransaction(paymentData: CreatePaymentDto): Promise<PaymentResult> {
    try {
      const merchantAuthenticationType = this.createMerchantAuth();
      const creditCard = this.createCreditCard(paymentData.creditCard);
      const billTo = this.createBillingAddress(paymentData.creditCard.billingAddress);

      const paymentType = new this.apiContracts.PaymentType();
      paymentType.setCreditCard(creditCard);

      const orderDetails = new this.apiContracts.OrderType();
      orderDetails.setInvoiceNumber(paymentData.orderId || paymentData.idempotencyKey);
      orderDetails.setDescription(paymentData.description || 'Purchase Transaction');

      const transactionRequestType = new this.apiContracts.TransactionRequestType();
      transactionRequestType.setTransactionType(this.apiContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
      transactionRequestType.setAmount(paymentData.amount);
      transactionRequestType.setPayment(paymentType);
      transactionRequestType.setOrder(orderDetails);
      transactionRequestType.setBillTo(billTo);

      const createRequest = new this.apiContracts.CreateTransactionRequest();
      createRequest.setMerchantAuthentication(merchantAuthenticationType);
      createRequest.setTransactionRequest(transactionRequestType);

      return await this.executeTransaction(createRequest);
    } catch (error) {
      this.logger.error('Purchase transaction failed', error);
      throw new InternalServerErrorException('Payment processing failed');
    }
  }

  async createAuthorizationTransaction(paymentData: CreatePaymentDto): Promise<PaymentResult> {
    try {
      const merchantAuthenticationType = this.createMerchantAuth();
      const creditCard = this.createCreditCard(paymentData.creditCard);
      const billTo = this.createBillingAddress(paymentData.creditCard.billingAddress);

      const paymentType = new this.apiContracts.PaymentType();
      paymentType.setCreditCard(creditCard);

      const orderDetails = new this.apiContracts.OrderType();
      orderDetails.setInvoiceNumber(paymentData.orderId || paymentData.idempotencyKey);
      orderDetails.setDescription(paymentData.description || 'Authorization Transaction');

      const transactionRequestType = new this.apiContracts.TransactionRequestType();
      transactionRequestType.setTransactionType(this.apiContracts.TransactionTypeEnum.AUTHONLYTRANSACTION);
      transactionRequestType.setAmount(paymentData.amount);
      transactionRequestType.setPayment(paymentType);
      transactionRequestType.setOrder(orderDetails);
      transactionRequestType.setBillTo(billTo);

      const createRequest = new this.apiContracts.CreateTransactionRequest();
      createRequest.setMerchantAuthentication(merchantAuthenticationType);
      createRequest.setTransactionRequest(transactionRequestType);

      return await this.executeTransaction(createRequest);
    } catch (error) {
      this.logger.error('Authorization transaction failed', error);
      throw new InternalServerErrorException('Payment authorization failed');
    }
  }

  async captureTransaction(captureData: CapturePaymentDto, originalAmount: number): Promise<PaymentResult> {
    try {
      const merchantAuthenticationType = this.createMerchantAuth();
      const amount = captureData.amount || originalAmount;

      if (amount > originalAmount) {
        throw new BadRequestException('Capture amount cannot exceed authorized amount');
      }

      const transactionRequestType = new this.apiContracts.TransactionRequestType();
      transactionRequestType.setTransactionType(this.apiContracts.TransactionTypeEnum.PRIORAUTHCAPTURETRANSACTION);
      transactionRequestType.setAmount(amount);
      transactionRequestType.setRefTransId(captureData.transactionId);

      const createRequest = new this.apiContracts.CreateTransactionRequest();
      createRequest.setMerchantAuthentication(merchantAuthenticationType);
      createRequest.setTransactionRequest(transactionRequestType);

      return await this.executeTransaction(createRequest);
    } catch (error) {
      this.logger.error('Capture transaction failed', error);
      throw new InternalServerErrorException('Payment capture failed');
    }
  }

  async refundTransaction(refundData: RefundPaymentDto, originalAmount: number, lastFourDigits: string): Promise<PaymentResult> {
    try {
      const merchantAuthenticationType = this.createMerchantAuth();
      const amount = refundData.amount || originalAmount;

      if (amount > originalAmount) {
        throw new BadRequestException('Refund amount cannot exceed original transaction amount');
      }

      const creditCard = new this.apiContracts.CreditCardType();
      creditCard.setCardNumber(lastFourDigits);
      creditCard.setExpirationDate('XXXX');

      const paymentType = new this.apiContracts.PaymentType();
      paymentType.setCreditCard(creditCard);

      const transactionRequestType = new this.apiContracts.TransactionRequestType();
      transactionRequestType.setTransactionType(this.apiContracts.TransactionTypeEnum.REFUNDTRANSACTION);
      transactionRequestType.setAmount(amount);
      transactionRequestType.setPayment(paymentType);
      transactionRequestType.setRefTransId(refundData.transactionId);

      const createRequest = new this.apiContracts.CreateTransactionRequest();
      createRequest.setMerchantAuthentication(merchantAuthenticationType);
      createRequest.setTransactionRequest(transactionRequestType);

      return await this.executeTransaction(createRequest);
    } catch (error) {
      this.logger.error('Refund transaction failed', error);
      throw new InternalServerErrorException('Payment refund failed');
    }
  }

  async voidTransaction(cancelData: CancelPaymentDto): Promise<PaymentResult> {
    try {
      const merchantAuthenticationType = this.createMerchantAuth();

      const transactionRequestType = new this.apiContracts.TransactionRequestType();
      transactionRequestType.setTransactionType(this.apiContracts.TransactionTypeEnum.VOIDTRANSACTION);
      transactionRequestType.setRefTransId(cancelData.transactionId);

      const createRequest = new this.apiContracts.CreateTransactionRequest();
      createRequest.setMerchantAuthentication(merchantAuthenticationType);
      createRequest.setTransactionRequest(transactionRequestType);

      return await this.executeTransaction(createRequest);
    } catch (error) {
      this.logger.error('Void transaction failed', error);
      throw new InternalServerErrorException('Payment cancellation failed');
    }
  }
}
