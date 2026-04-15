import { create } from 'zustand';

const useWishlistStore = create((set) => ({
  savedCount: 0,
  followedCount: 0,
  priceDropCount: 0,
  setWishlistSummary: (summary = {}) => set({
    savedCount: Number(summary.savedCount ?? 0),
    followedCount: Number(summary.followedCount ?? 0),
    priceDropCount: Number(summary.priceDropCount ?? 0),
  }),
}));

export default useWishlistStore;
