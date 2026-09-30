# KidCare Family Sharing (invite by email) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The family owner invites their partner by Gmail address in Settings; when the partner signs in with Google using that email they join the family automatically (or via a banner if they already have their own family) and get full view/edit access. The owner can cancel invites and remove members.

**Architecture:** A new top-level collection `invites/{emailLower}` `{ familyId, familyName, invitedBy, email, createdAt }` (one pending invite per email, doc id = lowercase email). Security rules let the invitee read/delete their own invite (by verified token email) and let an invitee add **only themselves** to `families/{fid}.memberUids` when an invite for that family exists. Family doc gains `memberProfiles: { [uid]: { name, email } }` for display. `ensureFamily` is restructured: verify membership of the stored family (clear it if access was revoked), otherwise accept a pending invite, otherwise create a new family.

**Tech Stack:** existing (Firebase JS SDK 10, Firestore rules + emulator tests, React, Vitest, zod).

## Global Constraints

- Partner has the same permissions as the owner for children/vaccines/appointments; only the **owner** can invite, cancel invites, and remove members; nobody can change `ownerUid`; the owner can never be removed.
- An invite is accepted only if `request.auth.token.email_verified == true` and the lowercase token email equals the invite doc id.
- Emails are stored lowercase and trimmed.
- UI text Thai; Firestore writes in UI are fire-and-forget via `fire()` except the join flow and `ensureFamily` (must await).
- Existing data must keep working: families created before this change have no `memberProfiles` — code and rules must treat it as `{}`.
- Rules tests run with: `export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-25.0.4.101-hotspot"; export PATH="$JAVA_HOME/bin:$PATH"; npm run test:rules`.

---

### Task 1: Security rules + emulator tests

**Files:**
- Modify: `firestore.rules`, `tests/rules/firestore.rules.test.ts`

- [ ] **Step 1: Write the failing tests** — append to `tests/rules/firestore.rules.test.ts` (reuse the existing `env`, seed `fam1` owner `alice` members `["alice","bob"]`; add helpers below). Existing tests must keep passing (the member-update test that changes `name` still must pass).

```ts
const asUser = (uid: string, email: string, verified = true) =>
  env.authenticatedContext(uid, { email, email_verified: verified }).firestore();

describe("invites", () => {
  test("owner creates invite for own family; non-owner member cannot", async () => {
    await assertSucceeds(setDoc(doc(asUser("alice", "alice@x.com"), "invites", "zoe@x.com"), { familyId: FID, familyName: "F", invitedBy: "alice", email: "zoe@x.com" }));
    await assertFails(setDoc(doc(asUser("bob", "bob@x.com"), "invites", "yan@x.com"), { familyId: FID, familyName: "F", invitedBy: "bob", email: "yan@x.com" }));
  });
  test("invite doc id must equal email field and invitedBy must be caller", async () => {
    await assertFails(setDoc(doc(asUser("alice", "alice@x.com"), "invites", "zoe@x.com"), { familyId: FID, familyName: "F", invitedBy: "alice", email: "other@x.com" }));
    await assertFails(setDoc(doc(asUser("alice", "alice@x.com"), "invites", "zoe@x.com"), { familyId: FID, familyName: "F", invitedBy: "bob", email: "zoe@x.com" }));
  });
  test("cannot overwrite an existing invite", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "invites", "zoe@x.com"), { familyId: "fam2", familyName: "C", invitedBy: "carol", email: "zoe@x.com" });
    });
    await assertFails(setDoc(doc(asUser("alice", "alice@x.com"), "invites", "zoe@x.com"), { familyId: FID, familyName: "F", invitedBy: "alice", email: "zoe@x.com" }));
  });
  test("invitee (verified) and inviter can read; others and unverified cannot", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "invites", "zoe@x.com"), { familyId: FID, familyName: "F", invitedBy: "alice", email: "zoe@x.com" });
    });
    await assertSucceeds(getDoc(doc(asUser("zoe", "Zoe@X.com"), "invites", "zoe@x.com")));
    await assertSucceeds(getDoc(doc(asUser("alice", "alice@x.com"), "invites", "zoe@x.com")));
    await assertFails(getDoc(doc(asUser("zoe", "zoe@x.com", false), "invites", "zoe@x.com")));
    await assertFails(getDoc(doc(asUser("mallory", "m@x.com"), "invites", "zoe@x.com")));
    // reading a non-existent own invite is allowed (returns not found)
    await assertSucceeds(getDoc(doc(asUser("yan", "yan@x.com"), "invites", "yan@x.com")));
  });
  test("inviter lists own invites", async () => {
    await assertSucceeds(getDocs(query(collection(asUser("alice", "alice@x.com"), "invites"), where("invitedBy", "==", "alice"))));
  });
  test("invitee or inviter can delete; others cannot", async () => {
    const seed = async () => env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "invites", "zoe@x.com"), { familyId: FID, familyName: "F", invitedBy: "alice", email: "zoe@x.com" });
    });
    await seed();
    await assertFails(deleteDoc(doc(asUser("mallory", "m@x.com"), "invites", "zoe@x.com")));
    await assertSucceeds(deleteDoc(doc(asUser("zoe", "zoe@x.com"), "invites", "zoe@x.com")));
    await seed();
    await assertSucceeds(deleteDoc(doc(asUser("alice", "alice@x.com"), "invites", "zoe@x.com")));
  });
});

describe("joining a family by invite", () => {
  const invite = async (email = "zoe@x.com", familyId = FID) => env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "invites", email), { familyId, familyName: "F", invitedBy: "alice", email });
  });
  const join = (db: ReturnType<typeof asUser>, uid: string) =>
    updateDoc(doc(db, "families", FID), { memberUids: arrayUnion(uid), [`memberProfiles.${uid}`]: { name: "Zoe", email: "zoe@x.com" } });

  test("invited user adds only themselves", async () => {
    await invite();
    await assertSucceeds(join(asUser("zoe", "zoe@x.com"), "zoe"));
    await assertSucceeds(getDoc(doc(asUser("zoe", "zoe@x.com"), "families", FID, "children", "c1")));
  });
  test("without invite, or unverified email, or invite for another family → denied", async () => {
    await assertFails(join(asUser("zoe", "zoe@x.com"), "zoe"));
    await invite("zoe@x.com", "fam2");
    await assertFails(join(asUser("zoe", "zoe@x.com"), "zoe"));
    await invite();
    await assertFails(join(asUser("zoe", "zoe@x.com", false), "zoe"));
  });
  test("invitee cannot add someone else, change name/owner, or touch other profiles", async () => {
    await invite();
    const db = asUser("zoe", "zoe@x.com");
    await assertFails(updateDoc(doc(db, "families", FID), { memberUids: arrayUnion("mallory") }));
    await assertFails(updateDoc(doc(db, "families", FID), { memberUids: arrayUnion("zoe"), name: "hacked" }));
    await assertFails(updateDoc(doc(db, "families", FID), { memberUids: arrayUnion("zoe"), "memberProfiles.bob": { name: "x", email: "x" } }));
    await assertFails(updateDoc(doc(db, "families", FID), { memberUids: ["alice", "zoe"] }));
  });
  test("invitee can read nothing in the family before joining", async () => {
    await invite();
    await assertFails(getDoc(doc(asUser("zoe", "zoe@x.com"), "families", FID)));
  });
});

describe("members and profiles", () => {
  test("non-owner member may edit name and own profile only", async () => {
    const db = asUser("bob", "bob@x.com");
    await assertSucceeds(updateDoc(doc(db, "families", FID), { "memberProfiles.bob": { name: "Bob", email: "bob@x.com" } }));
    await assertFails(updateDoc(doc(db, "families", FID), { "memberProfiles.alice": { name: "x", email: "x" } }));
  });
  test("owner removes a member; removed member loses access; owner cannot remove self", async () => {
    await assertSucceeds(updateDoc(doc(asUser("alice", "alice@x.com"), "families", FID), { memberUids: ["alice"] }));
    await assertFails(getDoc(doc(asUser("bob", "bob@x.com"), "families", FID, "children", "c1")));
    await assertFails(updateDoc(doc(asUser("alice", "alice@x.com"), "families", FID), { memberUids: [] }));
  });
});
```

Add to the file's imports as needed: `arrayUnion`, `deleteDoc`, `where`, `query`, `collection`, `getDocs`, `updateDoc` from `firebase/firestore`.

- [ ] **Step 2: Run** `npm run test:rules` — new tests fail (no `invites` rules / join branch).

- [ ] **Step 3: Replace the `families` update rule and add `invites`** in `firestore.rules`:

```
    function verifiedEmail() {
      return request.auth.token.email_verified == true ? request.auth.token.email.lower() : "";
    }
    function ownProfileOnly() {
      return request.resource.data.get('memberProfiles', {})
        .diff(resource.data.get('memberProfiles', {}))
        .affectedKeys().hasOnly([request.auth.uid]);
    }
    function hasInviteFor(fid) {
      let path = /databases/$(database)/documents/invites/$(verifiedEmail());
      return verifiedEmail() != "" && exists(path) && get(path).data.familyId == fid;
    }

    match /families/{fid} {
      allow create: if signedIn()
        && request.resource.data.ownerUid == request.auth.uid
        && request.resource.data.memberUids == [request.auth.uid];
      allow read: if signedIn() && request.auth.uid in resource.data.memberUids;
      allow update: if signedIn()
        && request.resource.data.ownerUid == resource.data.ownerUid
        && (
          // owner: anything, but must stay a member and memberUids stays a list
          (request.auth.uid == resource.data.ownerUid
            && request.resource.data.memberUids is list
            && resource.data.ownerUid in request.resource.data.memberUids)
          // other member: name + own profile only
          || (request.auth.uid in resource.data.memberUids
            && request.auth.uid != resource.data.ownerUid
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name', 'memberProfiles'])
            && ownProfileOnly())
          // invited user joining: add only self (+ own profile)
          || (!(request.auth.uid in resource.data.memberUids)
            && hasInviteFor(fid)
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['memberUids', 'memberProfiles'])
            && request.resource.data.memberUids == resource.data.memberUids.concat([request.auth.uid])
            && ownProfileOnly())
        );
      allow delete: if false;
      // (appointments / children sub-matches unchanged)
    }

    match /invites/{email} {
      allow read: if signedIn() && (verifiedEmail() == email || resource.data.invitedBy == request.auth.uid);
      allow create: if signedIn()
        && request.resource.data.invitedBy == request.auth.uid
        && request.resource.data.email == email
        && get(/databases/$(database)/documents/families/$(request.resource.data.familyId)).data.ownerUid == request.auth.uid;
      allow delete: if signedIn() && (verifiedEmail() == email || resource.data.invitedBy == request.auth.uid);
      allow update: if false;
    }
```

Keep the `appointments` and `children` sub-matches inside `families/{fid}` exactly as they are. Note `resource.data.get('memberProfiles', {})` handles old family docs without the field. If the emulator rejects a construct (e.g. `let` inside a function on this emulator version), rewrite equivalently and note it.

- [ ] **Step 4: Run** `npm run test:rules` — all old and new tests pass.
- [ ] **Step 5: Commit** `feat(rules): invite-by-email and member profiles`.

---

### Task 2: Types, repo functions, ensureFamily, hooks

**Files:**
- Modify: `src/types/index.ts`, `src/lib/repo/family.ts`, `src/lib/paths.ts`, `src/hooks/data.ts` (or new `src/hooks/family.ts`)
- Create: `src/domain/email.ts`, `src/domain/email.test.ts`

**Interfaces (produced):**
- `Family` gains `memberProfiles?: Record<string, { name: string; email: string }>`.
- `Invite { id: string /* email */; familyId: string; familyName: string; invitedBy: string; email: string }`.
- `normalizeEmail(s: string): string` (trim + lowercase); `isValidEmail(s: string): boolean` (zod `.email()`).
- `inviteDoc(email)`, `invitesCol()` in `paths.ts`.
- `inviteMember(fid, familyName, ownerUid, email): void` — `setDoc(inviteDoc(e), { familyId, familyName, invitedBy: ownerUid, email: e, createdAt: serverTimestamp() })` via `fire(p, "เชิญไม่สำเร็จ (อีเมลนี้อาจมีคำเชิญค้างอยู่แล้ว)")`.
- `cancelInvite(email): void` — deleteDoc via fire.
- `removeMember(fid, uid): void` — `updateDoc(familyDoc(fid), { memberUids: arrayRemove(uid), [\`memberProfiles.${uid}\`]: deleteField() })` via fire.
- `joinFamily(user: User, familyId: string): Promise<void>` — awaited `writeBatch`: family update `{ memberUids: arrayUnion(uid), memberProfiles.<uid>: { name, email } }`, `users/{uid}` set `{ familyId, displayName, email }` merge, delete `invites/{email}`; also clear the localStorage family cache for this uid (`familyCacheKey`).
- `ensureFamily(user)` keeps signature/in-flight dedupe; new logic:
  1. `getDoc(users/{uid})` → if `familyId`: `getDoc(families/{fid})`; success → backfill own `memberProfiles` entry if missing (fire, don't await) and return fid; `permission-denied` → `setDoc(userRef, { familyId: deleteField() }, { merge: true })` and continue; other errors → rethrow.
  2. If `user.emailVerified && user.email`: `getDoc(inviteDoc(normalizeEmail(email)))` (errors → treat as none); exists → `await joinFamily(user, invite.familyId)`; return it.
  3. Else create a new family in the existing transaction, now also writing `memberProfiles: { [uid]: { name, email } }`.
- Hooks: `useFamily(fid)` (document), `useMyInvite(user)` → `useDocument<Invite>` of `inviteDoc(normalizeEmail(user.email))` when `user?.emailVerified && user.email`, else null ref; `useSentInvites(uid)` → `useCollection<Invite>(query(invitesCol(), where("invitedBy","==",uid)))`.

- [ ] **Step 1: TDD `src/domain/email.ts`** with tests: `normalizeEmail("  Zoe@Gmail.COM ")` → `"zoe@gmail.com"`; `isValidEmail("zoe@gmail.com")` true; `"zoe"`, `""`, `"a@b"` false.
- [ ] **Step 2: Implement repo/types/paths/hooks as specified.**
- [ ] **Step 3:** `npx tsc -b && npm test && npm run build` clean. (Rules unchanged here.)
- [ ] **Step 4: Commit** `feat(family): invites, join flow, member profiles, revoked-access recovery`.

---

### Task 3: Settings UI, invitation banner, README

**Files:**
- Modify: `src/pages/Settings.tsx`, `src/components/Layout.tsx`, `README.md`
- Create: `src/components/FamilyMembers.tsx`, `src/components/InviteBanner.tsx`

**FamilyMembers** (rendered in Settings under the family name):
- Section "สมาชิกครอบครัว": one row per `memberUids` uid: name/email from `memberProfiles` (fallback `สมาชิก …{last 4 of uid}`), tag "เจ้าของ" for `ownerUid`, "คุณ" for current user. Owner sees a remove button (not on own row) → `confirm("นำ {name} ออกจากครอบครัว? เขาจะดูข้อมูลลูกไม่ได้อีก")` → `removeMember`.
- Owner only: "เชิญแฟน/สมาชิก": `<form>` with labeled email input (`htmlFor`/`id`), submit "เชิญ" → validate with `isValidEmail` (error `role="alert"`: "รูปแบบอีเมลไม่ถูกต้อง"); reject if the email already belongs to a member profile ("อีเมลนี้เป็นสมาชิกอยู่แล้ว") → `inviteMember`; clear input. Help text: "ให้คนที่เชิญเปิด https://kidcare-2w.web.app แล้วเข้าสู่ระบบด้วย Google อีเมลนี้ ระบบจะพาเข้าครอบครัวอัตโนมัติ".
- Owner only: "คำเชิญที่รออยู่" from `useSentInvites(ownerUid)` filtered by `familyId === fid`: email + "ยกเลิก" (`cancelInvite`); empty → hidden.
- Non-owner: members list only (no invite/remove controls).

**InviteBanner** (in `Layout` above `<Outlet />`): uses `useAuth()` + `useMyInvite(user)` + current `familyId` from `useFamilyStore`; if an invite exists and `invite.familyId !== familyId`, show an amber card: "คุณได้รับเชิญเข้าครอบครัว “{familyName}”" with button "เข้าร่วม" → `confirm("ย้ายไปใช้ครอบครัว “{familyName}”? ข้อมูลในครอบครัวปัจจุบันของคุณจะไม่ถูกย้ายไปด้วย")` → `await joinFamily(user, invite.familyId)`; then `setFamilyId(invite.familyId)`, write the localStorage cache (`familyCacheKey(user.uid)`), navigate to `/`. Show errors in the banner (`role="alert"`). Hidden while loading.

**README:** replace the manual "เพิ่มแฟน/สมาชิกเข้าครอบครัว" section with the in-app steps (Settings → เชิญด้วยอีเมล → partner signs in with that Google account → joins automatically; if they already used the app, they tap "เข้าร่วม" on the banner). Keep a one-line note that the Console method is no longer needed.

- [ ] **Step 1:** Implement components + wiring + README.
- [ ] **Step 2:** `npx tsc -b && npm test && npm run build` clean.
- [ ] **Step 3: Commit** `feat(ui): invite members by email, invitation banner`.
- [ ] **Step 4 (controller):** deploy rules to `kidcare-2w` **before** shipping the UI (ask user), browser-check Settings as owner; the real partner test is done by the user.

---

## Addendum (security review, 2026-09-30) — supersedes conflicting text above

Findings: (1) any user could own a throwaway family and plant `invites/{victimEmail}`; with auto-join the victim's data would land in the attacker's family; one-slot-per-email also let attackers block real invites. (2) a removed member could rejoin with an undeleted invite. (3) profile contents/invite fields unvalidated.

Changes:
- **No auto-join.** A user without a family who has pending invites sees a choice screen (each invite shows the inviter's verified email + family name → "เข้าร่วม", plus "สร้างครอบครัวของฉันเอง"). Users with a family see the banner; joining always asks for confirmation.
- **Invite id = `${familyId}_${emailLower}`**, fields exactly `{ familyId, familyName, invitedBy, inviterEmail, email, createdAt }`; create requires: caller owns the family, `inviterEmail == caller's verified email`, `familyName == family.name`, email lowercase + basic format + ≤254 chars, `createdAt == request.time`, keys hasOnly those six.
- Invitee finds invites with `where("email","==", myVerifiedEmailLower)`; read rule `resource.data.email == verifiedEmail() || resource.data.invitedBy == uid`.
- **Join rule** requires the invite `${fid}_${verifiedEmail}` to exist, be < 14 days old (`createdAt > request.time - duration.value(14,'d')`) and be **deleted in the same batch** (`!existsAfter(...)`).
- **Profile validation** for non-owner/joiner writes: `memberProfiles[uid]` keys hasOnly name/email, `email == verifiedEmail()`, `name is string && size <= 100`. Non-owner `name` change: string ≤ 60.
- Client: `ensureFamily` split into `resolveFamily(user): Promise<string|null>` (membership check + stale clear) and `createFamily(user)`; `RequireFamily` orchestrates resolve → invites choice → create.
