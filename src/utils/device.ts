export function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  
  const userAgent = window.navigator.userAgent.toLowerCase();
  const mobileKeywords = [
    'android',
    'iphone',
    'ipod',
    'ipad',
    'windows phone',
    'mobile'
  ];
  
  return mobileKeywords.some(keyword => userAgent.includes(keyword));
}

export function isDesktopDevice() {
  return !isMobileDevice();
} 