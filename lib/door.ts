// lib/door.ts
//
// THE DOOR. The customer checks every item. For each one (and each piece):
//   taken        the customer keeps it
//   refused      the item is right, the customer doesn't want it → they pay the delivery fee
//   shop_fault   wrong / damaged / not as described / missing → they pay nothing for it
// Refused items go to the Bakhaar store. The phone only says WHAT happened —
// every amount (cash to take, refunds) comes from the backend.
"use client";

import { apiFetch } from "@/lib/api";

export const REFUSED_REASONS = [
  { value: "changed_mind", label: "Changed their mind" },
  { value: "does_not_fit", label: "Doesn't fit (right size sent)" },
  { value: "ordered_by_mistake", label: "Ordered by mistake" },
  { value: "wont_pay", label: "Won't pay for it" },
  { value: "other", label: "Other reason" },
] as const;

export const FAULT_REASONS = [
  { value: "wrong_item", label: "Wrong item" },
  { value: "wrong_size_color", label: "Wrong size or colour" },
  { value: "damaged", label: "Damaged or broken" },
  { value: "not_as_described", label: "Not as described" },
  { value: "missing", label: "Missing from the bag" },
] as const;

export interface DoorLineInput {
  orderItemId: string;
  taken: number;
  refused: number;
  fault: number;
  refusedReason?: string;
  faultReason?: string;
  photos?: string[];
}

export interface DoorBody {
  lines: DoorLineInput[];
  remedies?: Record<string, "replacement" | "refund">;
  cashCollected?: boolean;
  feePaid?: boolean;
  photoUrl?: string;
  note?: string;
}

export interface DoorPreview {
  jobNumber: string;
  customerPaysFee: boolean;
  allShopFault: boolean;
  cashToCollect: number;
  feeQuestion: { amount: number } | null;
  refundToCustomer: number;
  heldForCorrectItem: number;
  goodsToStore: number;
  needsProofPhoto: boolean;
  shops: {
    orderId: string;
    orderNumber: string;
    shopName: string;
    isCod: boolean;
    paidOnline: boolean;
    remedy: "replacement" | "refund";
    canReplace: boolean;
    taken: number;
    refused: number;
    fault: number;
    itemsMoney: number;
    deliveryFee: number;
    cash: number;
  }[];
  rules?: { partialEnabled: boolean; faultPhotoRequired: boolean; replacementEnabled: boolean };
}

export interface DoorDone extends DoorPreview {
  id: string;
  doorResultId: string;
  status: "DELIVERED" | "CANCELLED";
  collected: number;
  driverPay: number;
  payHeld: boolean;
  message: string;
}

const post = <T,>(path: string, body: unknown) => apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) });

export const previewDoor = (jobId: string, body: DoorBody) => post<DoorPreview>(`/delivery/door/jobs/${jobId}/preview`, body);
export const submitDoor = (jobId: string, body: DoorBody) => post<DoorDone>(`/delivery/door/jobs/${jobId}/submit`, body);

export interface StoreItem {
  id: string;
  jobId: string;
  jobNumber: string;
  orderNumber: string;
  shop: { id: string; name: string; location: string | null };
  product: { name: string; variant: string | null; imageUrl: string | null };
  kind: "refused" | "shop_fault";
  reason: string | null;
  quantity: number;
  createdAt: string;
  overdue: boolean;
}

export const getMyStoreItems = () => apiFetch<{ items: StoreItem[]; payWaiting: number; alertHours: number }>("/delivery/door/custody");