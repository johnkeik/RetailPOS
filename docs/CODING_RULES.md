# Coding Rules


## General


Prefer simple solutions.

Do not add abstractions without need.


## Firebase


Use transactions when modifying stock.


Never trust client values.


## Naming


Collections:

plural lowercase


products

orders

stockMovements



Functions:

verb + noun


createOrder()

receiveStock()



## Soft delete


Do not delete products.

Use:

active:false