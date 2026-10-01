import {setGlobalOptions} from "firebase-functions/v2";

setGlobalOptions({maxInstances: 10});

export {receiveStock} from "./inventory/receive-stock";
export {adjustStock} from "./inventory/adjust-stock";
export {createOrder} from "./orders/create-order";

export {createBrand} from "./brands/create-brand";
export {updateBrand} from "./brands/update-brand";
export {toggleBrandActive} from "./brands/toggle-brand-active";

export {createCategory} from "./categories/create-category";
export {updateCategory} from "./categories/update-category";
export {toggleCategoryActive} from "./categories/toggle-category-active";

export {createProduct} from "./products/create-product";
export {updateProduct} from "./products/update-product";
export {toggleProductActive} from "./products/toggle-product-active";
export {deleteProduct} from "./products/delete-product";

export {createConsumable} from "./consumables/create-consumable";
export {updateConsumable} from "./consumables/update-consumable";
export {toggleConsumableActive} from "./consumables/toggle-consumable-active";

export {createVariantTemplate} from "./variants/create-variant-template";
export {updateVariantTemplate} from "./variants/update-variant-template";
export {toggleVariantTemplateActive} from "./variants/toggle-variant-template-active";
export {deleteVariantTemplate} from "./variants/delete-variant-template";

export {createEmployee} from "./employees/create-employee";
export {updateEmployee} from "./employees/update-employee";
export {toggleEmployeeActive} from "./employees/toggle-employee-active";
