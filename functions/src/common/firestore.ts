import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();

export function serverTimestamp(): FieldValue {
  return FieldValue.serverTimestamp();
}

export function inventoryDocId(productId: string, variantTemplateId: string): string {
  return `${productId}__${variantTemplateId}`;
}
