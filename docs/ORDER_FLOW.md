# Order Flow


Open POS

↓

Enter employee code

↓

Find employee

↓

Store current employee in session

↓

Create orders

↓

Attach employeeId


Backend:


createOrder Cloud Function


Steps:

1. Validate user

2. Check stock

3. Create order

4. Reduce stock

5. Create stock movement



Order creation must be atomic.