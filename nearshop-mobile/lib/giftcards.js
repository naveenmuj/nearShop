/**
 * Gift Cards API
 */
import { authGet, authPost } from './api';

// Purchase gift card
export async function purchaseGiftCard(value, shopId = null, recipientEmail = null, recipientPhone = null, recipientName = null, personalMessage = null, templateId = null) {
  const response = await authPost('/giftcards/purchase', {
    shop_id: shopId,
    value,
    recipient_email: recipientEmail,
    recipient_phone: recipientPhone,
    recipient_name: recipientName,
    personal_message: personalMessage,
    template_id: templateId,
  });
  return response.data;
}

// Check balance
export async function checkGiftCardBalance(code) {
  const response = await authGet(`/giftcards/check/${code}`);
  return response.data;
}

// Redeem gift card
export async function redeemGiftCard(code, amount = null) {
  const response = await authPost('/giftcards/redeem', { code, amount });
  return response.data;
}

// Get my gift cards
export async function getMyGiftCards(includeUsed = false) {
  const response = await authGet(`/giftcards/my?include_used=${includeUsed}`);
  return response.data;
}

// Get gift card detail
export async function getGiftCardDetail(cardId) {
  const response = await authGet(`/giftcards/${cardId}`);
  return response.data;
}

// Get templates
export async function getGiftCardTemplates(shopId = null) {
  const url = shopId ? `/giftcards/templates/${shopId}` : '/giftcards/templates/null';
  const response = await authGet(url);
  return response.data;
}
