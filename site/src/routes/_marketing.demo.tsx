import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/_marketing/demo")({
  component: DemoPage,
});

function DemoPage() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-white via-indigo-50/30 to-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <span className="rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700">
            Get Started
          </span>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            See ReceptionAI in Action
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600">
            Fill out the form and we'll show you how AI can transform your business
            communications. No commitment, no sales pressure.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="bg-white pb-20">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          {submitted ? (
            <div className="rounded-2xl border border-green-100 bg-green-50 p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mt-4 text-2xl font-bold text-gray-900">Thanks for your interest!</h2>
              <p className="mt-2 text-gray-600">
                We'll be in touch within 24 hours. In the meantime, feel free to explore our features.
              </p>
            </div>
          ) : (
            <form
              className="space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitted(true);
              }}
            >
              <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="name"
                      type="text"
                      required
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Business Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="john@company.com"
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      required
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-gray-700">
                      Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="company"
                      type="text"
                      required
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Smith Plumbing Inc."
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="employees" className="block text-sm font-medium text-gray-700">
                      Number of Employees
                    </label>
                    <select
                      id="employees"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">Select...</option>
                      <option value="1">Just me (1)</option>
                      <option value="2-5">2-5 employees</option>
                      <option value="6-10">6-10 employees</option>
                      <option value="11-25">11-25 employees</option>
                      <option value="26-50">26-50 employees</option>
                      <option value="50+">50+ employees</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="message" className="block text-sm font-medium text-gray-700">
                      Anything specific you'd like to know?
                    </label>
                    <textarea
                      id="message"
                      rows={3}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Tell us about your business and what you're looking for..."
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
              >
                Request Demo
              </button>

              <p className="text-center text-sm text-gray-500">
                Free 14-day trial. No credit card required. We respect your privacy.
              </p>
            </form>
          )}
        </div>
      </section>
    </>
  );
}