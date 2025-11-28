import type { 
  PayLink, 
  Protocol402Response, 
  Protocol403Response,
  ReasonCode,
} from './types.js';
import { ReasonMessages } from './types.js';
import { generateNonce, createSignature } from './utils.js';

export interface Protocol402Options {
  basePath: string;
  timeoutSeconds: number;
  signatureSecret?: string;
  /** Base URL for callbacks (e.g., https://sn1ffprotocol.com) */
  baseUrl?: string;
}

/**
 * Build a 402 Payment Required response body
 */
export function build402Response(
  payLink: PayLink,
  options: Protocol402Options
): Protocol402Response {
  const nonce = generateNonce();
  const baseUrl = options.baseUrl || '';
  
  const response: Protocol402Response = {
    protocol: '402-paylink-v1',
    payLinkId: payLink.id,
    resource: {
      description: payLink.description,
      preview: null,
    },
    payment: {
      chainId: payLink.price.chainId,
      tokenSymbol: payLink.price.tokenSymbol,
      amount: payLink.price.amount,
      recipient: payLink.recipientAddress,
      timeoutSeconds: options.timeoutSeconds,
    },
    callbacks: {
      status: `${baseUrl}${options.basePath}/${payLink.id}/status`,
      confirm: `${baseUrl}${options.basePath}/${payLink.id}/confirm`,
    },
    nonce,
  };

  // Add signature if secret is provided
  if (options.signatureSecret) {
    const dataToSign = JSON.stringify({
      payLinkId: response.payLinkId,
      payment: response.payment,
      nonce: response.nonce,
    });
    response.signature = createSignature(dataToSign, options.signatureSecret);
  }

  return response;
}

export interface Protocol403Options {
  payLinkId?: string;
  details?: Record<string, unknown>;
}

/**
 * Build a 403 Forbidden response body
 */
export function build403Response(
  reasonCode: ReasonCode,
  options: Protocol403Options = {}
): Protocol403Response {
  return {
    protocol: '403-paylink-v1',
    payLinkId: options.payLinkId,
    reasonCode,
    reasonMessage: ReasonMessages[reasonCode],
    details: options.details,
  };
}

/**
 * HTTP headers for 402 response
 */
export const HEADERS_402 = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Paylink-Protocol': '402-v1',
} as const;

/**
 * HTTP headers for 403 response
 */
export const HEADERS_403 = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Paylink-Protocol': '403-v1',
} as const;
