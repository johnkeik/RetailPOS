# Database Design


## Database

Firestore


The system uses a multi-tenant structure.


Recommended structure:


tenants

    tenantId

        products

        variants

        inventory

        orders

        stockMovements

        users



---

# Tenant


Every document belongs to one tenant.


Example:


{
 tenantId:"store001"
}



---

# Product


Represents the perfume/product identity.


Example:


{
 id:"firestoreId",

 tenantId:"store001",

 productCode:"1001978",

 brandId:"armani",

 name:"Armani Code",

 gender:"M",

 productType:"PERFUME",

 categoryId:"designer",

 active:true
}



Important:

productCode comes from the customer catalog.


It is used by employees.

Firestore document IDs are internal.



---

# Variant


Represents sellable units.


Example:


Armani Code:


50ml

100ml

150ml



Document:


{
 productId:"abc",

 size:100,

 unit:"ml",

 costPrice:10,

 sellingPrice:25
}



---

# Inventory


Stores current stock.


Example:


{
 productId:"abc",

 variantId:"100ml",

 quantity:25,

 updatedAt:timestamp
}



This is the current stock snapshot.



---

# Orders


Customer purchases.


Example:


{
 employeeId:"user1",

 total:50,

 createdAt:timestamp
}



Order items:


{
 orderId:"order1",

 variantId:"100ml",

 quantity:1,

 price:25
}



---

# Stock Movements


Immutable inventory history.


Example:


{
 type:"SALE",

 variantId:"100ml",

 quantity:-1,

 createdAt:timestamp
}



Movement types:


PURCHASE

SALE

ADJUSTMENT

RETURN

LOSS

# Employees


Employees represent store workers using the POS.


The MVP uses a simple EmployeeCode login.


Example:


employees/{employeeId}


{
 tenantId:"store001",

 name:"Maria",

 employeeCode: "123"

 active:true,

 createdAt:timestamp
}



The employee does not need a Firebase account.



---

# POS Login Flow


Employee opens POS.


Enters EmployeeCode:


123


Backend validates EmployeeCode.


POS session stores:


{
 employeeId:"employee001",

 employeeName:"Maria"
}



Every order stores the employee.



---
