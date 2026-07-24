# Architecture


## Overview


Angular Admin
        |
        |
Flutter POS
        |
        |
Firebase


Firebase:

- Authentication
- Firestore
- Cloud Functions



## Principles


Business logic belongs in Cloud Functions.

Clients should not directly modify important data.


Examples:

Good:

POS
 |
 createOrder()
 |
 Cloud Function
 |
 Firestore


Bad:

POS
 |
 directly modify stock