import { PaymentProviderType, PaymentInitializationResult } from '@concert/types';
import { AppError } from '@concert/shared';

export interface PaymentGatewayAdapter {
  provider: PaymentProviderType;
  initializePayment(params: {
    orderId: string;
    amountCents: number;
    currency: string;
    customerEmail: string;
    customerPhone?: string;
  }): Promise<PaymentInitializationResult>;
  verifyWebhook(signature: string, payload: any): boolean;
}

class TelebirrAdapter implements PaymentGatewayAdapter {
  provider: PaymentProviderType = 'TELEBIRR';

  async initializePayment(params: any): Promise<PaymentInitializationResult> {
    const reference = `TB-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    return {
      paymentId: `pay_tb_${Date.now()}`,
      orderId: params.orderId,
      provider: 'TELEBIRR',
      reference,
      amountCents: params.amountCents,
      currency: params.currency,
      qrCodeData: `telebirr://pay?ref=${reference}&amount=${params.amountCents / 100}`,
      checkoutUrl: `/payment-confirmation/${params.orderId}?ref=${reference}&gateway=telebirr`
    };
  }

  verifyWebhook(signature: string, payload: any): boolean {
    // In production, Telebirr uses RSA public key decryption of sign
    return Boolean(signature && payload);
  }
}

class CbeBirrAdapter implements PaymentGatewayAdapter {
  provider: PaymentProviderType = 'CBE_BIRR';

  async initializePayment(params: any): Promise<PaymentInitializationResult> {
    const reference = `CBE-${Date.now()}`;
    return {
      paymentId: `pay_cbe_${Date.now()}`,
      orderId: params.orderId,
      provider: 'CBE_BIRR',
      reference,
      amountCents: params.amountCents,
      currency: params.currency,
      checkoutUrl: `/payment-confirmation/${params.orderId}?ref=${reference}&gateway=cbe_birr`
    };
  }

  verifyWebhook(signature: string, payload: any): boolean {
    return Boolean(signature && payload);
  }
}

class ChapaAdapter implements PaymentGatewayAdapter {
  provider: PaymentProviderType = 'CHAPA';

  async initializePayment(params: any): Promise<PaymentInitializationResult> {
    const reference = `CHP-${Date.now()}`;
    return {
      paymentId: `pay_chp_${Date.now()}`,
      orderId: params.orderId,
      provider: 'CHAPA',
      reference,
      amountCents: params.amountCents,
      currency: params.currency,
      checkoutUrl: `/payment-confirmation/${params.orderId}?ref=${reference}&gateway=chapa`
    };
  }

  verifyWebhook(signature: string, payload: any): boolean {
    return Boolean(signature && payload);
  }
}

class StripeAdapter implements PaymentGatewayAdapter {
  provider: PaymentProviderType = 'STRIPE';

  async initializePayment(params: any): Promise<PaymentInitializationResult> {
    const reference = `cs_test_${Date.now()}`;
    return {
      paymentId: `pay_str_${Date.now()}`,
      orderId: params.orderId,
      provider: 'STRIPE',
      reference,
      amountCents: params.amountCents,
      currency: params.currency,
      checkoutUrl: `/payment-confirmation/${params.orderId}?ref=${reference}&gateway=stripe`
    };
  }

  verifyWebhook(signature: string, payload: any): boolean {
    return Boolean(signature && payload);
  }
}

const adapters: Record<PaymentProviderType, PaymentGatewayAdapter> = {
  TELEBIRR: new TelebirrAdapter(),
  CBE_BIRR: new CbeBirrAdapter(),
  CHAPA: new ChapaAdapter(),
  ARIFPAY: new ChapaAdapter(), // Compatible flow
  STRIPE: new StripeAdapter()
};

export class PaymentService {
  static async initializePayment(
    provider: PaymentProviderType,
    params: {
      orderId: string;
      amountCents: number;
      currency: string;
      customerEmail: string;
      customerPhone?: string;
    }
  ): Promise<PaymentInitializationResult> {
    const adapter = adapters[provider];
    if (!adapter) {
      throw new AppError(`Unsupported payment provider: ${provider}`, 400);
    }
    return adapter.initializePayment(params);
  }

  static verifyWebhookSignature(provider: PaymentProviderType, signature: string, payload: any): boolean {
    const adapter = adapters[provider];
    if (!adapter) return false;
    return adapter.verifyWebhook(signature, payload);
  }
}
