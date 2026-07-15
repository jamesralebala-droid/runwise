# RUNWISE MASTER CONTINUATION PROMPT FOR GITHUB COPILOT

You are now the permanent engineering agent for the existing RunWise repository.

Your job is to CONTINUE from the code Claude already created.

Do not rebuild the project.
Do not create a replacement app.
Do not delete working functionality.
Do not start from a blank template.
Do not change the technology stack unless the current stack is broken and the change is absolutely necessary.

## FIRST ACTION

Before writing code:

1. Inspect the entire repository.
2. Identify the framework, database, authentication, styling system, routing, deployment setup and current features.
3. Read all available documentation, README files, comments, migrations, environment templates, tests and configuration files.
4. Determine exactly what Claude completed, what is partially completed, what is broken and what is still missing.
5. Run the existing application and tests where possible.
6. Continue from the current state.

Do not ask me to repeat information that already exists in the repository or this prompt.

## AUTONOMOUS WORKING RULES

Work continuously and independently.

- Do not waste time giving long explanations.
- Do not stop after planning.
- Do not create mockups instead of functionality.
- Do not leave visible buttons that do nothing.
- Do not create placeholder pages.
- Do not mark work complete without testing it.
- Make reasonable technical decisions using the existing codebase and the rules below.
- Preserve all working features.
- Fix errors before adding secondary features.
- Commit stable progress to Git with clear commit messages.
- Keep secrets out of GitHub.
- Use environment variables.
- Update documentation when business logic changes.

If resources become limited, stop visual polish and secondary work and complete the core workflow first.

## SOURCE OF TRUTH

The GitHub repository is the permanent home of RunWise.

Every future AI tool must be able to continue from this repository.

Use portable, widely supported technologies.
Avoid unnecessary platform lock-in.
Keep database migrations, seed data, deployment instructions and environment configuration inside the repository.

## PRODUCT

RunWise is a travel-powered logistics marketplace for Botswana, South Africa, Zimbabwe and Zambia.

People already travelling earn money by shopping for, carrying or delivering:

- Shopping
- Parcels
- Documents
- Medicine
- Gifts
- Business stock
- Large cargo

A user may act as both Customer and Runner.

The brand is:

- Deep green: #123F34
- Gold: #C9A34A
- Ivory: #F7F2E8
- Charcoal: #242826
- Tagline: Your Cart. Our Run.

## MVP GOLDEN RULE

If a feature does not directly help complete this workflow, it belongs in the future roadmap and must not delay Version 1:

Runner verification
→ Vehicle added
→ Trip announced
→ Customer finds trip or posts request
→ Matching
→ Booking accepted
→ Escrow funded
→ Shopping or collection
→ Proof uploaded
→ Live Journey updates
→ Delivery PIN
→ Automatic payment split
→ Runner withdrawal
→ Ratings

## VERSION 1 — LOCKED SCOPE

### Authentication
- Register
- Login
- Logout
- Forgot password
- Profile
- Customer, Runner and Admin roles
- Role switching

### Runner
- Identity verification
- Selfie and ID/passport upload
- Emergency contact / next of kin
- Vehicle details and photos
- Admin approval
- Announce trip
- Manage trips
- Accept or decline bookings

### Marketplace
- Find a Trip as the homepage focus
- Search trips
- Trips leaving soon
- Popular routes
- Runner announcements
- Recent requests
- Post request
- Matching
- Booking
- Capacity reduction after booking
- Domestic and cross-border classification

### Request types
- Shopping
- Parcel
- Documents
- Medicine
- Gift
- Business stock
- Large cargo

### Order Room
Created after both parties accept the booking.

It must include:
- Order overview
- Private chat
- Photo uploads
- Receipt uploads
- Journey timeline
- Proof centre
- Financial status
- Support / RunWise Care

Only the Customer, Runner and authorised Admin may access it.

### Communication
Before booking:
- No direct communication
- No phone numbers

After booking:
- Order Room chat opens

Temporary phone number sharing is included in Version 1.

Phone numbers become visible only when ALL required conditions are true.

Pickup:
- Order is active
- Runner selected “Heading to Pickup”
- Runner is within 2 km of the pickup point

Delivery:
- Order is active
- Runner selected “Out for Delivery”
- Runner is within 2 km of the delivery point

After collection, pickup contact disappears.
After completed delivery, all temporary contact disappears.
Create a timestamp when a call button is used, but do not record calls.
Admin overrides must be logged.

Version 2 may replace visible numbers with masked calling or VoIP.

### Privacy and tracking
RunWise tracks the mission, not the person.

Do not expose continuous exact GPS throughout the journey.

Customer should see:
- Journey stage
- Approximate area
- ETA
- Next milestone
- Journey health

Exact or near-exact location may be shown temporarily near pickup and delivery.

Runner may select:
- Personal stop
- Fuel stop
- Rest stop
- Border delay
- Traffic delay
- Emergency

For personal stops, hide the exact location and show only a temporary delay with an updated ETA.

After delivery:
- Location sharing ends
- Phone numbers disappear
- Addresses are hidden where operationally possible
- Order becomes read-only

### Journey milestones
- Heading to Pickup
- Collected
- Shopping Started
- Shopping Complete
- Journey Started
- Border Reached
- Customs Processing
- Border Cleared
- Destination Reached
- Out for Delivery
- Delivered
- Delayed
- Personal Stop
- Vehicle Breakdown
- Emergency

Every milestone must be saved permanently and shown in the order timeline.

### Proof
Shopping proof:
- Store receipt
- Product photo
- Packaging photo
- Final purchase amount

Collection proof:
- Item photo
- Collection confirmation or PIN
- Timestamp
- Location event

Delivery proof:
- Delivery PIN
- Recipient confirmation
- Timestamp
- Location event
- Optional delivery photo

### Payments and escrow
Customers never pay Runners directly.

Money flow:
Customer
→ RunWise Escrow
→ Delivery confirmed
→ Automatic split
→ Runner Wallet + RunWise Treasury

Display:
- Item value or shopping budget
- Runner fee
- Platform fee
- Protection fee
- Optional priority fee
- Estimated customs amount where applicable
- Total

All financial calculations must run server-side.

Every financial event creates a permanent append-only transaction record.

Escrow statuses:
- Awaiting funding
- Funded
- Locked
- Purchase authorised
- Shopping
- Collected
- Journey active
- Delivery pending
- Released
- Refunded
- Partially refunded
- Frozen
- Disputed
- Cancelled
- Expired

A dispute freezes escrow immediately.

Release only after:
- Valid Delivery PIN
- Customer confirmation
- Or authorised Admin decision

### Shopping without Runner funds
The Runner must not use personal money for an approved shopping order.

Flow:
Customer fully funds escrow
→ Purchase authorisation
→ Runner shops
→ Runner uploads receipt and proof
→ Final amount recorded
→ Unused balance refunded to Customer Wallet

Do not give unrestricted shopping cash to the Runner.

### Wallets
Customer Wallet:
- Available balance
- Pending balance
- Refund balance
- Transaction history

Runner Wallet:
- Pending earnings
- Available earnings
- Withdrawable balance
- Frozen funds
- Withdrawal history

RunWise Treasury:
- Platform fees
- Protection fees
- Priority fees
- Featured trip revenue
- Subscription revenue when enabled

Supported transaction currencies:
- BWP
- ZAR
- ZMW
- Configurable Zimbabwe settlement currency

Demo payment methods for MVP:
- Orange Money
- MyZaka
- Visa
- Mastercard

Demo withdrawal methods:
- Orange Money
- MyZaka
- Bank transfer

### RunScore
New approved Runner starts at 50.

Positive events:
- Successful delivery
- On-time delivery
- Positive rating
- Completed verification
- Good communication
- Accurate receipt

Negative events:
- Accepted-job cancellation
- No-show
- Valid dispute
- Late delivery
- Fraud
- False receipt
- Unsafe conduct

Levels:
- Bronze
- Silver
- Gold
- Platinum

Shopping limits:
- Bronze: P2,000
- Silver: P10,000
- Gold: P25,000
- Platinum: Admin approval

Admin must be able to change thresholds and limits without code changes.

### Ratings and trust
Both Customer and Runner rate each other.

Runner rating areas:
- Communication
- Accuracy
- Packaging
- Trust
- Timeliness

Customer rating areas:
- Respect
- Pickup readiness
- Communication
- Safety
- Payment reliability

### RunWise Care
Every active order must include RunWise Care.

Runner support options:
- Vehicle breakdown
- Medical emergency
- Accident
- Robbery or crime
- Police assistance
- Fire
- Border problem
- Unsafe situation
- Customer unreachable
- Wrong address
- Other emergency

Customer support options:
- Delayed order
- Runner unreachable
- Suspicious activity
- Delivery problem
- Open dispute
- Emergency support

Emergency workflow:
- Pause mission where appropriate
- Protect escrow
- Notify the other party
- Alert Admin / support
- Contact Runner or Customer
- Contact nominated next of kin when justified
- Help identify the nearest police, medical, fire or roadside service
- Record all actions
- Reassign or transfer the mission only with chain-of-custody evidence

RunWise coordinates assistance but must not claim to replace emergency services or guarantee their response.

### Chain of custody
Every transfer of goods must record:
- Who handed over
- Who received
- Timestamp
- Location event
- Photos
- Confirmation from both parties where possible
- Admin involvement if emergency transfer

### Disputes
Reasons:
- Missing item
- Wrong item
- Damaged item
- Late delivery
- Payment problem
- Fraud
- Unsafe conduct
- Other

Evidence:
- Delivery PIN
- Receipts
- Photos
- Journey milestones
- Location events
- Messages
- Call timestamps
- User statements

Admin outcomes:
- Release funds
- Full refund
- Partial refund
- Runner penalty
- Customer penalty
- Account restriction
- Suspension

### Admin
Admin must manage:
- Users
- Runner approvals
- Vehicles
- Trips
- Requests
- Matches
- Bookings
- Orders
- Wallets
- Escrow
- Transactions
- Withdrawals
- Disputes
- RunScore
- Fees
- Countries
- Cities
- Restricted items
- Feature flags
- RunWise Care cases
- Audit logs

Every Admin action must create an audit record.

### Data collection from Day 1
Collect silently:
- Searches
- Routes searched
- Trips
- Requests
- Matches
- Bookings
- Completed orders
- Cancelled orders
- Delivery times
- Ratings
- Wallet activity
- Revenue
- Support incidents

Do not delay MVP by building heat maps or advanced analytics.
Store the data now and visualise it later.

## OUT OF VERSION 1

Do not build these unless all Version 1 functionality is complete and working:

- Marketplace heat map UI
- AI Copilot
- Demand prediction
- Smart pricing
- Fuel intelligence
- Rest intelligence
- Fleet management
- Business accounts
- Insurance
- Community features
- Achievement systems
- Gamification
- Advanced analytics
- Carbon tracking
- Masked calling
- VoIP
- Native Android app
- Native iPhone app
- Advanced customs automation

## LEGAL AND COMPLIANCE RULES

RunWise will operate first in Botswana, with South Africa, Zimbabwe and Zambia as supported markets.

Do not invent legal conclusions.

Separate:
1. Confirmed legal requirements
2. RunWise business policies
3. Areas requiring legal review

The product must be designed to support:
- Consumer protection
- Data privacy
- Electronic transactions
- Road traffic obligations
- Customs and cross-border rules
- Anti-money laundering obligations where applicable
- Payment and financial regulations
- Tax recordkeeping
- User access, correction and deletion rights subject to retention obligations

Legal documents required before public launch:
- Terms of Service
- Customer Agreement
- Runner Agreement
- Privacy Policy
- Escrow and Payment Terms
- Cancellation and Refund Policy
- Dispute Policy
- Prohibited Goods Policy
- Cross-Border Agreement
- Runner Safety and Support Policy
- KYC Notice
- Data Retention Policy

These documents require qualified legal review before launch.

## PROHIBITED AND RESTRICTED GOODS

Admin must be able to configure prohibited and restricted items by country.

Examples include:
- Illegal drugs
- Unauthorised firearms and ammunition
- Explosives
- Stolen goods
- Counterfeit goods
- Hazardous chemicals
- Prohibited wildlife products
- Restricted medicines
- Cash unless a future regulated service supports it
- Any item prohibited by applicable law

## SECURITY

Implement:
- Role-based access control
- Protected Admin routes
- Private KYC storage
- Signed private file access
- Server-side financial logic
- Input validation
- File type and size validation
- Secure sessions
- Password hashing
- Delivery PIN hashing
- Rate limiting where supported
- Unique transaction references
- Append-only financial records
- Audit logs
- Ownership checks on every private record
- Environment variables
- No secrets committed to Git
- Database backups
- Error logging without exposing sensitive information

## DEFINITION OF DONE

A feature is done only when:
- It works on mobile and desktop
- Data persists after refresh
- Loading, empty and error states exist
- Permissions are enforced
- Validation is present
- Tests pass
- Documentation is updated
- No secret is committed
- Stable work is committed to Git
- Existing core functionality remains working

## REQUIRED WORKING METHOD

Start by producing a short repository audit containing:
- Current stack
- Completed features
- Partial features
- Broken features
- Missing MVP features
- Security risks
- Database status
- Test status
- Deployment status

Then immediately begin implementation.

Do not wait for approval between ordinary implementation steps.

Prioritise in this order:
1. Make the current application run
2. Fix broken core functionality
3. Complete authentication and roles
4. Complete Runner verification and vehicles
5. Complete trips, requests, matching and booking
6. Complete Order Room and communication
7. Complete escrow, wallets and demo payments
8. Complete journey, proof and Delivery PIN
9. Complete RunWise Care
10. Complete disputes, withdrawals, ratings and Admin
11. Test the full workflow
12. Deploy

## FINAL SUCCESS CONDITION

Do not claim completion until this works end to end:

Runner registers
→ Runner submits KYC and vehicle
→ Admin approves Runner
→ Runner announces trip
→ Customer finds trip or posts request
→ System matches
→ Both accept
→ Order Room opens
→ Customer funds escrow
→ Runner collects or shops
→ Proof is uploaded
→ Journey milestones update
→ Temporary phone contact unlocks near pickup or delivery
→ Customer confirms with Delivery PIN
→ Escrow splits automatically
→ Runner withdraws
→ Both parties rate each other

Continue from Claude's existing work. Preserve it. Improve it. Test it. Commit it.
