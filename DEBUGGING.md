# Part 2 — Debugging report

The corrected copies are under `debug/`. The original `part2/` files are
preserved for comparison.

## Issues found and fixes

| Area | Symptom | Root cause | Fix |
|---|---|---|---|
| Request listing | Arbitrary query properties can affect the MongoDB filter | All query parameters were spread into the database filter | Accept only `status`, `cursor`, and `limit`; validate status |
| Request listing | A caller can request an excessive or invalid number of records | Limit was converted with `Number()` and not capped | Validate a positive integer and cap it at 100 |
| Request listing | Pagination can skip or repeat records | `_id > cursor` was used without a matching stable sort | Use descending `createdAt` and `_id` ordering with a compound cursor |
| Approval | Requests in declined, cancelled, or other states could be approved | Only `approved` was rejected | Approval query requires `status: pending_admin` |
| Approval | Missing shift or colleague can cause a server error | Related documents were dereferenced without null checks | Validate shift and colleague existence |
| Approval | Valid clinical roles can be rejected or invalid ones accepted | Controller checked `requiredRole` instead of `requiredClinicalRole` | Reuse `validateRoster` |
| Approval | A licence can be accepted or rejected based on the wrong date | Licence was compared with the current date | Validate licence against the shift date through the roster validator |
| Approval | Overnight or cross-day clashes can be missed | Only assignments starting on the same calendar day were loaded | Reuse interval-based roster validation |
| Approval | Weekly hours can be calculated for the wrong person or week | Query used requester assignments and local Sunday-based boundaries | Validate the colleague's roster using UTC Monday-to-Sunday boundaries |
| Approval | An unrelated assignment can be deleted | Delete filter matched only the shift | Find and delete the requester's exact assignment |
| Approval | Concurrent approvals can transfer the same shift twice | Read, validation, transfer, and status update were not atomic | Use a MongoDB transaction, conditional pending status, and colleague roster version update |
| Approval | Audit history reports an incorrect transition | Status was changed before `from` was recorded and wrong audit property names were used | Record `pending_admin` → `approved` using the schema's audit fields |
| Cancellation | A legitimate requester can be rejected | ObjectId was compared directly with a string | Use the ObjectId `.equals()` method |
| Cancellation | Completed requests can be cancelled | Cancellation did not restrict eligible statuses | Allow only `pending_colleague` and `pending_admin` |
| Cancellation | Audit history reports the wrong previous state | Status was changed before the previous status was captured | Capture the previous status and update atomically |
| Error handling | Internal stack traces and database details are exposed | Raw error objects were returned to clients | Return safe messages and appropriate HTTP status codes |
| Frontend import | Page fails to compile or API is undefined | Named import did not match the actual default Axios export | Use the existing default-exported API client |
| Frontend loading | Switching tabs does not reload or filter the list | Effect ran only once and did not filter the returned records | Derive sent/received lists from the authenticated user's ID |
| Frontend count | Request count becomes stale | Count was copied into separate state | Derive count from the visible request list |
| Frontend actions | Accept/decline can execute during render | Handler was invoked directly in `onClick` | Pass an arrow callback |
| Frontend state | React may not render an update | Existing request and array were mutated in place | Reload data and replace state immutably |
| Frontend API | Actions can fail authentication or use wrong URLs | Raw `fetch` bypassed Axios configuration and used mismatched endpoints | Use the shared Axios client and existing API routes |
| Frontend feedback | Users cannot tell whether loading or an action failed | No loading state and incomplete error handling | Add loading, error, and per-request busy states |

## Performance considerations

- The original listing returned every matching record when no limit was supplied.
  As the collection grows, response size, database work, memory use, and network
  transfer grow with the number of matching requests.
- An offset-based page can become slower at high page numbers because MongoDB
  must walk past skipped records. The corrected listing uses cursor pagination
  and a stable sort. The existing request indexes should be reviewed against
  the deployed query plan.
- Approval roster validation loads the colleague's assignments and checks
  overlap and weekly hours. Its work grows with that colleague's assignment
  count. The current implementation keeps the validation logic centralized
  and correct; a future optimization could query only assignments whose time
  ranges can overlap the target week, with suitable indexes.
- Transactional approval adds database coordination, but prevents partial
  assignment transfers and conflicting concurrent approvals.

## Regression tests

`debug/server/tests/swapRequestController.test.js` covers:
- Rejection of unapproved listing filters and capped, stable pagination.
- ObjectId-safe cancellation ownership and correct audit transition.
- Two concurrent approval attempts, with only one successful assignment transfer.

The concurrency test uses mocked model operations to verify controller
transaction orchestration. A MongoDB replica-set integration test should
also be run against the actual database before production deployment.
