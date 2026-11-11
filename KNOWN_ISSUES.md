# Known Issues & Mitigation Strategies

1. **SRS Local Ingest Without Active Camera**:
   - *Mitigation*: The custom live player supports a fallback preview stream test and test MP4 loop / HLS test stream so UI and features can be verified even when live cameras are offline.
2. **Payment Gateway Sandbox Mocking**:
   - *Mitigation*: Ethiopian payment gateways (Telebirr, CBE Birr, Chapa) and Stripe adapters have sandbox/mock fallback modes enabled for frictionless local testing and verification.
3. **Database Concurrency in Flash Ticket Sales**:
   - *Mitigation*: Ticket reservations use transactional decrements with optimistic locking and check constraints (`sold_count < capacity`).
