const prisma = require('../config/database');

let cardProductCache = [];
let cardProductCacheTime = 0;
const CACHE_TTL = 60000;

const getCardProducts = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && cardProductCache.length && (now - cardProductCacheTime) < CACHE_TTL) {
    return cardProductCache;
  }
  cardProductCache = await prisma.cardProduct.findMany({ where: { isActive: true } });
  cardProductCacheTime = now;
  return cardProductCache;
};

const invalidateCardCache = () => {
  cardProductCache = [];
  cardProductCacheTime = 0;
};

const extractSlugFromServiceCode = (code) => {
  const normalizedCode = (code || '').toUpperCase().trim();
  if (normalizedCode.startsWith('CARD-REG-')) return normalizedCode.replace('CARD-REG-', '');
  if (normalizedCode.startsWith('CARD-ACT-')) return normalizedCode.replace('CARD-ACT-', '');
  return null;
};

const isCardRegistration = (code, name) => {
  const c = (code || '').toUpperCase();
  const n = (name || '').toUpperCase();
  return c.startsWith('CARD-REG') || n.includes('CARD REGISTRATION') || n.includes('CARD CREATED');
};

const isCardActivation = (code, name) => {
  const c = (code || '').toUpperCase();
  const n = (name || '').toUpperCase();
  return c.startsWith('CARD-ACT') || n.includes('CARD ACTIVATION') || n.includes('CARD REACTIVATION') || n.includes('CARD RENEWAL');
};

const getCardBucketKey = async (code, name) => {
  const isReg = isCardRegistration(code, name);
  const isAct = isCardActivation(code, name);
  if (!isReg && !isAct) return null;

  let slug = extractSlugFromServiceCode(code);
  if (slug) {
    const prefix = isReg ? 'CARD_CREATED_' : 'CARD_REACTIVATION_';
    return prefix + slug;
  }

  const normalizedName = (name || '').toUpperCase();
  const products = await getCardProducts();
  for (const product of products) {
    if (normalizedName.includes((product.name || '').toUpperCase())) {
      const prefix = isReg ? 'CARD_CREATED_' : 'CARD_REACTIVATION_';
      return prefix + (product.slug || '').toUpperCase();
    }
  }

  const isDerm = normalizedName.includes('DERM') || normalizedName.includes('SKIN');
  const prefix = isReg ? 'CARD_CREATED_' : 'CARD_REACTIVATION_';
  return prefix + (isDerm ? 'DERMATOLOGY' : 'GENERAL');
};

const buildCardBucketEntries = async (existingStaticKeys = {}) => {
  const products = await getCardProducts();
  const entries = { ...existingStaticKeys };
  for (const product of products) {
    const slug = (product.slug || '').toUpperCase();
    const createdKey = `CARD_CREATED_${slug}`;
    const reactKey = `CARD_REACTIVATION_${slug}`;
    if (!entries[createdKey]) {
      entries[createdKey] = `${product.name} Card Created`;
    }
    if (!entries[reactKey]) {
      entries[reactKey] = `${product.name} Card Reactivation`;
    }
  }
  return entries;
};

const isCardService = (code, name) => {
  return isCardRegistration(code, name) || isCardActivation(code, name);
};

module.exports = {
  getCardProducts,
  invalidateCardCache,
  getCardBucketKey,
  buildCardBucketEntries,
  isCardService,
  isCardRegistration,
  isCardActivation,
  extractSlugFromServiceCode
};
