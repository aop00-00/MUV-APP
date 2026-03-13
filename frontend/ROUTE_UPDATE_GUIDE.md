# Route Update Guide: Implementing requireGymAuth

This guide shows you how to update all protected routes to use the new centralized gym validation middleware.

---

## Why Update Routes?

The new `gym.server.ts` provides three critical security functions:

1. **`requireGymAuth(request)`** - For all authenticated routes (dashboard, etc.)
2. **`requireGymAdmin(request)`** - For admin-only routes
3. **`requireGymCoach(request)`** - For coach/barista routes

These replace manual `requireAuth()` + `profile.gym_id` extraction, providing:
- Automatic gym_id validation
- Gym status checking (active/suspended/cancelled)
- Consistent error handling
- Security audit logging

---

## Pattern to Follow

### Before (Old Pattern - Insecure)

```typescript
import { requireAuth } from "~/services/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
    const profile = await requireAuth(request);
    const gymId = profile.gym_id ?? "fallback"; // ❌ Unsafe!

    // Use gymId in queries...
    const classes = await getClassesByDate(today, gymId);

    return json({ classes, profile });
}
```

**Problems:**
- Fallback values allow undefined behavior
- No validation that gym_id exists
- No check if gym is suspended/cancelled
- No security logging

### After (New Pattern - Secure)

```typescript
import { requireGymAuth } from "~/services/gym.server";

export async function loader({ request }: Route.LoaderArgs) {
    const { profile, gymId } = await requireGymAuth(request);
    // gymId is validated and guaranteed to exist ✅

    // Use gymId in queries...
    const classes = await getClassesByDate(today, gymId);

    return json({ classes, profile });
}
```

**Benefits:**
- `gymId` is guaranteed to exist (throws if missing)
- Gym is verified to be active
- Suspended gyms are blocked automatically
- Security events are logged

---

## Step-by-Step Update Process

### Step 1: Update Imports

**Find:**
```typescript
import { requireAuth } from "~/services/auth.server";
```

**Replace with:**
```typescript
import { requireGymAuth } from "~/services/gym.server";
// OR for admin routes:
import { requireGymAdmin } from "~/services/gym.server";
// OR for coach routes:
import { requireGymCoach } from "~/services/gym.server";
```

### Step 2: Update Loader/Action Function

**Find:**
```typescript
export async function loader({ request }: Route.LoaderArgs) {
    const profile = await requireAuth(request);
    const gymId = profile.gym_id; // or profile.gym_id ?? DEFAULT_GYM_ID
```

**Replace with:**
```typescript
export async function loader({ request }: Route.LoaderArgs) {
    const { profile, gymId } = await requireGymAuth(request);
```

### Step 3: Update Service Function Calls

**Before:**
```typescript
// These calls may have had DEFAULT_GYM_ID fallbacks
const classes = await getClassesByDate(date);
const bookings = await getUserBookings(profile.id);
```

**After:**
```typescript
// Now explicitly pass gymId (required parameter)
const classes = await getClassesByDate(date, gymId);
const bookings = await getUserBookings(profile.id, gymId);
```

### Step 4: Test the Route

1. Login as a user
2. Visit the updated route
3. Verify no errors
4. Check data is filtered correctly by gym_id

---

## Complete Example: Dashboard Schedule

### Before

**File:** `frontend/app/routes/dashboard/schedule.tsx`

```typescript
import type { Route } from "./+types/schedule";
import { json } from "react-router";
import { requireAuth } from "~/services/auth.server";
import { getClassesByDate, getUserBookings } from "~/services/booking.server";

export async function loader({ request }: Route.LoaderArgs) {
    const profile = await requireAuth(request);
    const today = new Date().toISOString().split("T")[0];

    // ❌ ISSUE: No gymId passed - uses DEFAULT_GYM_ID
    const classes = await getClassesByDate(today);
    const bookings = await getUserBookings(profile.id);

    return json({ classes, bookings, profile });
}

export async function action({ request }: Route.ActionArgs) {
    const profile = await requireAuth(request);
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "book") {
        const classId = formData.get("class_id") as string;
        // ❌ ISSUE: No gymId passed
        const result = await bookClass(classId, profile.id);
        return json(result);
    }

    return null;
}
```

### After

**File:** `frontend/app/routes/dashboard/schedule.tsx`

```typescript
import type { Route } from "./+types/schedule";
import { json } from "react-router";
import { requireGymAuth } from "~/services/gym.server"; // ✅ Updated import
import { getClassesByDate, getUserBookings, bookClass } from "~/services/booking.server";

export async function loader({ request }: Route.LoaderArgs) {
    const { profile, gymId } = await requireGymAuth(request); // ✅ Get validated gymId
    const today = new Date().toISOString().split("T")[0];

    // ✅ Pass gymId explicitly
    const classes = await getClassesByDate(today, gymId);
    const bookings = await getUserBookings(profile.id, gymId);

    return json({ classes, bookings, profile });
}

export async function action({ request }: Route.ActionArgs) {
    const { profile, gymId } = await requireGymAuth(request); // ✅ Get validated gymId
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "book") {
        const classId = formData.get("class_id") as string;
        // ✅ Pass gymId explicitly
        const result = await bookClass(classId, profile.id, gymId);
        return json(result);
    }

    return null;
}
```

---

## Routes to Update

### Dashboard Routes (Use `requireGymAuth`)

All routes in `frontend/app/routes/dashboard/`:

- [x] ✅ `_index.tsx` - Dashboard home
- [ ] `schedule.tsx` - Class schedule and bookings
- [ ] `store.tsx` - Gym store (products)
- [ ] `packages.tsx` - Membership packages
- [ ] `profile.tsx` - User profile settings
- [ ] `checkout/$packId.tsx` - Package checkout
- [ ] `fitcoins.tsx` - FitCoins gamification

### Admin Routes (Use `requireGymAdmin`)

All routes in `frontend/app/routes/admin/`:

- [ ] `_index.tsx` - Admin dashboard
- [ ] `schedule.tsx` - Schedule management
- [ ] `users.tsx` - User management
- [ ] `finance.tsx` - Financial reports
- [ ] `pos.tsx` - Point of sale
- [ ] `coaches.tsx` - Coach management
- [ ] `crm.tsx` - CRM leads
- [ ] `cupones.tsx` - Coupon management
- [ ] `events.tsx` - Event management
- [ ] `horarios.tsx` - Schedule configuration
- [ ] `ingresos.tsx` - Revenue tracking
- [ ] `nomina.tsx` - Payroll
- [ ] `operaciones.tsx` - Operations
- [ ] `pagos.tsx` - Payment management
- [ ] `periodos.tsx` - Period management
- [ ] `planes.tsx` - Membership plans
- [ ] `reservas.tsx` - Reservation management
- [ ] `studio.tsx` - Studio settings
- [ ] `subscriptions.tsx` - Subscription management
- [ ] `sustituciones.tsx` - Class substitutions
- [ ] `ubicaciones.tsx` - Location management

### Barista/Coach Routes (Use `requireGymCoach`)

All routes in `frontend/app/routes/barista/`:

- [ ] `_index.tsx` - Barista dashboard
- [ ] `products.tsx` - Product management

---

## Advanced: Resource Ownership Validation

For actions that modify resources (delete booking, update order, etc.), add ownership validation:

### Example: Cancel Booking with Validation

```typescript
import { requireGymAuth, validateGymOwnership } from "~/services/gym.server";
import { cancelBooking } from "~/services/booking.server";

export async function action({ request }: Route.ActionArgs) {
    const { profile, gymId } = await requireGymAuth(request);
    const formData = await request.formData();

    if (formData.get("intent") === "cancel_booking") {
        const bookingId = formData.get("booking_id") as string;

        // ✅ Validate booking belongs to user's gym
        const isValid = await validateGymOwnership("bookings", bookingId, gymId);
        if (!isValid) {
            return json(
                { error: "Reserva no encontrada" },
                { status: 404 }
            );
        }

        // Safe to proceed - booking is verified to belong to this gym
        const result = await cancelBooking(bookingId, profile.id, gymId);
        return json(result);
    }

    return null;
}
```

**Use `validateGymOwnership` for:**
- Deleting bookings, orders, memberships
- Updating classes, products, invoices
- Modifying user profiles (admin actions)

---

## Testing Checklist

After updating each route:

1. **Login as member** → Navigate to route → Verify data loads
2. **Check browser console** → No errors
3. **Check server logs** → No gym_id validation errors
4. **Test actions** → Submit forms, verify operations work
5. **Test cross-tenant** → Try accessing another gym's data (should fail)

---

## Common Issues

### Issue: "gymId is used before it is defined"

**Cause:** Forgot to destructure `gymId` from `requireGymAuth`
**Fix:**
```typescript
const { profile, gymId } = await requireGymAuth(request);
```

### Issue: "gymId is required for getClassesByDate"

**Cause:** Service function call missing gymId parameter
**Fix:**
```typescript
const classes = await getClassesByDate(date, gymId);
```

### Issue: Route throws 404 for all users

**Cause:** Using `requireGymAdmin` on a route that should be accessible to all members
**Fix:** Change to `requireGymAuth` instead:
```typescript
const { profile, gymId } = await requireGymAuth(request);
```

---

## Bulk Find & Replace

You can use these find/replace patterns in VS Code:

### Pattern 1: Import Update

**Find:**
```regex
import { requireAuth } from "~/services/auth\.server";
```

**Replace:**
```typescript
import { requireGymAuth } from "~/services/gym.server";
```

### Pattern 2: Loader Update

**Find:**
```regex
const profile = await requireAuth\(request\);
```

**Replace:**
```typescript
const { profile, gymId } = await requireGymAuth(request);
```

### Pattern 3: Admin Routes Import

For admin routes specifically:

**Find:**
```regex
import { requireAuth } from "~/services/auth\.server";
```

**Replace:**
```typescript
import { requireGymAdmin } from "~/services/gym.server";
```

**Find:**
```regex
const profile = await requireAuth\(request\);
```

**Replace:**
```typescript
const { profile, gymId } = await requireGymAdmin(request);
```

---

## Priority Update Order

Update routes in this order for fastest impact:

1. **High Priority** (Most Used):
   - `dashboard/_index.tsx`
   - `dashboard/schedule.tsx`
   - `admin/_index.tsx`
   - `admin/users.tsx`

2. **Medium Priority**:
   - `dashboard/profile.tsx`
   - `dashboard/packages.tsx`
   - `admin/schedule.tsx`
   - `admin/finance.tsx`

3. **Low Priority** (Less Frequently Used):
   - `dashboard/store.tsx`
   - `dashboard/fitcoins.tsx`
   - All other admin routes

---

## Verification Script

After updating all routes, run this to verify no DEFAULT_GYM_ID remains:

```bash
# Search for any remaining DEFAULT_GYM_ID usage
grep -r "DEFAULT_GYM_ID" frontend/app/routes/

# Should only find it in:
# - Comments explaining what was removed
# - This guide

# If found in actual code → still need to update that route
```

---

## Success Criteria

After completing all updates:

✅ All dashboard routes use `requireGymAuth`
✅ All admin routes use `requireGymAdmin`
✅ All barista routes use `requireGymCoach`
✅ All service function calls pass `gymId` parameter
✅ No `DEFAULT_GYM_ID` found in route files
✅ All tests pass (see TESTING_GUIDE.md)
✅ Security audit logging active

**Status:** Routes are production-ready and secure ✅
