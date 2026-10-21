import {setGlobalOptions} from "firebase-functions/v2";

setGlobalOptions({maxInstances: 10});

export {receiveStock} from "./inventory/receive-stock";
export {adjustStock} from "./inventory/adjust-stock";
export {recordStockMovements} from "./inventory/record-stock-movements";
export {createOrder} from "./orders/create-order";
export {cancelOrder} from "./orders/cancel-order";
export {seedMockOrders} from "./orders/seed-mock-orders";
export {setManagerPin} from "./security/set-manager-pin";

export {createBrand} from "./brands/create-brand";
export {updateBrand} from "./brands/update-brand";
export {toggleBrandActive} from "./brands/toggle-brand-active";
export {deleteBrand} from "./brands/delete-brand";

export {createCategory} from "./categories/create-category";
export {updateCategory} from "./categories/update-category";
export {toggleCategoryActive} from "./categories/toggle-category-active";
export {deleteCategory} from "./categories/delete-category";

export {createProduct} from "./products/create-product";
export {updateProduct} from "./products/update-product";
export {assignVariantToProducts} from "./products/assign-variant-to-products";
export {toggleProductActive} from "./products/toggle-product-active";
export {deleteProduct} from "./products/delete-product";

export {createConsumable} from "./consumables/create-consumable";
export {updateConsumable} from "./consumables/update-consumable";
export {toggleConsumableActive} from "./consumables/toggle-consumable-active";
export {deleteConsumable} from "./consumables/delete-consumable";

export {createVariantTemplate} from "./variants/create-variant-template";
export {updateVariantTemplate} from "./variants/update-variant-template";
export {toggleVariantTemplateActive} from "./variants/toggle-variant-template-active";
export {deleteVariantTemplate} from "./variants/delete-variant-template";

export {createEmployee} from "./employees/create-employee";
export {updateEmployee} from "./employees/update-employee";
export {toggleEmployeeActive} from "./employees/toggle-employee-active";
export {deleteEmployee} from "./employees/delete-employee";

export {createExpense} from "./expenses/create-expense";
export {updateExpense} from "./expenses/update-expense";
export {deleteExpense} from "./expenses/delete-expense";
