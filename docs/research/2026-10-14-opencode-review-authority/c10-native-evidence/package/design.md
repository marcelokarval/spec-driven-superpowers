# Synthetic design and interface I-EXPORT-1

## Status and future inspection

This is a complete fixture interface decision, not a report of existing application
code. No application repo/API was inspected. Before any future implementation, the
assigned consumer must inspect its authorized target's auth principal and order-read
API. If the required ownership/read-only adapter cannot be provided within this
contract, stop and request explicit Stage-2 revision. Do not implement new auth or
pretend these modules/routes already exist. No production routes are selected here.

## Ownership and error contract

The future module src/export-own-orders.mjs exposes exportOwnOrders({principal,query},
{orders}). principal is supplied ONLY by the existing trusted authentication adapter;
principal.id is required. Missing/invalid principal -> HTTP-shaped response 401,
empty error-safe body, no orders read. query defaults to {}; any ownerId or userId
property -> 400 before repository access (reject, never ignore a requested foreign
owner). No public arbitrary filtering, owner override or pagination is introduced.
Call only orders.listByOwner({ownerId:principal.id}); the injected read adapter must
apply the predicate at data access, before any pagination/serialization. No unscoped
list-all fallback is permitted. Two-owner mocks must assert exact adapter call and
prove that a foreign row cannot enter output. A defensive owner equality check before
serialization fails the whole request generically if a malicious/broken adapter
returns a foreign row; do not silently serialize or conceal the adapter defect.
Read/validation failure -> 500 with generic error body and no order payload/PII.
All non-200 responses have no downloadable CSV/Content-Disposition.

## CSV byte contract

The allowlist/order is order_id,created_at,status,total_minor,currency. Header bytes:
order_id,created_at,status,total_minor,currency\r\n (literal CRLF on output, no BOM).
Zero rows -> exactly the header. Nonempty rows sort ascending by created_at then
order_id, neither source mutation nor locale-dependent ordering. Encode UTF-8; quote
ALL data cells with double quotes; embedded double quotes double; comma/CR/LF remain
inside the quoted field; terminate each row with CRLF. created_at is an ISO UTC string;
total_minor is a nonnegative safe integer rendered decimal, never locale-formatted;
currency is an uppercase three-letter code. Invalid required shape -> generic 500,
never partial leaking output. Project only the five allowed fields, not owner ID,
customer email/address, credentials or payment details.
For any textual cell, if after initial ASCII spaces its first character is =,+,-,@,
TAB or CR, prefix a single apostrophe to the ORIGINAL text before CSV quoting. This
fixture deliberately specifies the strategy; task 0001 freezes cases for direct and
space-prefixed formulas, tabs, commas, quotes, Unicode and multiline text. Numeric
safe nonnegative total_minor is separately typed, not spreadsheet-evaluated input.
The same module exports serializeOrdersCsv for isolated contract tests; the handler
still enforces ownership before passing rows to it.

## Backend/UI shared mock interface (frozen by task 0001)

requestExport() takes NO owner argument and resolves {status,headers,body}. A success
is {status:200,headers:{'content-type':'text/csv; charset=utf-8',
'content-disposition':'attachment; filename="own-orders.csv"'},body:csvString}.
The backend facade maps exportOwnOrders's result to this same shape; task 0003 can
mock it before task 0002 exists. Error/denied responses follow the shape above without
download headers; rejected Promise models transport failure. Any actual fetch/auth
transport wiring is a future target-adapter concern, not an assumed endpoint here.

src/order-export-ui.mjs exposes createOrderExportController({requestExport,
saveDownload,announce,onState}). Its export() action guards idle/error/success ->
loading, suppresses duplicate submission while loading, calls requestExport without
owner IDs and saveDownload({filename:'own-orders.csv',contentType,body}) only for valid
200 CSV. It announces loading and exactly one success/empty/denied/error outcome,
updates an onState payload that drives an accessible disabled/busy action and live
status region, and restores enabled/nonbusy state in every terminal path. Empty
success means body exactly equals the header. Denied or unexpected content type,
400/500 or transport failure never calls saveDownload. No private rows/PII in messages
or telemetry. A browser/DOM view may consume this state interface in its authorized
target; no framework, styling redesign, new package or existing component is claimed.

## Verification strategy (future, NOT RUN)

Task 0001 tests only the declarative contract fixtures/expected strings, not a backend
that does not yet exist. Task 0002 tests handler/serializer using A/B mocks, trusted
principal, malicious override and broken adapter. Task 0003 tests UI transitions with
I-EXPORT-1 mocks independently. Task 0004 wires the actual future modules using
read-only fixtures and asserts end-to-end own-only bytes, no-save denial, all UI
outcomes, immutable fixture inputs, and unchanged existing listing invocation.
If integration finds a predecessor defect, report it to that leaf; do not edit its
files from task 0004. Node built-in test/assert are sufficient in the synthetic target;
commands listed in tasks are future acceptance instructions, not performed here.

## Exact synthetic row/state adapter types

I-ORDER-ROW-1 is {ownerId:string,order_id:string,created_at:string,status:string,
total_minor:number,currency:string,...ignoredFields}. ownerId must equal principal.id
for every row before serialization; it is internal validation metadata and NEVER a
CSV column. A future actual-target adapter must map its existing read model into
this shape or stop for Stage-2 revision; this document does not claim it exists.
UI onState emits {phase:idle|loading|success|empty|denied|error,busy:boolean,
disabled:boolean,message:string}; only loading has busy/disabled true. announce
receives the same safe message, never row values. The initial state is idle and
every terminal outcome is nonbusy/enabled. This freezes the shared mocks in 0001.
