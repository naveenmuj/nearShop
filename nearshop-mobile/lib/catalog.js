import client, { authGet, authPost } from './api';

const serializeQueryParams = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item != null && item !== '') {
          searchParams.append(key, String(item));
        }
      });
      return;
    }
    searchParams.append(key, String(value));
  });
  return searchParams.toString();
};

export const getCatalogTemplates = (params = {}) =>
  {
    const query = serializeQueryParams(params);
    return client.get(query ? `/catalog/templates?${query}` : '/catalog/templates');
  };

export const getCatalogTemplate = (id) =>
  client.get(`/catalog/templates/${id}`);

export const getCatalogCategories = () =>
  client.get('/catalog/categories');

export const addCatalogProducts = (shopId, items) =>
  authPost(`/catalog/shops/${shopId}/add-products`, { items });

export const enableCatalogProducts = (shopId, productIds) =>
  authPost(`/catalog/shops/${shopId}/enable-products`, { product_ids: productIds });

export const getShopCatalogSelections = (shopId, params = {}) =>
  authGet(`/catalog/shops/${shopId}/selections`, { params });

export const publishCatalogProducts = (shopId, catalogIds) =>
  authPost(`/catalog/shops/${shopId}/publish-products`, { catalog_ids: catalogIds });
