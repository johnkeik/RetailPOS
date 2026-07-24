# Security Rules


## Main principle


Users can only access data belonging to their tenant.


Every query must be tenant scoped.



---

# Authentication


Firebase Authentication manages users.


User document:


users/{uid}


Example:


{
 tenantId:"store001",

 role:"EMPLOYEE"
}



---

# Roles


## OWNER


Can:

- Manage products
- Manage inventory
- View reports
- Manage users



## EMPLOYEE


Can:

- Create sales
- Search products
- View available stock



---

# Firestore Rules Concept


Every document:


allow read/write:


if request.auth != null

AND

resource.data.tenantId == userTenant



---

# Important


Never trust the frontend.


Validation belongs in:

- Firestore rules
- Cloud Functions



Examples:


Bad:


Flutter updates inventory directly.



Good:


Flutter calls createOrder()

Cloud Function updates inventory.