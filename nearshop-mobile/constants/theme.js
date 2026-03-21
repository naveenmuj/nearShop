export const COLORS = {
  primary: '#7F77DD',
  primaryLight: '#EEEDFE',
  primaryDark: '#534AB7',
  blue: '#3B8BD4',
  blueLight: '#E6F1FB',
  green: '#1D9E75',
  greenLight: '#E1F5EE',
  amber: '#EF9F27',
  amberLight: '#FAEEDA',
  red: '#E24B4A',
  redLight: '#FCEBEB',
  coral: '#D85A30',
  pink: '#D4537E',
  teal: '#5DCAA5',
  white: '#FFFFFF',
  bg: '#F9FAFB',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
};

export const CATEGORY_COLORS = {
  Electronics: '#3B8BD4',
  Clothing: '#7F77DD',
  Fashion: '#7F77DD',
  Grocery: '#1D9E75',
  Food: '#D85A30',
  Home: '#EF9F27',
  Beauty: '#D4537E',
};

export const STATUS_COLORS = {
  pending: '#EF9F27',
  confirmed: '#3B8BD4',
  preparing: '#7F77DD',
  ready: '#5DCAA5',
  completed: '#1D9E75',
  delivered: '#1D9E75',
  cancelled: '#E24B4A',
};

export const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHover: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
};

export const formatPrice = (price) => {
  if (!price && price !== 0) return '₹0';
  return '₹' + Number(price).toLocaleString('en-IN');
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
};
