# MERN Machine Test - 1.5 Years

Candidate brief · Date: \_\_\_\_\_\_\_\_\_\_ · Interviewer: \_\_\_\_\_\_\_\_\_\_ · Repo: \_\_\_\_\_\_\_\_\_\_

## Overview

- **Role:** MERN developer, around 1.5 years of experience
- **Format:** in our office, on an office machine with internet: a 4-hour build and debug session (internet and AI allowed), followed by a 30-minute review with us.
- **Time:** plan for a 5-hour visit including a break and the review. The 4 hours are timed; we stop whatever state the code is in.
- **AI tools:** allowed and expected (ChatGPT, Claude, Copilot, Cursor, etc.). You must be able to explain and change any line you submit, because the review depends on it.
- **Partial is fine:** a working core with honest notes beats a half-working everything. Tell us what you skipped and why.

The test has two parts, submitted in the same repository: **Part 1** is a feature to build, and **Part 2** is existing code to debug. We are assessing five things: whether you can turn a workflow with states and rules into a correct API, whether your code holds up with real data volume, whether you can find and fix problems from a symptom, whether you can work independently, and whether what you hand over is neat and free of issues.

This test assumes you have already built CRUD apps with auth. The marks are in the parts that go beyond that: the approval workflow, re-validation, concurrency, and query performance.

## Part 1: Build SwapDesk

Build **SwapDesk**, a small web app a hospital uses to let clinical staff swap shifts with each other, with admin approval. The roster already exists: staff are assigned to shifts. Your job is the **swap workflow** on top of it. An **admin** reviews and approves swaps and sees department summaries. **Staff** request swaps on their own shifts, accept or decline swaps offered to them, and see their own schedule.

The CRUD screens are the easy part. Most of the marks are for the **request lifecycle** (section 3), for **re-checking the roster rules at approval time** (section 4), for keeping it correct when two people act at once, and for keeping every query fast on the full seed.

### Functional requirements

#### 1. Data and seed

You are given the shape of the roster; model it yourself.

- **Staff:** name, email, password hash, role (`admin` | `staff`), clinical role (`Doctor` | `Nurse` | `Technician`), department (ICU, ER, General Ward, Paediatrics, Radiology), licence expiry date, active flag.
- **Shift:** department, required clinical role, `start` and `end` as full date-times (shifts may cross midnight), number of slots.
- **Assignment:** which staff member is in which shift.
- **Seed script** that creates 1 admin, **300 staff**, **20,000 shifts** spread over the past 3 months and next 3 months, assignments that fill roughly 80% of slots without breaking the rules in section 4, and **2,000 swap requests** spread across every state. Use faker or similar. The seed must run in under 2 minutes. All checks are run against this full seed, so your lists and queries have to hold up at this size.

#### 2. Authentication and roles

- Login with email and password (no registration). Hash passwords with bcrypt.
- Issue a **short-lived JWT access token** (15 minutes) and a **refresh token** stored in an httpOnly cookie. The client must refresh silently when the access token expires, so a user is not logged out mid-task. Logout invalidates the refresh token.
- Two roles: `admin` and `staff`. Admin-only actions must be blocked by the **API**, not just hidden in the UI. Staff can only read and act on **their own** shifts and requests; the API must enforce ownership.

#### 3. Swap request lifecycle (the core of the test)

A swap request moves one shift from the **requester** to a **colleague**. It goes through these states:

| From | Action | By | To |
| --- | --- | --- | --- |
| (new) | create | requester | `pending_colleague` |
| `pending_colleague` | accept | colleague | `pending_admin` |
| `pending_colleague` | decline | colleague | `declined` |
| `pending_admin` | approve (moves the assignment) | admin | `approved` |
| `pending_admin` | reject | admin | `rejected` |
| `pending_colleague`, `pending_admin` | cancel | requester | `cancelled` |
| `pending_colleague`, `pending_admin` | shift starts, no decision | system | `expired` |

Only the two open states (`pending_colleague`, `pending_admin`) accept actions. Approve is the only transition that changes the roster; every other closed state leaves the assignment with the requester.

- **Create:** a staff member picks one of their own **future** assigned shifts and proposes a colleague. The colleague picker must only offer eligible people: active, same clinical role, not already in that shift. It is a **paginated search by name**, not a dropdown of all staff. State becomes `pending_colleague`.
- **Colleague responds:** accept moves it to `pending_admin`; decline moves it to `declined`.
- **Admin decides:** approve moves it to `approved` and **moves the assignment** from requester to colleague; reject moves it to `rejected`. Both take an optional note.
- **Cancel:** the requester can cancel any time before an admin decision: state `cancelled`.
- **Expiry:** a request whose shift has already started with no decision is `expired`. Decide whether you compute this on read or run a job, and write the decision in the README.
- Only **one open request per shift per requester**. Any action that is not valid for the current state (approving a declined request, accepting your own request, acting on someone else's request) must be rejected by the API with a 4xx and a clear message.
- Every state change writes an **audit entry**: who, when, from state, to state, note. The request detail page shows this history.

Keep the allowed transitions in **one place** (a transition table or function) that can be tested without a database.

#### 4. Roster rules, re-checked at approval

The roster has rules. They are checked when a request is **created** (fail fast) and checked **again when the admin approves**, because the colleague's schedule may have changed in between. Approval must **reject** with a suitable 4xx and a message naming the failed rule if any of these is false for the colleague on that shift:

1. **Role match:** the colleague's clinical role equals the shift's required role.
2. **Active and licensed:** the colleague is active and their licence expiry is on or after the shift date.
3. **No double booking:** the colleague has no other assigned shift overlapping this one. Back-to-back is allowed (08:00–14:00 then 14:00–20:00 is fine). Overnight shifts must be handled.
4. **Weekly hours cap:** the colleague's total assigned hours in that Monday–Sunday week, including this shift, must not exceed **48**. Note that the requester's hours go **down** and the colleague's go **up**; only the colleague can breach the cap.
5. **Not already in the shift:** the colleague is not already assigned to it.

The approve action must be **safe under concurrency**:

- Two admins approving the **same request** at the same moment: exactly one succeeds, the other gets a clear 409.
- Two admins approving **two different requests** that both put the same colleague over 48 hours that week: the second must fail. Say in your README how you achieve this (transaction, atomic conditional update, version field) and what its limits are.

The rule checks must query a **time window**, not load the colleague's whole assignment history. We will watch the queries.

#### 5. Admin views

- **Requests list** filtered by status, department and shift date range, sorted by shift start, with **cursor pagination** (Load more, not page numbers). Each row shows requester, colleague, shift, state and age.
- **Request detail** with the audit history, and a **rule preview**: which of the five rules currently pass or fail for the colleague, before the admin clicks approve. Approve and reject buttons with a note field. Rejected approvals show the API's message.
- **Department week summary** for a chosen Monday–Sunday week: one row per department with scheduled hours, filled vs total slots (e.g. `412 / 480`), and number of requests waiting for admin. Build it as **one aggregation pipeline**. It must return in under 300 ms on the full seed.

#### 6. Staff views

- **My shifts:** upcoming assigned shifts sorted by date, with a **Request swap** button on each, plus total hours scheduled for the current week.
- **New request:** pick the shift, search for a colleague (eligible people only, paginated), submit.
- **My requests:** two lists, sent and received, each showing state. Received requests in `pending_colleague` have accept and decline buttons; sent requests not yet decided have a cancel button. These lists must update without a page refresh after an action.
- Staff cannot see or call admin screens and endpoints, or other people's requests.

### Technical requirements

- **Stack:** MongoDB with Mongoose, Express, React (function components and hooks), Node.js. Vite is recommended for the client. Any UI library or plain CSS is fine; we are not grading looks.
- **Structure:** separate the API into layers (routes, controllers, services, models). The state transitions and the five roster rules live in their own modules that can be unit-tested without a database.
- **No unbounded lists.** Every list endpoint is paginated, with a default page size of 20 and a hard cap of 100 whatever the client asks for. The requests list and the colleague search use **cursor** pagination with a stable sort (`_id` as the tie-breaker). Nothing ever does `find({})` on shifts, assignments or requests and filters in JavaScript.
- **Indexes:** add the indexes your queries need and list each one in the README with the query it serves. Be ready to show `explain('executionStats')` for the requests list, the overlap check and the week summary: we expect an index scan with documents examined close to documents returned.
- **Validation and errors:** validate every input on the server (a schema library such as Zod or Joi is welcome). Return a consistent error shape such as `{ "message": "...", "code": "...", "details": [...] }` with correct status codes: 400 bad input, 401 not logged in, 403 not allowed, 404 not found, 409 state or concurrency conflict, 422 rule failed. Bad input must never cause a 500, and a 500 must never leak a stack trace or a raw database error.
- **Config:** use environment variables. Commit a `.env.example`, never real secrets.
- **Tests:** at least **8 automated tests** (Jest or Vitest; Supertest for API tests is welcome), including: the transition table (valid and invalid moves), each of the five roster rules with its edge case (back-to-back, licence expiring on the shift date, week boundary), and **one concurrency test** that fires two approvals of the same request at once and asserts exactly one succeeds.
- **Frontend basics:** protected routes by role, silent token refresh, loading and error states, forms that show validation errors, lists that update after an action without a full page reload.
- **Engineering decisions:** a section in the README with one short paragraph each on: how you model assignments and requests (embedded vs referenced, and why), how approval is made atomic, how you compute weeks and days given timezones, and what would break first at 10× the data.

### Bonus (optional, only after the core works)

- **Optimistic locking:** a `version` field on requests so a stale UI (showing an old state) gets a 409 instead of silently acting.
- **Rest rule:** staff need at least 10 hours between the end of one shift and the start of the next; add it as a sixth rule without touching the other five.
- **Expiry job:** a scheduled task that moves stale requests to `expired`, idempotent if run twice.
- Notifications: an in-app list of events for the user ("Priya accepted your request"), or an email stub that logs instead of sending.
- Docker Compose setup, or a deployed demo link.
- TypeScript on either side.

## Part 2: Debug the approval flow

A previous developer built a first version of the swap approval feature. It worked in their demo, but users have reported problems since. The three files are in the `part2` folder you were given and are reproduced below. They follow the same rules as Part 1. Assume `requireAuth` puts `{ id, role }` on `req.user`, and that models `SwapRequest`, `Shift`, `Assignment` and `Staff` exist with the fields named in Part 1.

Some of what users reported:

- "An approved swap removed the **wrong person** from the shift. Ravi was never part of the request."
- "Two of us approved the same request within a second. Now Priya is in that shift **twice** and the audit shows two approvals."
- "I opened **My requests** and every request people had sent me was accepted before I clicked anything."
- "Cancel always says *You can only cancel your own request*, even on my own request."
- "A night-shift nurse (22:00–06:00) was approved into an 05:00–13:00 shift the next morning."
- "The requests list keeps showing items I already saw when I click Load more."
- "Switching from Sent to Received sometimes shows the Sent list."

Not every bug has been reported. The bugs are of different kinds: crashes, logic that breaks the Part 1 rules, state-machine holes, concurrency, security, performance at volume, and React state. Some only show up with specific data or timing. We are not telling you how many there are.

```js
// server/routes/swapRequests.js
router.get('/swap-requests', requireAuth, requireRole('admin'), listRequests);
router.post('/swap-requests/:id/approve', requireAuth, approveRequest);
router.post('/swap-requests/:id/cancel', requireAuth, cancelRequest);
```

```js
// server/controllers/swapRequestController.js
const SwapRequest = require('../models/SwapRequest');
const Shift = require('../models/Shift');
const Assignment = require('../models/Assignment');
const Staff = require('../models/Staff');

const hoursBetween = (start, end) => (end - start) / 36e5;

exports.listRequests = async (req, res) => {
  const { cursor, limit = 20, ...filters } = req.query;
  const query = { ...filters };
  if (cursor) query._id = { $gt: cursor };

  const items = await SwapRequest.find(query)
    .limit(Number(limit))
    .populate('requester colleague shift');

  res.json({
    items,
    nextCursor: items.length ? items[items.length - 1]._id : null,
  });
};

exports.approveRequest = async (req, res) => {
  try {
    const request = await SwapRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    if (request.status === 'approved') {
      return res.status(409).json({ message: 'Request already approved' });
    }

    const shift = await Shift.findById(request.shift);
    const colleague = await Staff.findById(request.colleague);

    if (colleague.clinicalRole !== shift.requiredRole) {
      return res.status(422).json({ message: 'Colleague role does not match this shift' });
    }
    if (colleague.licenceExpiry < new Date()) {
      return res.status(422).json({ message: 'Colleague licence has expired' });
    }

    const dayStart = new Date(shift.start);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const sameDay = await Assignment.find({ staff: request.colleague }).populate({
      path: 'shift',
      match: { start: { $gte: dayStart, $lt: dayEnd } },
    });
    const clash = sameDay.some(
      (a) => a.shift && a.shift.start < shift.end && a.shift.end > shift.start
    );
    if (clash) {
      return res.status(422).json({ message: 'Colleague has an overlapping shift' });
    }

    const weekStart = new Date(shift.start);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekAssignments = await Assignment.find({ staff: request.requester }).populate({
      path: 'shift',
      match: { start: { $gte: weekStart, $lt: weekEnd } },
    });
    const weekHours = weekAssignments
      .filter((a) => a.shift)
      .reduce((sum, a) => sum + hoursBetween(a.shift.start, a.shift.end), 0);
    if (weekHours + hoursBetween(shift.start, shift.end) > 48) {
      return res.status(422).json({ message: 'Weekly hour limit exceeded' });
    }

    await Assignment.deleteOne({ shift: shift._id });
    await Assignment.create({ shift: shift._id, staff: request.colleague });

    request.status = 'approved';
    request.audit.push({
      by: req.user.id,
      at: new Date(),
      from: request.status,
      to: 'approved',
      note: req.body.note,
    });
    await request.save();

    res.json(request);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message, stack: err.stack });
  }
};

exports.cancelRequest = async (req, res) => {
  const request = await SwapRequest.findById(req.params.id);
  if (!request) {
    return res.status(404).json({ message: 'Request not found' });
  }
  if (request.requester !== req.user.id) {
    return res.status(403).json({ message: 'You can only cancel your own request' });
  }
  request.status = 'cancelled';
  request.audit.push({ by: req.user.id, at: new Date(), from: request.status, to: 'cancelled' });
  await request.save();
  res.json(request);
};
```

```jsx
// client/src/pages/MyRequests.jsx
import { useEffect, useState } from 'react';
import { api } from '../api';

export default function MyRequests() {
  const [tab, setTab] = useState('received');
  const [requests, setRequests] = useState([]);
  const [count, setCount] = useState(requests.length);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/me/swap-requests?box=${tab}`).then((res) => {
      setRequests(res.data.items);
    });
  }, []);

  const respond = async (id, action) => {
    setError('');
    try {
      const res = await fetch(`/api/swap-requests/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      const target = requests.find((r) => r._id === id);
      target.status = data.status;
      setRequests(requests);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="tabs">
        <button onClick={() => setTab('received')}>Received</button>
        <button onClick={() => setTab('sent')}>Sent</button>
      </div>
      <p>{count} requests</p>
      {error && <p className="error">{error}</p>}
      <ul>
        {requests.map((r) => (
          <li>
            {r.shift.department} {new Date(r.shift.start).toLocaleString()} — {r.status}
            {tab === 'received' && r.status === 'pending_colleague' && (
              <>
                <button onClick={respond(r._id, 'accept')}>Accept</button>
                <button onClick={() => respond(r._id, 'decline')}>Decline</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**What to deliver for Part 2:**

1. A `/debug` folder in your repo containing your fixed versions of all three files.
2. A `DEBUGGING.md` with a table listing every problem you found: the **symptom** (what a user or developer would see), the **root cause**, your **fix**, and for any performance problem **how it grows with data**.
3. Regression tests for at least **3** of the server-side bugs: tests that fail on the original code and pass on yours. One of them must be the concurrency bug.
4. Fix with the smallest clear change. Do not rewrite the files from scratch, and do not "fix" code that is already correct. Changing correct code counts against you.

## Working independently

- Once the test starts, we will not answer questions about how to build or fix anything. This brief is the spec. We will help with setup problems only (network, database, repo access).
- Some product decisions are deliberately left open. When you hit one, make a reasonable decision, keep going, and record it under **Assumptions** in your README with a one-line reason. Spotting these is part of the test.
- If you find something in the brief that is unclear or contradictory, note it in the README along with how you handled it.
- Read the whole brief before you write code. Get the core working before the extras: a correct lifecycle with re-validation and no summary page scores higher than everything half-done.

## Definition of done

Before you stop, every item below should be true. We check each one.

- [ ] A fresh clone runs by following only the README, including the seed.
- [ ] ESLint and Prettier are set up in both client and server, and `npm run lint` passes with no errors.
- [ ] `npm test` runs all tests with one command, and they pass.
- [ ] No errors or warnings in the browser console or the server log during normal use.
- [ ] No leftover `console.log` calls, commented-out code, unused files or unused dependencies.
- [ ] Every list endpoint is paginated and capped; nothing loads a whole collection.
- [ ] Every index you rely on is declared in the schema and listed in the README.
- [ ] Naming and folder structure are consistent across the project.
- [ ] Every failed API call shows a readable message in the UI. Nothing fails silently.
- [ ] Small, meaningful commits with clear messages, pushed before the 4-hour mark.

## AI usage policy

Use AI the way you would at work. We will not mark you down for using it. We will mark you down for submitting code you cannot explain.

Add an `AI_USAGE.md` file to the repo covering:

- Which tools you used and roughly what for.
- Which parts were mostly AI-generated and which you wrote or heavily changed yourself.
- **At least one example where the AI's output was wrong, insecure or a poor fit**, how you noticed, and what you did instead.
- Anything you deliberately did *not* use AI for, and why (optional).

You may also use AI during the live change in the review. You will be sharing your screen and talking us through what you are doing. The walkthrough part of the review is without AI.

## Submission

- Push to the GitHub repository we give you at the start, with `/client`, `/server` and `/debug` folders.
- **Commit as you go.** A single "initial commit" containing everything loses marks.
- A `README.md` with:
    - setup and run steps that work on a fresh machine;
    - environment variables (mirrored in `.env.example`);
    - the seed command and the admin and staff logins it creates;
    - how to run the tests;
    - the **Engineering decisions** section and the **Indexes** list described above;
    - what is done, what is not, and any assumptions or trade-offs you made.
- `AI_USAGE.md` and `DEBUGGING.md` as described above.
- Make sure the final push has landed before the 4-hour mark. We review what is on GitHub, not what is on the machine.

## How you'll be evaluated

The final decision combines the machine test (**60%**) and the review (**40%**), with a separate pass mark on the review: good code alone cannot pass. The machine test is scored out of 100:

| Area | Points | What we look for |
| --- | --- | --- |
| Part 1: lifecycle and re-validation | 20 | Transition table complete, every invalid move rejected, all five rules re-checked at approval with correct status codes and edge cases |
| Part 1: concurrency and data integrity | 10 | Double approval impossible, assignment moves atomically, audit always consistent |
| Part 1: data volume and performance | 15 | Cursor pagination with stable sort, capped limits, indexes that `explain()` confirms, week summary as one pipeline under 300 ms, rule checks on a time window |
| Part 2: debugging | 20 | Real bugs found and explained from symptom to root cause, small correct fixes, regression tests including the concurrency one, correct code left alone |
| Neatness and Definition of done | 10 | Every Definition of done item met; clean, consistent, readable code |
| React frontend | 10 | Role-based routes, silent refresh, state that updates after actions, loading and error states, usable forms |
| Auth and security | 5 | Refresh token flow correct, ownership enforced on the API, no secrets or hashes exposed, no operator injection |
| Independence and engineering decisions | 10 | Open decisions spotted, decided and recorded; README explains the why; honest about gaps; commits that tell a story |

Bonus items can add up to 10 extra points, capped at 100.

### The review (30 minutes)

1. **Walkthrough (10 min, no AI):** demo the app, then walk us through one approval from the button click to the database writes and back to the screen.
2. **"Why" questions (10 min):** about your own code. *Why this index field order? What exactly is in your cursor? Show me the query your weekly-hours check runs.*
3. **Live change (10 min, AI allowed):** we will ask you to make a small change to your own code, or track down a reported bug in it.

Have the project running locally before the review starts. Good luck!
