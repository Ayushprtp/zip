# Flare.sh RBAC System

## Overview

Flare.sh uses a comprehensive Role-Based Access Control (RBAC) system with **three independent dimensions**:

1. **Role** → WHO the user is (authority)
2. **Account Type** → WHY they have special access (business relationship)
3. **Plan** → HOW MUCH they can use (limits & pricing)

These dimensions are **never mixed** and are fully composable.

---

## 1️⃣ Roles (Authority)

There are exactly **4 roles**:

| Role | Label | Description |
|------|-------|-------------|
| `super_admin` | Super Admin (Owner) | System owner with absolute control |
| `admin` | Admin | Trusted operator with management capabilities |
| `moderator` | Moderator | Safety and support helper |
| `user` | User | Default role for all users |

### Role Hierarchy

```
super_admin (OWNER)
    └── admin
        └── moderator
            └── user
```

### 👑 Super Admin (Owner)

There is **exactly one OWNER** in the system, identified by:
- `role = super_admin`
- `isOwner = true`

#### 🔒 ABSOLUTE OWNER RULES (NON-NEGOTIABLE)

If `isOwner = true`, the user:
- ❌ CANNOT be demoted
- ❌ CANNOT be removed
- ❌ CANNOT be deleted
- ❌ CANNOT remove their own super_admin role
- ❌ CANNOT disable themselves
- ❌ CANNOT transfer ownership accidentally

This applies even if:
- Another super_admin tries
- Multiple admins collude
- Frontend is manipulated
- API is called directly

**Ownership is immutable.**

### 🛠 Admin

Admins are trusted operators but NOT owners.

**Can:**
- Add/edit models/endpoints
- Enable/disable models
- View system usage stats
- Manage normal users
- Handle abuse cases

**Cannot:**
- Touch the owner
- Create or remove super_admins
- Change ownership
- Delete audit logs
- Change core billing rules

### 🧹 Moderator

Moderators are low-risk helpers.

**Can:**
- View user activity
- Flag abuse
- Temporarily restrict users
- Review prompts/outputs/conversations
- View limited stats

**Cannot:**
- Modify models
- Change pricing
- Manage admins
- Access sensitive system settings

### 👤 User

All users start as `user`.

**Can:**
- Use AI models/console features
- Spend credits/tokens
- View their own history
- Manage their own profile

**Cannot:**
- Access admin routes
- Escalate privileges
- Modify other users
- View internal data

---

## 2️⃣ Account Type (Business Context)

Account type defines **WHY** someone has special access. It is **NOT a role**.

| Type | Description |
|------|-------------|
| `normal` | Standard user account |
| `partner` | Business partner with special access |

### 🤝 Partner Account Type

Partners are **business users, not staff**.

Rules:
- `role` remains `user`
- `accountType = partner`
- No admin panel access
- No management privileges

Partners receive:
- Access to partner-only models/features
- Possibly custom pricing or contracts
- Possibly beta/private models/endpoints

Partners do NOT receive:
- Authority
- Moderation powers
- Admin UI

### Partner-Only Models

Each AI model can have:
```typescript
isPartnerOnly: boolean
```

Access logic:
```typescript
if (model.isPartnerOnly) {
  // Only accessible by:
  // - Users with accountType = "partner"
  // - Admins and super_admin
}
```

---

## 3️⃣ Plan (Usage Limits)

Plans define **HOW MUCH** a user can use. They do NOT affect authority.

| Plan | Description |
|------|-------------|
| `free` | Basic tier with limited usage |
| `premium` | Enhanced tier with higher limits |
| `enterprise` | Maximum tier with dedicated resources |

### Plan Limits

| Limit | Free | Premium | Enterprise |
|-------|------|---------|------------|
| Credits/month | 1,000 | 10,000 | Unlimited |
| RPM | 5 | 20 | 100 |
| RPD | 100 | 1,000 | Unlimited |
| Concurrent | 1 | 5 | 20 |
| Session Length | 30 min | 2 hrs | Unlimited |
| Priority Queue | ❌ | ✅ | ✅ |
| SLA | ❌ | ❌ | ✅ |

### 🏢 Enterprise Users

Enterprise users are:
- `role = user`
- `plan = enterprise`

They are **NOT a new role**. Enterprise differences are purely about limits and resources.

---

## 4️⃣ Invite-Based Privileged Access

All privileged roles (`admin`, `moderator`) are:
- **Invite-only**
- **One-time use**
- **Expiry-based**
- **Logged**

Rules:
- No self-promotion
- No open admin signup
- Only super_admin can create invites
- Used invites cannot be reused

---

## 5️⃣ System Invariants

These rules **MUST ALWAYS HOLD TRUE**:

1. There is always at least one super_admin
2. The owner (`isOwner = true`) cannot be removed or demoted
3. Roles cannot be escalated without authorization
4. Account type does NOT grant authority
5. Plans do NOT grant authority
6. Frontend restrictions are NOT trusted — backend enforces everything
7. All admin actions must be auditable

---

## 6️⃣ Database Schema

### User Table Fields

```sql
-- RBAC System - Three Independent Dimensions
role VARCHAR NOT NULL DEFAULT 'user'
  CHECK (role IN ('super_admin', 'admin', 'moderator', 'user'))

account_type VARCHAR NOT NULL DEFAULT 'normal'
  CHECK (account_type IN ('normal', 'partner'))

plan VARCHAR NOT NULL DEFAULT 'free'
  CHECK (plan IN ('free', 'premium', 'enterprise'))

is_owner BOOLEAN NOT NULL DEFAULT false
```

### Invite Token Table

```sql
CREATE TABLE invite_token (
  id UUID PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  target_role VARCHAR NOT NULL,
  assign_partner BOOLEAN DEFAULT false,
  created_by UUID REFERENCES user(id),
  restrict_to_email TEXT,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  used_by UUID REFERENCES user(id),
  created_at TIMESTAMP DEFAULT NOW(),
  note TEXT
);
```

### Audit Log Table

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  actor_id UUID REFERENCES user(id),
  actor_role VARCHAR NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);
```

---

## 7️⃣ Usage Examples

### Check if user can access partner feature

```typescript
import { canAccessPartnerFeatures } from "@/types/roles";

if (canAccessPartnerFeatures(user.role, user.accountType)) {
  // Show partner-only content
}
```

### Require admin access in API route

```typescript
import { requireAdmin } from "@/lib/auth/rbac-guards";

export async function POST(request: Request) {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user; // Error response
  
  // User is admin or super_admin
}
```

### Validate owner protection

```typescript
import { validateOwnerProtection } from "@/lib/auth/rbac-guards";

try {
  validateOwnerProtection(targetUser, "delete");
  // Proceed with deletion
} catch (error) {
  // Owner protection triggered
}
```

---

## 8️⃣ Mental Model

```
Role = WHO you are (authority)
Account Type = WHY you get special access (business relationship)
Plan = HOW MUCH you can use (limits & pricing)
```

**Never mix these.**

---

## File Locations

| File | Purpose |
|------|---------|
| `src/types/roles.ts` | Role, Account Type, Plan definitions |
| `src/types/user.ts` | User type with RBAC fields |
| `src/lib/db/pg/schema.pg.ts` | User table with RBAC columns |
| `src/lib/db/pg/schema-rbac.pg.ts` | Invite tokens & audit logs |
| `src/lib/auth/rbac-guards.ts` | Backend enforcement guards |
| `docs/RBAC_SYSTEM.md` | This documentation |
