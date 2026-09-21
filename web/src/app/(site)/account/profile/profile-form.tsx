"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { profileSchema, type ProfileInput } from "@/lib/validation/schemas";
import { updateProfileAction } from "@/lib/auth/profile-actions";
import { Field, inputClass } from "@/components/forms/field";
import { useToast } from "@/components/ui/toast-provider";

// Ported from Views/Account/Profile.cshtml.
export function ProfileForm({ initial }: { initial: ProfileInput & { email: string } }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<ProfileInput>(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = profileSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = await updateProfileAction(parsed.data);
      if (result.success) {
        toast.success(result.message ?? "Profile updated.");
      } else {
        toast.error(result.message ?? "Could not update your profile.");
        if (result.fieldErrors) setErrors(result.fieldErrors);
      }
    });
  }

  return (
    <div className="container py-5">
      <div className="row g-4">
        <div className="col-lg-8">
          <div className="panel">
            <div className="panel-header">My Details</div>
            <div className="panel-body">
              <p className="small text-muted-wood">
                This address is filled in automatically at checkout, so you do not have to type it every time.
              </p>

              <form onSubmit={handleSubmit} noValidate>
                <div className="row g-3">
                  <div className="col-md-6">
                    <Field label="Full Name" htmlFor="fullName" error={errors.fullName?.[0]} className="">
                      <input
                        id="fullName"
                        className={inputClass}
                        maxLength={100}
                        value={values.fullName}
                        onChange={(e) => setValues((v) => ({ ...v, fullName: e.target.value }))}
                      />
                    </Field>
                  </div>

                  <div className="col-md-6">
                    <label htmlFor="email" className="form-label">
                      Email
                    </label>
                    <input id="email" className={inputClass} readOnly disabled value={initial.email} />
                    <span className="small text-muted-wood">Contact us if you need to change your email address.</span>
                  </div>

                  <div className="col-md-6">
                    <Field label="Phone Number" htmlFor="phoneNumber" error={errors.phoneNumber?.[0]} className="">
                      <input
                        id="phoneNumber"
                        type="tel"
                        className={inputClass}
                        maxLength={20}
                        value={values.phoneNumber}
                        onChange={(e) => setValues((v) => ({ ...v, phoneNumber: e.target.value }))}
                      />
                    </Field>
                  </div>

                  <div className="col-12">
                    <label htmlFor="address" className="form-label">
                      Address
                    </label>
                    <textarea
                      id="address"
                      rows={2}
                      className={inputClass}
                      placeholder="House or flat number, street, area"
                      value={values.address}
                      onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))}
                    />
                    {errors.address?.[0] && <span className="field-validation-error">{errors.address[0]}</span>}
                  </div>

                  <div className="col-md-5">
                    <label htmlFor="city" className="form-label">
                      City
                    </label>
                    <input
                      id="city"
                      className={inputClass}
                      value={values.city}
                      onChange={(e) => setValues((v) => ({ ...v, city: e.target.value }))}
                    />
                    {errors.city?.[0] && <span className="field-validation-error">{errors.city[0]}</span>}
                  </div>

                  <div className="col-md-4">
                    <label htmlFor="state" className="form-label">
                      State
                    </label>
                    <input
                      id="state"
                      className={inputClass}
                      value={values.state}
                      onChange={(e) => setValues((v) => ({ ...v, state: e.target.value }))}
                    />
                    {errors.state?.[0] && <span className="field-validation-error">{errors.state[0]}</span>}
                  </div>

                  <div className="col-md-3">
                    <label htmlFor="pinCode" className="form-label">
                      PIN Code
                    </label>
                    <input
                      id="pinCode"
                      className={inputClass}
                      inputMode="numeric"
                      maxLength={6}
                      value={values.pinCode}
                      onChange={(e) => setValues((v) => ({ ...v, pinCode: e.target.value }))}
                    />
                    {errors.pinCode?.[0] && <span className="field-validation-error">{errors.pinCode[0]}</span>}
                  </div>

                  <div className="col-12">
                    <button type="submit" className={`btn btn-wood${pending ? " is-busy" : ""}`} disabled={pending}>
                      {pending && <span className="wos-btn-spinner" aria-hidden="true" />}
                      {pending ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="panel mb-3">
            <div className="panel-header">Shortcuts</div>
            <div className="panel-body d-grid gap-2">
              <Link href="/orders" className="btn btn-outline-wood">
                📦 My Orders
              </Link>
              <Link href="/cart" className="btn btn-outline-wood">
                🛒 Your Cart
              </Link>
              <Link href="/account/change-password" className="btn btn-outline-wood">
                🔒 Change Password
              </Link>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">Need Help?</div>
            <div className="panel-body">
              <p className="small text-muted-wood mb-3">
                If you have any question about an order or a product, talk to us directly.
              </p>
              <Link href="/contact" className="btn btn-wood btn-sm w-100">
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
