// lib/office.ts
//
// How to reach the Bakhaar office. Set these in delivery-frontend/.env.local:
//   NEXT_PUBLIC_SUPPORT_PHONE=+252630000000
//   NEXT_PUBLIC_SUPPORT_WHATSAPP=252630000000
// Until they are set, the app says "call the office" without a fake number.
export const OFFICE_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() || "";
export const OFFICE_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.trim() || "";
