import type { CommerceProvider } from "@/lib/commerce/types";

export type CommerceProviderDefinition = {
  label: string;
  visible: boolean;
  runtimeEnabled: boolean;
  actionsAllowed: boolean;
};

export const COMMERCE_PROVIDERS: Record<CommerceProvider, CommerceProviderDefinition> = {
  bol: {
    label: "bol.com",
    visible: true,
    runtimeEnabled: true,
    actionsAllowed: false,
  },
  shopify: {
    label: "Shopify",
    visible: false,
    runtimeEnabled: false,
    actionsAllowed: false,
  },
  woocommerce: {
    label: "WooCommerce",
    visible: false,
    runtimeEnabled: false,
    actionsAllowed: false,
  },
};

export function commerceProviderDefinition(provider: CommerceProvider) {
  return COMMERCE_PROVIDERS[provider];
}

export function isCommerceProviderRuntimeEnabled(provider: CommerceProvider) {
  return COMMERCE_PROVIDERS[provider].runtimeEnabled;
}

export function isCommerceProviderVisible(provider: CommerceProvider) {
  return COMMERCE_PROVIDERS[provider].visible;
}

export function commerceProviderActionsAllowed(provider: CommerceProvider) {
  return COMMERCE_PROVIDERS[provider].actionsAllowed;
}

export function enabledCommerceProviders() {
  return (Object.keys(COMMERCE_PROVIDERS) as CommerceProvider[])
    .filter(isCommerceProviderRuntimeEnabled);
}

export function pausedProviderMessage(provider: CommerceProvider) {
  return `${commerceProviderDefinition(provider).label} is temporarily paused while SequenceFlow focuses on bol.com.`;
}
