import { useState, useCallback } from 'react';
import * as api from '../api/affiliates';

export function useAffiliateProducts() {
  const [products, setProducts] = useState<api.AffiliateProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await api.listAffiliateProducts();
      setProducts(data.products);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally { setLoading(false); }
  }, []);

  const saveProduct = useCallback(async (p: api.ProductInput, id?: number) => {
    setError(null);
    try {
      if (id) await api.updateAffiliateProduct(id, p);
      else await api.createAffiliateProduct(p);
      await fetchProducts();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
      return false;
    }
  }, [fetchProducts]);

  const removeProduct = useCallback(async (id: number) => {
    setError(null);
    try {
      await api.deleteAffiliateProduct(id);
      await fetchProducts();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
      return false;
    }
  }, [fetchProducts]);

  return { products, loading, error, fetchProducts, saveProduct, removeProduct };
}
